import React from 'react';
import { ArrowRight, ArrowUpRight, FolderKanban } from 'lucide-react';
import { AppTab } from '../../types/crm';
import { AnalyticsPreferences } from '../../types/analytics';
import { OperationalAnalyticsSnapshot } from '../../services/analytics';
import { formatDateBr } from '../../services/finance/money';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
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
  HorizontalBarBreakdown,
} from './AnalyticsCharts';

interface AnalyticsProjectsTabProps {
  operational: OperationalAnalyticsSnapshot;
  preferences: AnalyticsPreferences;
  onOpenProject: (projectId: string) => void;
  onNavigateTab: (tab: AppTab) => void;
}

export const AnalyticsProjectsTab: React.FC<AnalyticsProjectsTabProps> = ({
  operational,
  preferences,
  onOpenProject,
  onNavigateTab,
}) => {
  const { projects } = operational;
  const projDelta = projects.completedInPeriod - projects.previousCompletedInPeriod;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <AnalyticsKpiCard
          label="Projetos Ativos"
          value={String(projects.activeCount)}
          subtitle={`Em revisão: ${projects.inReviewCount} · Aguardando cliente: ${projects.awaitingClientCount}`}
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Concluídos no Período"
          value={String(projects.completedInPeriod)}
          subtitle={`Total concluídos: ${projects.completedTotal} · Cancelados: ${projects.cancelledCount}`}
          deltaText={`${projDelta > 0 ? '+' : ''}${projDelta} vs anterior`}
          deltaPositive={projDelta === 0 ? null : projDelta > 0}
          tone="success"
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Atrasados Ativos"
          value={String(projects.overdueActiveCount)}
          subtitle={`Vencem em 7 dias: ${projects.dueWithin7DaysCount} · Pausados: ${projects.pausedCount}`}
          tone={projects.overdueActiveCount > 0 ? 'danger' : 'success'}
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Progresso Médio (Não Cancelados)"
          value={`${projects.avgProgressPct}%`}
          subtitle="Baseado estritamente em tarefas concluídas"
          tone="accent"
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Entregas no Prazo / Duração"
          value={
            projects.onTimeDelivery.ratePct !== null
              ? `${projects.onTimeDelivery.ratePct}%`
              : '—'
          }
          subtitle={
            projects.avgCompletedDurationDays.valueDays !== null
              ? `Duração média: ${projects.avgCompletedDurationDays.valueDays}d (${projects.avgCompletedDurationDays.sampleSize} proj.)`
              : 'Sem projetos concluídos com datas completas'
          }
          compact={preferences.compactTables}
        />
      </div>

      {/* Breakdowns por Modelo, Tipo de Serviço e Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card padding="md" className="space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-[var(--kz-accent)]" />
              <CardTitle>Por Modelo de Projeto</CardTitle>
            </div>
            <Button
              variant="outline"
              size="xs"
              rightIcon={<ArrowRight className="w-3 h-3" />}
              onClick={() => onNavigateTab('projects')}
            >
              Projetos
            </Button>
          </CardHeader>
          <HorizontalBarBreakdown
            items={projects.byTemplate.map((t) => ({
              key: t.key,
              label: t.label,
              value: t.count,
              secondaryText: `${t.activeCount} ativ. · ${t.avgProgressPct}% méd.`,
              tone: 'accent',
            }))}
          />
        </Card>

        <Card padding="md" className="space-y-3">
          <CardHeader>
            <CardTitle>Por Serviço Contratado</CardTitle>
          </CardHeader>
          <HorizontalBarBreakdown
            items={projects.byServiceType.map((s) => ({
              key: s.key,
              label: s.label,
              value: s.count,
              secondaryText: `${s.completedCount} concl. · ${s.avgProgressPct}%`,
              tone: 'success',
            }))}
            emptyMessage="Sem projetos cadastrados."
          />
        </Card>

        <Card padding="md" className="space-y-3">
          <CardHeader>
            <CardTitle>Por Status de Execução</CardTitle>
          </CardHeader>
          <HorizontalBarBreakdown
            items={projects.byStatus.map((s) => ({
              key: s.status,
              label: s.label,
              value: s.count,
              tone:
                s.status === 'concluido'
                  ? 'success'
                  : s.status === 'cancelado'
                  ? 'danger'
                  : s.status === 'pausado'
                  ? 'warning'
                  : 'accent',
            }))}
          />
        </Card>
      </div>

      {/* Tabela Completa de Projetos */}
      <Card padding="md" className="space-y-3">
        <CardHeader>
          <div>
            <CardTitle>Carteira Detalhada de Projetos ({projects.rows.length})</CardTitle>
            <CardDescription>
              Projetos cancelados permanecem listados com status explícito, sem contar como entregas concluídas.
            </CardDescription>
          </div>
        </CardHeader>

        {projects.rows.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="w-5 h-5" />}
            title="Nenhum projeto cadastrado"
            description="Crie projetos vinculados a clientes no módulo Projetos."
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Prazo</TableHead>
                  <TableHead className="text-right">Tarefas</TableHead>
                  <TableHead>Execução</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell
                      className={`font-medium text-[var(--kz-text-primary)] ${
                        preferences.compactTables ? 'py-2' : ''
                      }`}
                    >
                      {p.name}
                    </TableCell>
                    <TableCell className={preferences.compactTables ? 'py-2' : ''}>
                      {p.clientName}
                    </TableCell>
                    <TableCell className={preferences.compactTables ? 'py-2' : ''}>
                      {p.serviceType}
                    </TableCell>
                    <TableCell className={preferences.compactTables ? 'py-2' : ''}>
                      <Badge
                        variant={
                          p.status === 'concluido'
                            ? 'success'
                            : p.status === 'cancelado'
                            ? 'danger'
                            : p.isOverdue
                            ? 'danger'
                            : p.status === 'pausado'
                            ? 'warning'
                            : 'accent'
                        }
                      >
                        {p.statusLabel}
                        {p.isOverdue ? ` (${p.daysOverdue}d atr.)` : ''}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums ${
                        preferences.compactTables ? 'py-2' : ''
                      }`}
                    >
                      {p.dueDate ? formatDateBr(p.dueDate) : 'Sem prazo'}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums ${
                        preferences.compactTables ? 'py-2' : ''
                      }`}
                    >
                      {p.completedTasks}/{p.totalTasks}
                    </TableCell>
                    <TableCell className={`min-w-[120px] ${preferences.compactTables ? 'py-2' : ''}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--kz-bg-subtle)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              p.status === 'concluido'
                                ? 'bg-[var(--kz-success-solid)]'
                                : p.isOverdue
                                ? 'bg-[var(--kz-danger-solid)]'
                                : 'bg-[var(--kz-accent)]'
                            }`}
                            style={{ width: `${p.progressPct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono tabular-nums w-9 text-right">
                          {p.progressPct}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-center ${preferences.compactTables ? 'py-2' : ''}`}>
                      <Button
                        variant="ghost"
                        size="xs"
                        rightIcon={<ArrowUpRight className="w-3 h-3" />}
                        onClick={() => onOpenProject(p.id)}
                        className="text-[var(--kz-accent-text)]"
                      >
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <DataLimitationBanner
        visible={preferences.showDataLimitationsNotice}
        title="Consistência de Projetos"
        message={operational.integrityNote}
      />
    </div>
  );
};
