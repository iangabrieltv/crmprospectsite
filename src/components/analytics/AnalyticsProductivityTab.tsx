import React, { useState } from 'react';
import { Activity, CalendarCheck2, Search } from 'lucide-react';
import { AnalyticsPreferences } from '../../types/analytics';
import {
  ProductivityActivityModule,
  ProductivityAnalyticsSnapshot,
} from '../../services/analytics';
import { formatDateBr } from '../../services/finance/money';
import {
  Badge,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui';
import {
  AnalyticsKpiCard,
  DataLimitationBanner,
  DualBarTimeSeriesChart,
} from './AnalyticsCharts';

interface AnalyticsProductivityTabProps {
  productivity: ProductivityAnalyticsSnapshot;
  preferences: AnalyticsPreferences;
}

const MODULE_OPTIONS: { id: 'all' | ProductivityActivityModule; label: string }[] = [
  { id: 'all', label: 'Todos os módulos' },
  { id: 'tarefas', label: 'Tarefas' },
  { id: 'projetos', label: 'Projetos' },
  { id: 'comercial', label: 'CRM / Comercial' },
  { id: 'propostas', label: 'Propostas & Contratos' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'social', label: 'Redes Sociais' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'materiais', label: 'Materiais' },
];

export const AnalyticsProductivityTab: React.FC<AnalyticsProductivityTabProps> = ({
  productivity,
  preferences,
}) => {
  const [moduleFilter, setModuleFilter] = useState<'all' | ProductivityActivityModule>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const tasksDelta =
    productivity.tasksCompletedInPeriod - productivity.previousTasksCompletedInPeriod;

  const filteredActivities = productivity.recentActivities.filter((act) => {
    if (moduleFilter !== 'all' && act.module !== moduleFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        act.title.toLowerCase().includes(q) ||
        (act.clientName || '').toLowerCase().includes(q) ||
        (act.detail || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Aviso obrigatório de ausência de apontamento de horas */}
      <DataLimitationBanner
        alwaysShow
        title="Horas Trabalhadas Não Mensuradas"
        message={productivity.workedHoursLimitationNote}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <AnalyticsKpiCard
          label="Tarefas Concluídas"
          value={String(productivity.tasksCompletedInPeriod)}
          subtitle={`Média: ${productivity.tasksCompletedPerDayAvg}/dia`}
          deltaText={`${tasksDelta > 0 ? '+' : ''}${tasksDelta} vs anterior`}
          deltaPositive={tasksDelta === 0 ? null : tasksDelta > 0}
          tone="success"
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Dias Ativos / Consistência"
          value={`${productivity.activeDaysCount} / ${productivity.period.daysCount}d`}
          subtitle={`Consistência: ${productivity.consistencyRatePct}% dos dias da janela`}
          tone="accent"
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Toques CRM & Propostas"
          value={`${productivity.commercialTouchesInPeriod} / ${productivity.proposalsCreatedOrApprovedInPeriod}`}
          subtitle="Abordagens CRM / Movimentos em propostas"
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Agenda, Social & Materiais"
          value={`${productivity.agendaCompletedInPeriod} / ${productivity.socialPublishedInPeriod} / ${productivity.materialsUploadedInPeriod}`}
          subtitle="Agenda concl. / Posts publ. / Materiais"
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Backlog em Atraso"
          value={String(productivity.totalOverdueBacklog)}
          subtitle={`Tarefas: ${productivity.overdueTasksBacklog} · Proj.: ${productivity.overdueProjectsBacklog} · Social: ${productivity.overdueSocialBacklog}`}
          tone={productivity.totalOverdueBacklog > 0 ? 'danger' : 'success'}
          compact={preferences.compactTables}
        />
      </div>

      {/* Ritmo no período */}
      <Card padding="md" className="space-y-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="w-4 h-4 text-[var(--kz-accent)]" />
            <div>
              <CardTitle>Cadência de Execução no Período</CardTitle>
              <CardDescription>
                Tarefas concluídas versus demais ações reais (abordagens CRM, agenda concluída e publicações confirmadas).
              </CardDescription>
            </div>
          </div>
          <Badge variant="neutral" size="md">
            Movimentos financeiros: {productivity.financialMovementsInPeriod}
          </Badge>
        </CardHeader>

        <DualBarTimeSeriesChart
          points={productivity.timeSeries.map((pt) => ({
            key: pt.key,
            label: pt.label,
            valueA: pt.tasksCompleted,
            valueB: Math.max(0, pt.totalActions - pt.tasksCompleted),
          }))}
          labelA="Tarefas Concluídas"
          labelB="CRM, Agenda & Social"
          colorA="#34D399"
          colorB="#C6A15B"
          emptyMessage="Sem ações registradas nesta janela."
        />
      </Card>

      {/* Histórico Cronológico Real de Atividades */}
      <Card padding="md" className="space-y-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--kz-accent)]" />
            <div>
              <CardTitle>
                Registro Cronológico de Ações Reais ({filteredActivities.length})
              </CardTitle>
              <CardDescription>
                Consolidado auditável de entregas concluídas no período selecionado.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-48">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar ação ou cliente..."
                leftIcon={<Search className="w-3.5 h-3.5" />}
              />
            </div>
            <select
              value={moduleFilter}
              onChange={(e) =>
                setModuleFilter(e.target.value as 'all' | ProductivityActivityModule)
              }
              className="h-9 px-2.5 text-xs bg-[var(--kz-bg-subtle)] text-[var(--kz-text-primary)] border border-[var(--kz-border-default)] rounded-lg"
            >
              {MODULE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>

        {filteredActivities.length === 0 ? (
          <EmptyState
            icon={<Activity className="w-5 h-5" />}
            title="Nenhuma atividade encontrada"
            description="Não há registros concluídos neste período para os filtros escolhidos."
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Cliente / Origem</TableHead>
                  <TableHead>Detalhe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivities.slice(0, 100).map((act) => (
                  <TableRow key={act.id}>
                    <TableCell
                      className={`font-mono whitespace-nowrap ${
                        preferences.compactTables ? 'py-2' : ''
                      }`}
                    >
                      {formatDateBr(act.dateYmd)}
                    </TableCell>
                    <TableCell className={preferences.compactTables ? 'py-2' : ''}>
                      <Badge variant="neutral">{act.moduleLabel}</Badge>
                    </TableCell>
                    <TableCell
                      className={`font-medium text-[var(--kz-text-primary)] ${
                        preferences.compactTables ? 'py-2' : ''
                      }`}
                    >
                      {act.title}
                    </TableCell>
                    <TableCell className={preferences.compactTables ? 'py-2' : ''}>
                      {act.clientName || 'Interno / Geral'}
                    </TableCell>
                    <TableCell
                      className={`text-[var(--kz-text-muted)] ${
                        preferences.compactTables ? 'py-2' : ''
                      }`}
                    >
                      {act.detail || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </div>
  );
};
