import React, { useState } from 'react';
import { AlertCircle, ArrowUpRight, Search, Users } from 'lucide-react';
import { AppTab } from '../../types/crm';
import { AnalyticsPreferences } from '../../types/analytics';
import { ClientPortfolioAnalyticsSnapshot } from '../../services/analytics';
import { formatBrlFromCents, formatDateBr } from '../../services/finance/money';
import {
  Badge,
  Button,
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
  HorizontalBarBreakdown,
} from './AnalyticsCharts';

interface AnalyticsClientsTabProps {
  clientsAnalytics: ClientPortfolioAnalyticsSnapshot;
  preferences: AnalyticsPreferences;
  onOpenClient: (clientId: string) => void;
  onNavigateTab: (tab: AppTab) => void;
}

export const AnalyticsClientsTab: React.FC<AnalyticsClientsTabProps> = ({
  clientsAnalytics,
  preferences,
  onOpenClient,
  onNavigateTab,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredRows = clientsAnalytics.rows.filter((row) => {
    if (statusFilter !== 'all' && row.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        row.companyName.toLowerCase().includes(q) ||
        (row.contactName || '').toLowerCase().includes(q) ||
        (row.city || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <AnalyticsKpiCard
          label="Clientes Ativos + Onboarding"
          value={String(clientsAnalytics.activeCount + clientsAnalytics.onboardingCount)}
          subtitle={`Total base: ${clientsAnalytics.totalClients} · Novos período: ${clientsAnalytics.newClientsInPeriod}`}
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="MRR Contratado (Ativos)"
          value={formatBrlFromCents(Math.round(clientsAnalytics.totalActiveContractedMrr * 100))}
          subtitle={`Pausados: ${clientsAnalytics.pausedCount} · Encerrados: ${clientsAnalytics.closedCount}`}
          tone="accent"
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Receita Realizada de Clientes"
          value={formatBrlFromCents(clientsAnalytics.totalRealizedRevenueFromClientsInPeriodCents)}
          subtitle="Recebimentos baixados no período"
          tone="success"
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Com Financeiro Vencido"
          value={String(clientsAnalytics.clientsWithOverdueFinanceCount)}
          subtitle={`Sem projeto ativo: ${clientsAnalytics.clientsWithoutActiveProjectsCount}`}
          tone={clientsAnalytics.clientsWithOverdueFinanceCount > 0 ? 'danger' : 'default'}
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Possível Inatividade (21d+)"
          value={String(clientsAnalytics.potentiallyInactiveClientsCount)}
          subtitle="Ativos sem projetos/tarefas/movimentos recentes"
          tone={clientsAnalytics.potentiallyInactiveClientsCount > 0 ? 'warning' : 'default'}
          compact={preferences.compactTables}
        />
      </div>

      {/* Distribuição por Status & Alertas de Inatividade */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card padding="md" className="space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--kz-accent)]" />
              <CardTitle>Carteira por Status</CardTitle>
            </div>
            <Button variant="outline" size="xs" onClick={() => onNavigateTab('clients')}>
              Ver Todos
            </Button>
          </CardHeader>
          <HorizontalBarBreakdown
            items={clientsAnalytics.byStatus.map((s) => ({
              key: s.status,
              label: s.label,
              value: s.count,
              tone:
                s.status === 'ativo'
                  ? 'success'
                  : s.status === 'onboarding'
                  ? 'accent'
                  : s.status === 'pausado'
                  ? 'warning'
                  : 'neutral',
            }))}
            emptyMessage="Nenhum cliente cadastrado."
          />
        </Card>

        <Card padding="md" className="lg:col-span-2 space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--kz-warning-text)]" />
              <div>
                <CardTitle>
                  Clientes Ativos Sem Movimentação Recente ({clientsAnalytics.inactiveAlertRows.length})
                </CardTitle>
                <CardDescription>
                  Clientes ativos/onboarding sem projetos ativos, tarefas abertas ou movimentações há 21+ dias.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          {clientsAnalytics.inactiveAlertRows.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--kz-text-muted)]">
              Nenhum cliente ativo com sinal de inatividade no momento.
            </div>
          ) : (
            <div className="space-y-2">
              {clientsAnalytics.inactiveAlertRows.slice(0, 5).map((row) => (
                <div
                  key={row.clientId}
                  className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-warning-border)]/60 text-xs"
                >
                  <div>
                    <span className="font-semibold text-[var(--kz-text-primary)]">
                      {row.companyName}
                    </span>
                    <span className="text-[11px] text-[var(--kz-text-muted)] ml-2">
                      Última atividade:{' '}
                      {row.lastActivityYmd ? formatDateBr(row.lastActivityYmd) : '—'} (
                      {row.daysSinceLastActivity} dia(s))
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    rightIcon={<ArrowUpRight className="w-3 h-3" />}
                    onClick={() => onOpenClient(row.clientId)}
                    className="text-[var(--kz-accent-text)]"
                  >
                    Abrir Ficha
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Tabela Consolidada por Cliente */}
      <Card padding="md" className="space-y-3">
        <CardHeader>
          <div>
            <CardTitle>Visão Consolidada por Cliente ({filteredRows.length})</CardTitle>
            <CardDescription>
              Cruzamento real entre carteira, receitas realizadas, títulos em aberto, projetos e tarefas.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-48">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar cliente..."
                leftIcon={<Search className="w-3.5 h-3.5" />}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-2.5 text-xs bg-[var(--kz-bg-subtle)] text-[var(--kz-text-primary)] border border-[var(--kz-border-default)] rounded-lg"
            >
              <option value="all">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="onboarding">Onboarding</option>
              <option value="pausado">Pausado</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>
        </CardHeader>

        {filteredRows.length === 0 ? (
          <EmptyState
            icon={<Users className="w-5 h-5" />}
            title="Nenhum cliente encontrado"
            description="Ajuste o filtro ou cadastre clientes na área Clientes."
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">MRR Contratado</TableHead>
                  <TableHead className="text-right">Receita Realiz. (Período)</TableHead>
                  <TableHead className="text-right">Em Aberto / Vencido</TableHead>
                  <TableHead className="text-right">Projetos Ativos</TableHead>
                  <TableHead className="text-right">Tarefas Abertas</TableHead>
                  <TableHead className="text-right">Última Mov.</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono tabular-nums">
                {filteredRows.map((row) => (
                  <TableRow key={row.clientId}>
                    <TableCell
                      className={`font-sans ${preferences.compactTables ? 'py-2' : ''}`}
                    >
                      <div className="font-semibold text-[var(--kz-text-primary)]">
                        {row.companyName}
                      </div>
                      {(row.contactName || row.city) && (
                        <div className="text-[10px] text-[var(--kz-text-muted)]">
                          {[row.contactName, row.city].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={`font-sans ${preferences.compactTables ? 'py-2' : ''}`}>
                      <Badge
                        variant={
                          row.status === 'ativo'
                            ? 'success'
                            : row.status === 'onboarding'
                            ? 'accent'
                            : row.status === 'pausado'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {row.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right ${preferences.compactTables ? 'py-2' : ''}`}>
                      {formatBrlFromCents(Math.round(row.monthlyMrr * 100))}
                    </TableCell>
                    <TableCell
                      className={`text-right text-[var(--kz-success-text)] ${
                        preferences.compactTables ? 'py-2' : ''
                      }`}
                    >
                      {formatBrlFromCents(row.realizedRevenueInPeriodCents)}
                    </TableCell>
                    <TableCell className={`text-right ${preferences.compactTables ? 'py-2' : ''}`}>
                      <div>{formatBrlFromCents(row.openReceivablesCents)}</div>
                      {row.overdueReceivablesCents > 0 && (
                        <div className="text-[10px] text-[var(--kz-danger-text)]">
                          Venc.: {formatBrlFromCents(row.overdueReceivablesCents)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={`text-right ${preferences.compactTables ? 'py-2' : ''}`}>
                      {row.activeProjectsCount}
                    </TableCell>
                    <TableCell className={`text-right ${preferences.compactTables ? 'py-2' : ''}`}>
                      {row.openTasksCount}
                      {row.overdueTasksCount > 0 && (
                        <span className="text-[10px] text-[var(--kz-danger-text)] ml-1">
                          ({row.overdueTasksCount} atr.)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right ${preferences.compactTables ? 'py-2' : ''}`}>
                      {row.lastActivityYmd ? formatDateBr(row.lastActivityYmd) : '—'}
                    </TableCell>
                    <TableCell className={`text-center font-sans ${preferences.compactTables ? 'py-2' : ''}`}>
                      <Button
                        variant="ghost"
                        size="xs"
                        rightIcon={<ArrowUpRight className="w-3 h-3" />}
                        onClick={() => onOpenClient(row.clientId)}
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
        title="Critério de Inatividade"
        message={clientsAnalytics.dataLimitationsNote}
      />
    </div>
  );
};
