import React from 'react';
import { ArrowRight, Layers, Repeat, ShieldCheck, Wallet } from 'lucide-react';
import { AppTab } from '../../types/crm';
import { AnalyticsPreferences } from '../../types/analytics';
import { FinancialAnalyticsSnapshot } from '../../services/analytics';
import { formatBrlFromCents } from '../../services/finance/money';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
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
  HorizontalBarBreakdown,
} from './AnalyticsCharts';

interface AnalyticsFinancialTabProps {
  financial: FinancialAnalyticsSnapshot;
  preferences: AnalyticsPreferences;
  onNavigateTab: (tab: AppTab) => void;
}

export const AnalyticsFinancialTab: React.FC<AnalyticsFinancialTabProps> = ({
  financial,
  preferences,
  onNavigateTab,
}) => {
  const { current, cashFlow, deltas, activeRecurrences, projectResultSummary } = financial;
  const realizedMarginPct =
    current.receivedRevenueCents > 0
      ? (current.realizedProfitCents / current.receivedRevenueCents) * 100
      : null;
  const predictedProfitCents = current.predictedRevenueCents - current.predictedExpensesCents;

  return (
    <div className="space-y-6">
      {/* Cabeçalho de Paridade & Atalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)]">
        <div className="flex items-center gap-2.5 text-xs">
          <ShieldCheck className="w-4 h-4 text-[var(--kz-success-text)] shrink-0" />
          <span className="text-[var(--kz-text-secondary)]">
            <strong>Paridade Financeira:</strong> Valores <strong>Realizados</strong> e{' '}
            <strong>Previstos</strong> vêm diretamente do motor oficial do Financeiro, sem misturar
            saldo inicial com faturamento.
          </span>
        </div>
        <Button
          variant="outline"
          size="xs"
          rightIcon={<ArrowRight className="w-3 h-3" />}
          onClick={() => onNavigateTab('finance')}
        >
          Abrir Módulo Financeiro
        </Button>
      </div>

      {/* Bloco 1: REALIZADO NO PERÍODO */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Badge variant="success" dot size="md">
            REALIZADO NO PERÍODO (CAIXA / BAIXAS REAIS)
          </Badge>
          <span className="text-xs text-[var(--kz-text-muted)]">
            Comparado com {financial.period.previousLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <AnalyticsKpiCard
            label="Receita Realizada"
            value={formatBrlFromCents(current.receivedRevenueCents)}
            subtitle={`Previsto no período: ${formatBrlFromCents(current.predictedRevenueCents)}`}
            deltaText={`${formatBrlFromCents(deltas.receivedRevenueDeltaCents, { signed: true })} vs ant.`}
            deltaPositive={
              deltas.receivedRevenueDeltaCents === 0
                ? null
                : deltas.receivedRevenueDeltaCents > 0
            }
            tone="success"
            compact={preferences.compactTables}
          />
          <AnalyticsKpiCard
            label="Despesa Paga"
            value={formatBrlFromCents(current.paidExpensesCents)}
            subtitle={`Previsto no período: ${formatBrlFromCents(current.predictedExpensesCents)}`}
            deltaText={`${formatBrlFromCents(deltas.paidExpensesDeltaCents, { signed: true })} vs ant.`}
            deltaPositive={
              deltas.paidExpensesDeltaCents === 0 ? null : deltas.paidExpensesDeltaCents < 0
            }
            compact={preferences.compactTables}
          />
          <AnalyticsKpiCard
            label="Lucro Realizado"
            value={formatBrlFromCents(current.realizedProfitCents)}
            subtitle={
              realizedMarginPct !== null
                ? `Margem realizada: ${realizedMarginPct.toFixed(1)}%`
                : 'Sem entradas no período para margem'
            }
            deltaText={`${formatBrlFromCents(deltas.realizedProfitDeltaCents, { signed: true })} vs ant.`}
            deltaPositive={
              deltas.realizedProfitDeltaCents === 0 ? null : deltas.realizedProfitDeltaCents > 0
            }
            tone={current.realizedProfitCents >= 0 ? 'accent' : 'danger'}
            compact={preferences.compactTables}
          />
          <AnalyticsKpiCard
            label="Saldo de Caixa Atual"
            value={formatBrlFromCents(current.cashBalanceCents)}
            subtitle="Saldo inicial + movimentações acumuladas até hoje"
            tone={current.cashBalanceCents < 0 ? 'danger' : 'default'}
            compact={preferences.compactTables}
          />
        </div>
      </div>

      {/* Bloco 2: PREVISTO & POSIÇÃO EM ABERTO */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Badge variant="info" dot size="md">
            PREVISTO / PROJETADO & CONTAS EM ABERTO
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <AnalyticsKpiCard
            label="Receita Prevista (Venc. Período)"
            value={formatBrlFromCents(current.predictedRevenueCents)}
            subtitle={`Lucro projetado (período): ${formatBrlFromCents(
              predictedProfitCents
            )}`}
            compact={preferences.compactTables}
          />
          <AnalyticsKpiCard
            label="Contas a Receber (Em Aberto)"
            value={formatBrlFromCents(current.accountsReceivableCents)}
            subtitle={`Com venc. no período: ${formatBrlFromCents(cashFlow.projectedInflowCents)}`}
            tone="accent"
            compact={preferences.compactTables}
          />
          <AnalyticsKpiCard
            label="Contas a Pagar (Em Aberto)"
            value={formatBrlFromCents(current.accountsPayableCents)}
            subtitle={`Com venc. no período: ${formatBrlFromCents(cashFlow.projectedOutflowCents)}`}
            compact={preferences.compactTables}
          />
          <AnalyticsKpiCard
            label="Inadimplência Vencida"
            value={formatBrlFromCents(current.delinquencyCents)}
            subtitle={`${current.delinquencyCount} título(s) vencido(s) até hoje`}
            tone={current.delinquencyCents > 0 ? 'danger' : 'success'}
            compact={preferences.compactTables}
          />
        </div>
      </div>

      {/* Gráfico & Recorrências Ativas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card padding="md" className="lg:col-span-2 space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[var(--kz-accent)]" />
              <div>
                <CardTitle>Fluxo Realizado no Período (Entradas vs Saídas)</CardTitle>
                <CardDescription>
                  Saldo inicial da janela: {formatBrlFromCents(cashFlow.openingBalanceInPeriodCents)} ·
                  Fechamento realizado: {formatBrlFromCents(cashFlow.realizedClosingBalanceCents)}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <DualBarTimeSeriesChart
            points={cashFlow.buckets.map((b) => ({
              key: b.key,
              label: b.label,
              valueA: b.realizedInflowCents,
              valueB: b.realizedOutflowCents,
              tooltipA: formatBrlFromCents(b.realizedInflowCents),
              tooltipB: formatBrlFromCents(b.realizedOutflowCents),
            }))}
            labelA="Entradas Realizadas"
            labelB="Saídas Realizadas"
            colorA="#34D399"
            colorB="#FB7185"
            formatValue={(v) => formatBrlFromCents(v)}
          />
        </Card>

        <Card padding="md" className="space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-[var(--kz-accent)]" />
              <CardTitle>Recorrências Ativas</CardTitle>
            </div>
          </CardHeader>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Receitas Recorrentes Ativas ({activeRecurrences.activeRevenueCount})
              </span>
              <span className="text-base kz-metric text-[var(--kz-success-text)]">
                {formatBrlFromCents(activeRecurrences.activeRevenueMonthlyCents)}/mês
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Despesas Recorrentes Ativas ({activeRecurrences.activeExpenseCount})
              </span>
              <span className="text-base kz-metric text-[var(--kz-danger-text)]">
                {formatBrlFromCents(activeRecurrences.activeExpenseMonthlyCents)}/mês
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Saldo Recorrente Mensal Estimado
              </span>
              <span className="text-base kz-metric text-[var(--kz-accent-text)]">
                {formatBrlFromCents(
                  activeRecurrences.activeRevenueMonthlyCents -
                    activeRecurrences.activeExpenseMonthlyCents,
                  { signed: true }
                )}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Receitas por Cliente, Despesas por Categoria, Resultado por Projeto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card padding="md" className="space-y-3">
          <CardHeader>
            <CardTitle>Receita Realizada por Cliente</CardTitle>
          </CardHeader>
          <HorizontalBarBreakdown
            items={current.revenueByClient.map((c) => ({
              key: c.id,
              label: c.name,
              value: c.amountCents,
              formattedValue: `${formatBrlFromCents(c.amountCents)} (${c.percent.toFixed(1)}%)`,
              tone: 'success',
            }))}
            emptyMessage="Sem recebimentos vinculados a clientes no período."
          />
        </Card>

        <Card padding="md" className="space-y-3">
          <CardHeader>
            <CardTitle>Despesas Pagas por Categoria</CardTitle>
          </CardHeader>
          <HorizontalBarBreakdown
            items={current.expensesByCategory.map((cat) => ({
              key: cat.id,
              label: cat.name,
              value: cat.amountCents,
              formattedValue: `${formatBrlFromCents(cat.amountCents)} (${cat.percent.toFixed(1)}%)`,
              tone: 'danger',
            }))}
            emptyMessage="Sem despesas pagas no período."
          />
        </Card>

        <Card padding="md" className="space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--kz-accent)]" />
              <CardTitle>Resultado Realizado por Projeto</CardTitle>
            </div>
          </CardHeader>
          <HorizontalBarBreakdown
            items={projectResultSummary.map((p) => ({
              key: p.projectId,
              label: p.projectName,
              value: Math.max(0, p.netRealizedCents),
              formattedValue: formatBrlFromCents(p.netRealizedCents, { signed: true }),
              secondaryText: `Ent.: ${formatBrlFromCents(p.receivedCents)}`,
              tone: p.netRealizedCents >= 0 ? 'accent' : 'danger',
            }))}
            emptyMessage="Sem lançamentos financeiros vinculados a projetos no período."
          />
        </Card>
      </div>

      {/* Tabela Realizado vs Previsto */}
      <Card padding="md" className="space-y-3">
        <CardHeader>
          <div>
            <CardTitle>Demonstrativo Consolidado — Fluxo Realizado vs Projetado</CardTitle>
            <CardDescription>
              Saldo projetado inclui títulos pendentes/atrasados com vencimento na janela.
            </CardDescription>
          </div>
        </CardHeader>
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Janela</TableHead>
                <TableHead className="text-right">Entradas Realiz.</TableHead>
                <TableHead className="text-right">Saídas Realiz.</TableHead>
                <TableHead className="text-right">Saldo Realizado</TableHead>
                <TableHead className="text-right">Entradas Prev.</TableHead>
                <TableHead className="text-right">Saídas Prev.</TableHead>
                <TableHead className="text-right">Saldo Projetado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono tabular-nums">
              {cashFlow.buckets.map((b) => (
                <TableRow key={b.key}>
                  <TableCell
                    className={`font-sans font-medium text-[var(--kz-text-primary)] ${
                      preferences.compactTables ? 'py-2' : ''
                    }`}
                  >
                    {b.label}
                  </TableCell>
                  <TableCell
                    className={`text-right text-[var(--kz-success-text)] ${
                      preferences.compactTables ? 'py-2' : ''
                    }`}
                  >
                    {formatBrlFromCents(b.realizedInflowCents)}
                  </TableCell>
                  <TableCell
                    className={`text-right text-[var(--kz-danger-text)] ${
                      preferences.compactTables ? 'py-2' : ''
                    }`}
                  >
                    {formatBrlFromCents(b.realizedOutflowCents)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold text-[var(--kz-text-primary)] ${
                      preferences.compactTables ? 'py-2' : ''
                    }`}
                  >
                    {formatBrlFromCents(b.realizedBalanceCents)}
                  </TableCell>
                  <TableCell className={`text-right ${preferences.compactTables ? 'py-2' : ''}`}>
                    {formatBrlFromCents(b.projectedInflowCents)}
                  </TableCell>
                  <TableCell className={`text-right ${preferences.compactTables ? 'py-2' : ''}`}>
                    {formatBrlFromCents(b.projectedOutflowCents)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold text-[var(--kz-accent-text)] ${
                      preferences.compactTables ? 'py-2' : ''
                    }`}
                  >
                    {formatBrlFromCents(b.projectedBalanceCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <DataLimitationBanner
        visible={preferences.showDataLimitationsNotice}
        title="Integridade do Módulo Financeiro"
        message={financial.dataIntegrityNote}
      />
    </div>
  );
};
