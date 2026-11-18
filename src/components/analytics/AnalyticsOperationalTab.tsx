import React from 'react';
import { AlertTriangle, ArrowRight, CheckSquare } from 'lucide-react';
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

interface AnalyticsOperationalTabProps {
  operational: OperationalAnalyticsSnapshot;
  preferences: AnalyticsPreferences;
  onNavigateTab: (tab: AppTab) => void;
}

export const AnalyticsOperationalTab: React.FC<AnalyticsOperationalTabProps> = ({
  operational,
  preferences,
  onNavigateTab,
}) => {
  const { tasks } = operational;
  const tasksDelta = tasks.completedInPeriod - tasks.previousCompletedInPeriod;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <AnalyticsKpiCard
          label="Tarefas em Aberto"
          value={String(tasks.openCount)}
          subtitle={`Em andamento: ${tasks.inProgressCount} · Em revisão: ${tasks.inReviewCount}`}
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Concluídas no Período"
          value={String(tasks.completedInPeriod)}
          subtitle={`Criadas no período: ${tasks.createdInPeriod} · Total concl.: ${tasks.completedTotal}`}
          deltaText={`${tasksDelta > 0 ? '+' : ''}${tasksDelta} vs anterior`}
          deltaPositive={tasksDelta === 0 ? null : tasksDelta > 0}
          tone="success"
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Atrasadas em Aberto"
          value={String(tasks.overdueOpenCount)}
          subtitle={`Vencem hoje: ${tasks.dueTodayCount} · Próx. 7d: ${tasks.dueWithin7DaysCount}`}
          tone={tasks.overdueOpenCount > 0 ? 'danger' : 'success'}
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Conclusão no Prazo"
          value={
            tasks.onTimeCompletion.ratePct !== null
              ? `${tasks.onTimeCompletion.ratePct}%`
              : '—'
          }
          subtitle={`${tasks.onTimeCompletion.onTimeCount} no prazo vs ${tasks.onTimeCompletion.lateCount} com atraso`}
          tone="accent"
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Taxa Global de Conclusão"
          value={tasks.completionRatePct !== null ? `${tasks.completionRatePct}%` : '—'}
          subtitle={`${tasks.completedTotal} de ${tasks.totalBase} · Sem prazo: ${tasks.withoutDueDateCount}`}
          compact={preferences.compactTables}
        />
      </div>

      {/* Quebras por Status e Prioridade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="md" className="space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-[var(--kz-accent)]" />
              <CardTitle>Distribuição por Status Operacional</CardTitle>
            </div>
            <Button
              variant="outline"
              size="xs"
              rightIcon={<ArrowRight className="w-3 h-3" />}
              onClick={() => onNavigateTab('tasks')}
            >
              Minhas Tarefas
            </Button>
          </CardHeader>
          <HorizontalBarBreakdown
            items={tasks.byStatus.map((s) => ({
              key: s.status,
              label: s.label,
              value: s.count,
              tone:
                s.status === 'concluida'
                  ? 'success'
                  : s.status === 'aguardando'
                  ? 'warning'
                  : 'accent',
            }))}
            emptyMessage="Sem tarefas registradas."
          />
        </Card>

        <Card padding="md" className="space-y-3">
          <CardHeader>
            <CardTitle>Fila em Aberto por Prioridade</CardTitle>
          </CardHeader>
          <HorizontalBarBreakdown
            items={tasks.byPriority.map((p) => ({
              key: p.priority,
              label: p.label,
              value: p.openCount,
              secondaryText: p.overdueCount > 0 ? `${p.overdueCount} atrasada(s)` : 'Em dia',
              tone:
                p.priority === 'urgente' || p.overdueCount > 0
                  ? 'danger'
                  : p.priority === 'alta'
                  ? 'warning'
                  : 'accent',
            }))}
            emptyMessage="Nenhuma tarefa em aberto."
          />
        </Card>
      </div>

      {/* Lista de Tarefas Atrasadas */}
      <Card padding="md" className="space-y-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--kz-danger-text)]" />
            <div>
              <CardTitle>Tarefas com Prazo Vencido ({tasks.overdueList.length})</CardTitle>
              <CardDescription>
                Ordenadas da maior quantidade de dias em atraso para a menor.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {tasks.overdueList.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="w-5 h-5" />}
            title="Nenhuma tarefa atrasada"
            description="Todas as tarefas com prazo definido estão em dia ou concluídas."
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarefa</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Cliente / Origem</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead className="text-right">Prazo</TableHead>
                  <TableHead className="text-right">Atraso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.overdueList.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell
                      className={`font-medium text-[var(--kz-text-primary)] ${
                        preferences.compactTables ? 'py-2' : ''
                      }`}
                    >
                      {item.title}
                    </TableCell>
                    <TableCell className={preferences.compactTables ? 'py-2' : ''}>
                      {item.projectName}
                    </TableCell>
                    <TableCell className={preferences.compactTables ? 'py-2' : ''}>
                      {item.clientName}
                    </TableCell>
                    <TableCell className={preferences.compactTables ? 'py-2' : ''}>
                      <Badge variant="neutral">{item.priorityLabel}</Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums ${
                        preferences.compactTables ? 'py-2' : ''
                      }`}
                    >
                      {formatDateBr(item.dueDate)}
                    </TableCell>
                    <TableCell className={`text-right ${preferences.compactTables ? 'py-2' : ''}`}>
                      <Badge variant="danger">{item.daysOverdue} dia(s)</Badge>
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
        title="Regras de Integridade Operacional"
        message={operational.integrityNote}
      />
    </div>
  );
};
