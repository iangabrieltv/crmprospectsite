import React from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Landmark,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, Button } from '../ui';
import { FinancialSubViewId } from '../../types/finance';
import { FinanceDashboardSnapshot, formatBrlFromCents } from '../../services/finance';
import {
  RankedBarsCard,
  ReceivedVsPendingCard,
  RevenueVsExpenseChart,
  TrendLineChartCard,
} from './FinanceCharts';

interface FinanceDashboardTabProps {
  snapshot: FinanceDashboardSnapshot;
  onNavigateSubView: (subView: FinancialSubViewId) => void;
  onOpenNewEntry: (kind: 'receita' | 'despesa') => void;
}

export const FinanceDashboardTab: React.FC<FinanceDashboardTabProps> = ({
  snapshot,
  onNavigateSubView,
  onOpenNewEntry,
}) => {
  return (
    <div className="space-y-6">
      {/* 9 Indicadores Principais Obrigatórios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card padding="md" className="border-[var(--kz-success-border)] bg-[var(--kz-success-bg)]/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[var(--kz-success-text)]">
              Receita Recebida (Realizada)
            </span>
            <ArrowUpRight className="w-4 h-4 text-[var(--kz-success-text)]" />
          </div>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-success-text)]">
            {formatBrlFromCents(snapshot.receivedRevenueCents)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Baixas efetivadas em {snapshot.periodLabel}
          </div>
        </Card>

        <Card padding="md">
          <span className="text-[11px] font-medium text-[var(--kz-text-muted)] block">
            Receita Prevista no Período
          </span>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-text-primary)]">
            {formatBrlFromCents(snapshot.predictedRevenueCents)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Lançamentos ativos com vencimento no filtro
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--kz-text-muted)]">
              Despesas Pagas (Realizadas)
            </span>
            <ArrowDownRight className="w-4 h-4 text-[var(--kz-danger-text)]" />
          </div>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-danger-text)]">
            {formatBrlFromCents(snapshot.paidExpensesCents)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Pagamentos efetivados em {snapshot.periodLabel}
          </div>
        </Card>

        <Card padding="md">
          <span className="text-[11px] font-medium text-[var(--kz-text-muted)] block">
            Despesas Previstas no Período
          </span>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-text-primary)]">
            {formatBrlFromCents(snapshot.predictedExpensesCents)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Obrigações operacionais com vencimento no filtro
          </div>
        </Card>

        <Card padding="md" className="border-[var(--kz-accent-border)] bg-[var(--kz-accent-soft)]/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--kz-accent-text)]">
              Lucro Realizado (Resultado Gerencial)
            </span>
            <TrendingUp className="w-4 h-4 text-[var(--kz-accent-text)]" />
          </div>
          <div
            className={`mt-2 text-2xl kz-metric ${
              snapshot.realizedProfitCents >= 0
                ? 'text-[var(--kz-success-text)]'
                : 'text-[var(--kz-danger-text)]'
            }`}
          >
            {formatBrlFromCents(snapshot.realizedProfitCents, { signed: true })}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Recebimentos reais menos pagamentos reais no período
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--kz-text-muted)]">
              Saldo de Caixa Realizado
            </span>
            <Landmark className="w-4 h-4 text-[var(--kz-accent)]" />
          </div>
          <div
            className={`mt-2 text-2xl kz-metric ${
              snapshot.cashBalanceCents >= 0
                ? 'text-[var(--kz-text-primary)]'
                : 'text-[var(--kz-danger-text)]'
            }`}
          >
            {formatBrlFromCents(snapshot.cashBalanceCents)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Saldo inicial configurado + movimentações reais
          </div>
        </Card>

        <Card
          padding="md"
          interactive
          className="cursor-pointer"
          onClick={() => onNavigateSubView('contas_a_receber')}
        >
          <span className="text-[11px] font-medium text-[var(--kz-text-muted)] block">
            Contas a Receber (Em Aberto)
          </span>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-info-text)]">
            {formatBrlFromCents(snapshot.accountsReceivableCents)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Saldo líquido pendente de clientes
          </div>
        </Card>

        <Card
          padding="md"
          interactive
          className="cursor-pointer"
          onClick={() => onNavigateSubView('contas_a_pagar')}
        >
          <span className="text-[11px] font-medium text-[var(--kz-text-muted)] block">
            Contas a Pagar (Em Aberto)
          </span>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-warning-text)]">
            {formatBrlFromCents(snapshot.accountsPayableCents)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Obrigações ainda não quitadas
          </div>
        </Card>

        <Card
          padding="md"
          interactive
          className={`cursor-pointer ${
            snapshot.delinquencyCents > 0
              ? 'border-[var(--kz-danger-border)] bg-[var(--kz-danger-bg)]/35'
              : ''
          }`}
          onClick={() => onNavigateSubView('contas_a_receber')}
        >
          <span className="text-[11px] font-semibold text-[var(--kz-danger-text)] block">
            Inadimplência (Recebíveis Vencidos)
          </span>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-danger-text)]">
            {formatBrlFromCents(snapshot.delinquencyCents)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            {snapshot.delinquencyCount}{' '}
            {snapshot.delinquencyCount === 1 ? 'título vencido' : 'títulos vencidos'}
          </div>
        </Card>
      </div>

      {/* Alertas Financeiros Acionáveis (substitui lista genérica) */}
      <Card padding="lg" className="space-y-3">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--kz-warning-text)]" />
              Alertas Financeiros & Vencimentos Críticos
            </CardTitle>
            <CardDescription>
              Acompanhamento direto de títulos atrasados, próximos vencimentos e saldo de caixa.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onOpenNewEntry('receita')}
            >
              Nova Receita
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenNewEntry('despesa')}
            >
              Nova Despesa
            </Button>
          </div>
        </CardHeader>

        {snapshot.alerts.length === 0 ? (
          <div className="py-4 text-xs text-[var(--kz-text-muted)] flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[var(--kz-success-text)]" />
            Nenhum título atrasado ou vencimento crítico no horizonte configurado.
          </div>
        ) : (
          <div className="divide-y divide-[var(--kz-border-subtle)]">
            {snapshot.alerts.map((al) => (
              <div
                key={al.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div
                    className={`text-xs font-semibold ${
                      al.severity === 'danger'
                        ? 'text-[var(--kz-danger-text)]'
                        : 'text-[var(--kz-warning-text)]'
                    }`}
                  >
                    {al.title}
                  </div>
                  <div className="text-[11px] text-[var(--kz-text-muted)]">
                    {al.description}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onNavigateSubView(al.targetSubView)}
                  className="self-start sm:self-center shrink-0"
                >
                  Abrir módulo
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 8 Gráficos Reais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueVsExpenseChart data={snapshot.monthlySeries} />

        <TrendLineChartCard
          title="Evolução do Lucro Realizado"
          subtitle="Resultado gerencial líquido mensal (entradas - saídas)"
          data={snapshot.monthlySeries}
          valueSelector={(p) => p.realizedProfitCents}
          strokeColor="var(--kz-accent)"
          emptyMessage="Sem resultado realizado registrado nos últimos 6 meses."
        />

        <TrendLineChartCard
          title="Evolução do Saldo de Caixa"
          subtitle="Saldo acumulado realizado ao final de cada mês"
          data={snapshot.monthlySeries}
          valueSelector={(p) => p.endingCashBalanceCents}
          strokeColor="var(--kz-info-text)"
          emptyMessage="Sem variação de saldo de caixa registrada."
        />

        <ReceivedVsPendingCard
          receivedCents={snapshot.receivedVsPending.receivedCents}
          pendingOnTimeCents={snapshot.receivedVsPending.pendingOnTimeCents}
          overdueCents={snapshot.receivedVsPending.overdueCents}
        />

        <RankedBarsCard
          title="Receitas por Cliente"
          subtitle="Principais clientes no período filtrado"
          items={snapshot.revenueByClient}
          barColor="var(--kz-success-text)"
          emptyMessage="Nenhuma receita por cliente encontrada no filtro atual."
        />

        <RankedBarsCard
          title="Despesas por Categoria"
          subtitle="Maiores centros de custo operacional"
          items={snapshot.expensesByCategory}
          barColor="var(--kz-danger-text)"
          emptyMessage="Nenhuma despesa registrada no filtro atual."
        />

        <RankedBarsCard
          title="Receitas por Serviço"
          subtitle="Distribuição do faturamento por pacote/serviço"
          items={snapshot.revenueByService}
          barColor="var(--kz-accent)"
          emptyMessage="Nenhuma receita por serviço registrada no filtro atual."
        />

        <TrendLineChartCard
          title="Evolução da Inadimplência"
          subtitle="Saldo vencido em aberto por mês de vencimento"
          data={snapshot.monthlySeries}
          valueSelector={(p) => p.overdueOpenCents}
          strokeColor="var(--kz-danger-text)"
          emptyMessage="Nenhum recebível vencido nos últimos 6 meses."
        />
      </div>
    </div>
  );
};
