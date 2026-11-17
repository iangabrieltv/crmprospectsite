import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui';
import {
  CategorySlicePoint,
  MonthlyComparisonPoint,
  formatBrlFromCents,
} from '../../services/finance';

interface EmptyChartProps {
  message: string;
}

const EmptyChartState: React.FC<EmptyChartProps> = ({ message }) => (
  <div className="h-44 flex items-center justify-center text-xs text-[var(--kz-text-muted)] text-center px-4">
    {message}
  </div>
);

/**
 * Gráfico 1: Receitas x Despesas realizadas mês a mês (barras agrupadas SVG).
 */
export const RevenueVsExpenseChart: React.FC<{ data: MonthlyComparisonPoint[] }> = ({
  data,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxVal = Math.max(
    100,
    ...data.flatMap((d) => [d.realizedRevenueCents, d.realizedExpenseCents])
  );
  const hasAnyValue = data.some(
    (d) => d.realizedRevenueCents > 0 || d.realizedExpenseCents > 0
  );

  return (
    <Card padding="md" className="space-y-3">
      <CardHeader className="mb-1">
        <div>
          <CardTitle>Receitas x Despesas Realizadas</CardTitle>
          <CardDescription>Últimos 6 meses em regime de caixa</CardDescription>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--kz-text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[var(--kz-success-solid)]" />
            Receitas
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[var(--kz-danger-solid)]" />
            Despesas
          </span>
        </div>
      </CardHeader>

      {!hasAnyValue ? (
        <EmptyChartState message="Sem recebimentos ou pagamentos confirmados nos últimos 6 meses." />
      ) : (
        <div className="space-y-2">
          <svg viewBox="0 0 420 170" className="w-full h-44 overflow-visible">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = 140 - t * 116;
              return (
                <line
                  key={t}
                  x1={10}
                  x2={410}
                  y1={y}
                  y2={y}
                  stroke="var(--kz-border-subtle)"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              );
            })}
            {data.map((d, idx) => {
              const colW = 400 / Math.max(1, data.length);
              const centerX = 10 + idx * colW + colW / 2;
              const revH = Math.max(2, (d.realizedRevenueCents / maxVal) * 116);
              const expH = Math.max(2, (d.realizedExpenseCents / maxVal) * 116);
              const isHover = hoveredIdx === idx;
              return (
                <g
                  key={d.ym}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  {isHover && (
                    <rect
                      x={centerX - 24}
                      y={16}
                      width={48}
                      height={126}
                      rx={6}
                      fill="var(--kz-bg-subtle)"
                      opacity={0.7}
                    />
                  )}
                  <rect
                    x={centerX - 15}
                    y={140 - revH}
                    width={13}
                    height={d.realizedRevenueCents > 0 ? revH : 0}
                    rx={3}
                    fill="var(--kz-success-text)"
                  />
                  <rect
                    x={centerX + 2}
                    y={140 - expH}
                    width={13}
                    height={d.realizedExpenseCents > 0 ? expH : 0}
                    rx={3}
                    fill="var(--kz-danger-text)"
                  />
                  <text
                    x={centerX}
                    y={158}
                    textAnchor="middle"
                    fill="var(--kz-text-muted)"
                    fontSize={10}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
          {hoveredIdx !== null && data[hoveredIdx] && (
            <div className="text-[11px] font-mono tabular-nums text-[var(--kz-text-secondary)] flex flex-wrap items-center justify-between gap-2 bg-[var(--kz-bg-subtle)] px-3 py-1.5 rounded-lg border border-[var(--kz-border-subtle)]">
              <span className="font-sans font-semibold text-[var(--kz-text-primary)]">
                {data[hoveredIdx].label}
              </span>
              <span>
                Receitas: <strong className="text-[var(--kz-success-text)]">{formatBrlFromCents(data[hoveredIdx].realizedRevenueCents)}</strong>
                {' · '}
                Despesas: <strong className="text-[var(--kz-danger-text)]">{formatBrlFromCents(data[hoveredIdx].realizedExpenseCents)}</strong>
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

/**
 * Gráficos 2, 3 e 8: Evolução em linha SVG (Lucro, Saldo de Caixa ou Inadimplência).
 */
export const TrendLineChartCard: React.FC<{
  title: string;
  subtitle: string;
  data: MonthlyComparisonPoint[];
  valueSelector: (p: MonthlyComparisonPoint) => number;
  strokeColor: string;
  emptyMessage: string;
}> = ({ title, subtitle, data, valueSelector, strokeColor, emptyMessage }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const values = data.map(valueSelector);
  const hasData = values.some((v) => v !== 0);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(100, ...values);
  const span = Math.max(1, maxVal - minVal);

  const points = data.map((d, idx) => {
    const x =
      data.length <= 1
        ? 210
        : 24 + (idx / (data.length - 1)) * 372;
    const val = values[idx];
    const y = 132 - ((val - minVal) / span) * 104;
    return { x, y, val, label: d.label, ym: d.ym };
  });

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  const zeroY = 132 - ((0 - minVal) / span) * 104;

  return (
    <Card padding="md" className="space-y-3">
      <CardHeader className="mb-1">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </div>
      </CardHeader>

      {!hasData ? (
        <EmptyChartState message={emptyMessage} />
      ) : (
        <div className="space-y-2">
          <svg viewBox="0 0 420 165" className="w-full h-44 overflow-visible">
            <line
              x1={14}
              x2={406}
              y1={zeroY}
              y2={zeroY}
              stroke="var(--kz-border-default)"
              strokeDasharray="4 3"
              strokeWidth={1}
            />
            {points.length > 1 && (
              <polyline
                fill="none"
                stroke={strokeColor}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polylineStr}
              />
            )}
            {points.map((pt, idx) => (
              <g
                key={pt.ym}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredIdx === idx ? 5.5 : 3.5}
                  fill={strokeColor}
                  stroke="var(--kz-bg-surface)"
                  strokeWidth={2}
                />
                <text
                  x={pt.x}
                  y={155}
                  textAnchor="middle"
                  fill="var(--kz-text-muted)"
                  fontSize={10}
                >
                  {pt.label}
                </text>
              </g>
            ))}
          </svg>
          {hoveredIdx !== null && points[hoveredIdx] && (
            <div className="text-[11px] font-mono tabular-nums flex items-center justify-between bg-[var(--kz-bg-subtle)] px-3 py-1.5 rounded-lg border border-[var(--kz-border-subtle)]">
              <span className="font-sans font-semibold text-[var(--kz-text-primary)]">
                {points[hoveredIdx].label}
              </span>
              <span className="font-bold text-[var(--kz-text-primary)]">
                {formatBrlFromCents(points[hoveredIdx].val, { signed: minVal < 0 })}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

/**
 * Gráficos 4, 5 e 6: Ranking em barras horizontais (Receitas por cliente, Despesas por categoria, Receitas por serviço).
 */
export const RankedBarsCard: React.FC<{
  title: string;
  subtitle: string;
  items: CategorySlicePoint[];
  barColor: string;
  emptyMessage: string;
}> = ({ title, subtitle, items, barColor, emptyMessage }) => {
  const maxCents = Math.max(1, ...items.map((i) => i.amountCents));

  return (
    <Card padding="md" className="space-y-3">
      <CardHeader className="mb-1">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </div>
      </CardHeader>

      {items.length === 0 ? (
        <EmptyChartState message={emptyMessage} />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const widthPct = Math.max(4, Math.round((item.amountCents / maxCents) * 100));
            return (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[var(--kz-text-primary)] font-medium truncate">
                    {item.name}
                  </span>
                  <span className="font-mono tabular-nums text-[var(--kz-text-secondary)] shrink-0">
                    {formatBrlFromCents(item.amountCents)} · {item.percent}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--kz-bg-subtle)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

/**
 * Gráfico 7: Valores Recebidos x Pendentes no Prazo x Vencidos.
 */
export const ReceivedVsPendingCard: React.FC<{
  receivedCents: number;
  pendingOnTimeCents: number;
  overdueCents: number;
}> = ({ receivedCents, pendingOnTimeCents, overdueCents }) => {
  const total = receivedCents + pendingOnTimeCents + overdueCents;
  const rPct = total > 0 ? Math.round((receivedCents / total) * 100) : 0;
  const pPct = total > 0 ? Math.round((pendingOnTimeCents / total) * 100) : 0;
  const oPct = total > 0 ? Math.max(0, 100 - rPct - pPct) : 0;

  return (
    <Card padding="md" className="space-y-3">
      <CardHeader className="mb-1">
        <div>
          <CardTitle>Recebidos x Pendentes no Período</CardTitle>
          <CardDescription>Composição das receitas com vencimento no filtro</CardDescription>
        </div>
      </CardHeader>

      {total === 0 ? (
        <EmptyChartState message="Nenhuma receita com vencimento dentro do período selecionado." />
      ) : (
        <div className="space-y-4 pt-1">
          <div className="w-full h-4 rounded-full bg-[var(--kz-bg-subtle)] overflow-hidden flex">
            {receivedCents > 0 && (
              <div
                style={{ width: `${rPct}%`, backgroundColor: 'var(--kz-success-text)' }}
                title={`Recebido: ${formatBrlFromCents(receivedCents)}`}
              />
            )}
            {pendingOnTimeCents > 0 && (
              <div
                style={{ width: `${pPct}%`, backgroundColor: 'var(--kz-info-text)' }}
                title={`A vencer: ${formatBrlFromCents(pendingOnTimeCents)}`}
              />
            )}
            {overdueCents > 0 && (
              <div
                style={{ width: `${oPct}%`, backgroundColor: 'var(--kz-danger-text)' }}
                title={`Vencido: ${formatBrlFromCents(overdueCents)}`}
              />
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[var(--kz-text-secondary)]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[var(--kz-success-text)]" />
                Recebidos
              </span>
              <span className="font-mono tabular-nums font-semibold text-[var(--kz-success-text)]">
                {formatBrlFromCents(receivedCents)} ({rPct}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[var(--kz-text-secondary)]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[var(--kz-info-text)]" />
                Pendentes no prazo
              </span>
              <span className="font-mono tabular-nums font-semibold text-[var(--kz-info-text)]">
                {formatBrlFromCents(pendingOnTimeCents)} ({pPct}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[var(--kz-text-secondary)]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[var(--kz-danger-text)]" />
                Vencidos / Em atraso
              </span>
              <span className="font-mono tabular-nums font-semibold text-[var(--kz-danger-text)]">
                {formatBrlFromCents(overdueCents)} ({oPct}%)
              </span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
