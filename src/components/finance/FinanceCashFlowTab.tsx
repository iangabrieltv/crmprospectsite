import React, { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import {
  Alert,
  Badge,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
} from '../ui';
import {
  CashFlowGranularity,
  FinancialEntry,
  FinancialSettings,
  FinancialTransaction,
} from '../../types/finance';
import {
  KAIZEN_TIMEZONE,
  computeCashFlow,
  formatBrlFromCents,
  formatDateBr,
  getTodayInTimezone,
} from '../../services/finance';

interface FinanceCashFlowTabProps {
  entries: FinancialEntry[];
  transactions: FinancialTransaction[];
  settings: FinancialSettings;
  startDate: string;
  endDate: string;
  periodLabel: string;
  onGoToSettings: () => void;
}

export const FinanceCashFlowTab: React.FC<FinanceCashFlowTabProps> = ({
  entries,
  transactions,
  settings,
  startDate,
  endDate,
  periodLabel,
  onGoToSettings,
}) => {
  const [granularity, setGranularity] = useState<CashFlowGranularity>('mensal');
  const [movementModeFilter, setMovementModeFilter] = useState<
    'todos' | 'realizado' | 'projetado'
  >('todos');
  const todayStr = getTodayInTimezone(settings.timezone || KAIZEN_TIMEZONE);

  const cashFlow = useMemo(
    () =>
      computeCashFlow({
        entries,
        transactions,
        settings,
        startDate,
        endDate,
        granularity,
        todayStr,
      }),
    [entries, transactions, settings, startDate, endDate, granularity, todayStr]
  );

  const visibleMovements = useMemo(
    () =>
      cashFlow.movements.filter((m) =>
        movementModeFilter === 'todos' ? true : m.mode === movementModeFilter
      ),
    [cashFlow.movements, movementModeFilter]
  );

  // Coordenadas do gráfico SVG Realizado x Projetado
  const chartPoints = useMemo(() => {
    const b = cashFlow.buckets;
    const allVals = b.flatMap((x) => [
      x.realizedBalanceCents,
      x.projectedBalanceCents,
    ]);
    const minVal = Math.min(0, ...allVals);
    const maxVal = Math.max(100, ...allVals);
    const span = Math.max(1, maxVal - minVal);
    return {
      minVal,
      zeroY: 132 - ((0 - minVal) / span) * 104,
      items: b.map((item, idx) => {
        const x = b.length <= 1 ? 260 : 28 + (idx / (b.length - 1)) * 464;
        const ry = 132 - ((item.realizedBalanceCents - minVal) / span) * 104;
        const py = 132 - ((item.projectedBalanceCents - minVal) / span) * 104;
        return { ...item, x, ry, py };
      }),
    };
  }, [cashFlow.buckets]);

  return (
    <div className="space-y-5">
      <Alert variant="info">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span>
            <Info className="w-3.5 h-3.5 inline mr-1.5" />
            <strong>Separação rígida:</strong> o fluxo <strong>Realizado</strong> considera
            exclusivamente movimentações confirmadas + saldo inicial (
            {formatBrlFromCents(settings.openingBalanceCents)} em{' '}
            {formatDateBr(settings.openingBalanceDate)}). O <strong>Projetado</strong> soma os
            saldos em aberto previstos para o intervalo. O saldo inicial não entra como receita
            operacional.
          </span>
          <button
            type="button"
            onClick={onGoToSettings}
            className="text-[var(--kz-accent-text)] font-semibold hover:underline shrink-0 cursor-pointer"
          >
            Ajustar saldo inicial
          </button>
        </div>
      </Alert>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card padding="md">
          <span className="text-[11px] font-medium text-[var(--kz-text-muted)] block">
            Saldo no Início do Período
          </span>
          <div className="mt-1.5 text-xl kz-metric text-[var(--kz-text-primary)]">
            {formatBrlFromCents(cashFlow.openingBalanceInPeriodCents)}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5">
            {periodLabel}
          </div>
        </Card>

        <Card padding="md">
          <span className="text-[11px] font-medium text-[var(--kz-text-muted)] block">
            Realizado no Período (Entradas − Saídas)
          </span>
          <div
            className={`mt-1.5 text-xl kz-metric ${
              cashFlow.realizedNetCents >= 0
                ? 'text-[var(--kz-success-text)]'
                : 'text-[var(--kz-danger-text)]'
            }`}
          >
            {formatBrlFromCents(cashFlow.realizedNetCents, { signed: true })}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5 font-mono">
            +{formatBrlFromCents(cashFlow.realizedInflowCents)} / -
            {formatBrlFromCents(cashFlow.realizedOutflowCents)}
          </div>
        </Card>

        <Card padding="md">
          <span className="text-[11px] font-medium text-[var(--kz-text-muted)] block">
            Saldo Realizado Final
          </span>
          <div className="mt-1.5 text-xl kz-metric text-[var(--kz-text-primary)]">
            {formatBrlFromCents(cashFlow.realizedClosingBalanceCents)}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5">
            Saldo em caixa atual: {formatBrlFromCents(cashFlow.currentRealizedCashBalanceCents)}
          </div>
        </Card>

        <Card padding="md" className="border-[var(--kz-accent-border)] bg-[var(--kz-accent-soft)]/30">
          <span className="text-[11px] font-bold text-[var(--kz-accent-text)] block">
            Saldo Projetado Final (Previsto)
          </span>
          <div className="mt-1.5 text-xl kz-metric text-[var(--kz-accent-text)]">
            {formatBrlFromCents(cashFlow.projectedClosingBalanceCents)}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5 font-mono">
            Em aberto: +{formatBrlFromCents(cashFlow.projectedInflowCents)} / -
            {formatBrlFromCents(cashFlow.projectedOutflowCents)}
          </div>
        </Card>
      </div>

      {/* Seletor de granularidade + Gráfico */}
      <Card padding="lg" className="space-y-4">
        <CardHeader>
          <div>
            <CardTitle>Evolução Realizada vs Projetada</CardTitle>
            <CardDescription>
              Visão {granularity} de saldo acumulado para {periodLabel}
            </CardDescription>
          </div>
          <Tabs<CashFlowGranularity>
            activeId={granularity}
            onChange={setGranularity}
            items={[
              { id: 'diario', label: 'Diário' },
              { id: 'semanal', label: 'Semanal' },
              { id: 'mensal', label: 'Mensal' },
              { id: 'anual', label: 'Anual' },
            ]}
          />
        </CardHeader>

        {chartPoints.items.length === 0 ? (
          <div className="py-10 text-center text-xs text-[var(--kz-text-muted)]">
            Sem períodos disponíveis para o intervalo informado.
          </div>
        ) : (
          <div className="space-y-2">
            <svg viewBox="0 0 520 165" className="w-full h-48 overflow-visible">
              <line
                x1={16}
                x2={504}
                y1={chartPoints.zeroY}
                y2={chartPoints.zeroY}
                stroke="var(--kz-border-default)"
                strokeDasharray="4 3"
              />
              {chartPoints.items.length > 1 && (
                <>
                  <polyline
                    fill="none"
                    stroke="var(--kz-accent)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    points={chartPoints.items.map((p) => `${p.x},${p.py}`).join(' ')}
                  />
                  <polyline
                    fill="none"
                    stroke="var(--kz-success-text)"
                    strokeWidth={2.5}
                    points={chartPoints.items.map((p) => `${p.x},${p.ry}`).join(' ')}
                  />
                </>
              )}
              {chartPoints.items.map((pt, idx) => (
                <g key={pt.key}>
                  <circle cx={pt.x} cy={pt.py} r={3} fill="var(--kz-accent)" />
                  <circle cx={pt.x} cy={pt.ry} r={3.5} fill="var(--kz-success-text)" />
                  {(chartPoints.items.length <= 12 ||
                    idx % Math.ceil(chartPoints.items.length / 10) === 0) && (
                    <text
                      x={pt.x}
                      y={154}
                      textAnchor="middle"
                      fill="var(--kz-text-muted)"
                      fontSize={9.5}
                    >
                      {pt.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>
            <div className="flex items-center justify-end gap-4 text-[11px] text-[var(--kz-text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[var(--kz-success-text)]" /> Saldo Realizado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[var(--kz-accent)] border-b border-dashed" /> Saldo
                Projetado
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Tabela por período */}
      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Entradas Realiz.</TableHead>
              <TableHead className="text-right">Saídas Realiz.</TableHead>
              <TableHead className="text-right">Saldo Realizado</TableHead>
              <TableHead className="text-right">Entradas Prev.</TableHead>
              <TableHead className="text-right">Saídas Prev.</TableHead>
              <TableHead className="text-right">Saldo Projetado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="font-mono tabular-nums text-xs">
            {cashFlow.buckets.map((b) => (
              <TableRow key={b.key}>
                <TableCell className="font-sans font-semibold text-[var(--kz-text-primary)]">
                  {b.label}
                </TableCell>
                <TableCell className="text-right text-[var(--kz-success-text)]">
                  {formatBrlFromCents(b.realizedInflowCents)}
                </TableCell>
                <TableCell className="text-right text-[var(--kz-danger-text)]">
                  {formatBrlFromCents(b.realizedOutflowCents)}
                </TableCell>
                <TableCell className="text-right font-bold text-[var(--kz-text-primary)]">
                  {formatBrlFromCents(b.realizedBalanceCents)}
                </TableCell>
                <TableCell className="text-right text-[var(--kz-info-text)]">
                  {formatBrlFromCents(b.projectedInflowCents)}
                </TableCell>
                <TableCell className="text-right text-[var(--kz-warning-text)]">
                  {formatBrlFromCents(b.projectedOutflowCents)}
                </TableCell>
                <TableCell className="text-right font-bold text-[var(--kz-accent-text)]">
                  {formatBrlFromCents(b.projectedBalanceCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Razão detalhado do período */}
      <Card padding="lg" className="space-y-3">
        <CardHeader>
          <div>
            <CardTitle>Detalhamento de Movimentações no Fluxo</CardTitle>
            <CardDescription>
              {visibleMovements.length} registro(s) entre {formatDateBr(startDate)} e{' '}
              {formatDateBr(endDate)}
            </CardDescription>
          </div>
          <Select
            className="w-48"
            value={movementModeFilter}
            onChange={(e) =>
              setMovementModeFilter(
                e.target.value as 'todos' | 'realizado' | 'projetado'
              )
            }
          >
            <option value="todos">Realizado + Projetado</option>
            <option value="realizado">Somente Realizado</option>
            <option value="projetado">Somente Projetado (Em aberto)</option>
          </Select>
        </CardHeader>

        {visibleMovements.length === 0 ? (
          <p className="text-xs text-[var(--kz-text-muted)] py-3">
            Nenhuma movimentação encontrada para este filtro.
          </p>
        ) : (
          <div className="divide-y divide-[var(--kz-border-subtle)] max-h-80 overflow-y-auto">
            {visibleMovements.map((m) => (
              <div
                key={m.id}
                className="py-2 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-[var(--kz-text-primary)] truncate">
                    {m.description}
                  </div>
                  <div className="text-[11px] text-[var(--kz-text-muted)]">
                    {formatDateBr(m.date)} · {m.kind === 'receita' ? 'Receita' : 'Despesa'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={m.mode === 'realizado' ? 'success' : 'accent'}>
                    {m.mode === 'realizado' ? 'Realizado' : 'Projetado'}
                  </Badge>
                  <span
                    className={`font-mono font-bold ${
                      m.amountCents >= 0
                        ? 'text-[var(--kz-success-text)]'
                        : 'text-[var(--kz-danger-text)]'
                    }`}
                  >
                    {formatBrlFromCents(m.amountCents, { signed: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
