import React from 'react';
import { ArrowDownRight, ArrowUpRight, Info, Minus, Star } from 'lucide-react';
import { Alert, Badge, Card } from '../ui';

export interface AnalyticsKpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  deltaText?: string;
  deltaPositive?: boolean | null;
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onClick?: () => void;
  compact?: boolean;
}

const TONE_VALUE_CLASS: Record<NonNullable<AnalyticsKpiCardProps['tone']>, string> = {
  default: 'text-[var(--kz-text-primary)]',
  accent: 'text-[var(--kz-accent-text)]',
  success: 'text-[var(--kz-success-text)]',
  warning: 'text-[var(--kz-warning-text)]',
  danger: 'text-[var(--kz-danger-text)]',
};

const TONE_BORDER_CLASS: Record<NonNullable<AnalyticsKpiCardProps['tone']>, string> = {
  default: '',
  accent: 'border-[var(--kz-accent-border)] bg-[var(--kz-accent-soft)]/25',
  success: 'border-[var(--kz-success-border)] bg-[var(--kz-success-bg)]/35',
  warning: 'border-[var(--kz-warning-border)] bg-[var(--kz-warning-bg)]/35',
  danger: 'border-[var(--kz-danger-border)] bg-[var(--kz-danger-bg)]/35',
};

export const AnalyticsKpiCard: React.FC<AnalyticsKpiCardProps> = ({
  label,
  value,
  subtitle,
  deltaText,
  deltaPositive,
  tone = 'default',
  isFavorite,
  onToggleFavorite,
  onClick,
  compact = false,
}) => {
  return (
    <Card
      padding={compact ? 'sm' : 'md'}
      interactive={Boolean(onClick)}
      onClick={onClick}
      className={`relative flex flex-col justify-between gap-2 ${
        onClick ? 'cursor-pointer' : ''
      } ${TONE_BORDER_CLASS[tone]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold text-[var(--kz-text-muted)] leading-snug">
          {label}
        </span>
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            title={isFavorite ? 'Remover dos KPIs favoritos' : 'Fixar nos KPIs favoritos'}
            aria-label={isFavorite ? 'Remover dos KPIs favoritos' : 'Fixar nos KPIs favoritos'}
            className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
              isFavorite
                ? 'text-[var(--kz-accent)] bg-[var(--kz-accent-soft)]'
                : 'text-[var(--kz-text-subtle)] hover:text-[var(--kz-text-primary)] hover:bg-[var(--kz-bg-subtle)]'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>

      <div className={`text-xl sm:text-2xl kz-metric leading-tight ${TONE_VALUE_CLASS[tone]}`}>
        {value}
      </div>

      <div className="space-y-1">
        {deltaText && (
          <div className="flex items-center gap-1">
            <Badge
              size="sm"
              variant={
                deltaPositive === true
                  ? 'success'
                  : deltaPositive === false
                  ? 'danger'
                  : 'neutral'
              }
            >
              {deltaPositive === true ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : deltaPositive === false ? (
                <ArrowDownRight className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              {deltaText}
            </Badge>
          </div>
        )}
        {subtitle && (
          <p className="text-[11px] text-[var(--kz-text-muted)] leading-snug">{subtitle}</p>
        )}
      </div>
    </Card>
  );
};

export interface HorizontalBarItem {
  key: string;
  label: string;
  value: number;
  formattedValue?: string;
  secondaryText?: string;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
}

const BAR_FILL_CLASSES: Record<NonNullable<HorizontalBarItem['tone']>, string> = {
  accent: 'bg-[var(--kz-accent)]',
  success: 'bg-[var(--kz-success-solid)]',
  warning: 'bg-[var(--kz-warning-solid)]',
  danger: 'bg-[var(--kz-danger-solid)]',
  neutral: 'bg-[var(--kz-text-muted)]',
};

export const HorizontalBarBreakdown: React.FC<{
  items: HorizontalBarItem[];
  emptyMessage?: string;
  maxItems?: number;
}> = ({ items, emptyMessage = 'Sem registros nesta quebra.', maxItems = 10 }) => {
  const visible = items.slice(0, maxItems);
  const maxValue = visible.reduce((max, item) => Math.max(max, item.value), 0);

  if (visible.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-[var(--kz-text-muted)]">{emptyMessage}</div>
    );
  }

  return (
    <div className="space-y-2.5">
      {visible.map((item) => {
        const pct = maxValue > 0 ? Math.max(2, Math.round((item.value / maxValue) * 100)) : 0;
        const barTone = item.tone || 'accent';
        return (
          <div key={item.key} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[var(--kz-text-primary)] font-medium truncate">
                {item.label}
              </span>
              <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                {item.secondaryText && (
                  <span className="text-[11px] text-[var(--kz-text-muted)]">
                    {item.secondaryText}
                  </span>
                )}
                <span className="font-semibold text-[var(--kz-text-primary)]">
                  {item.formattedValue ?? item.value}
                </span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--kz-bg-subtle)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${BAR_FILL_CLASSES[barTone]}`}
                style={{ width: `${item.value > 0 ? pct : 0}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export interface DualBarSeriesPoint {
  key: string;
  label: string;
  valueA: number;
  valueB: number;
  tooltipA?: string;
  tooltipB?: string;
}

export const DualBarTimeSeriesChart: React.FC<{
  points: DualBarSeriesPoint[];
  labelA: string;
  labelB: string;
  colorA?: string;
  colorB?: string;
  emptyMessage?: string;
  formatValue?: (val: number) => string;
}> = ({
  points,
  labelA,
  labelB,
  colorA = '#C6A15B',
  colorB = '#34D399',
  emptyMessage = 'Sem dados temporais para o período selecionado.',
  formatValue = (v) => String(v),
}) => {
  const maxVal = points.reduce(
    (max, pt) => Math.max(max, Math.abs(pt.valueA), Math.abs(pt.valueB)),
    0
  );

  if (points.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-[var(--kz-text-muted)]">{emptyMessage}</div>
    );
  }

  const labelStep = points.length > 16 ? Math.ceil(points.length / 10) : 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-[var(--kz-text-secondary)]">
            <span
              className="w-2.5 h-2.5 rounded-xs inline-block"
              style={{ backgroundColor: colorA }}
            />
            {labelA}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--kz-text-secondary)]">
            <span
              className="w-2.5 h-2.5 rounded-xs inline-block"
              style={{ backgroundColor: colorB }}
            />
            {labelB}
          </span>
        </div>
        <span className="text-[var(--kz-text-muted)] font-mono tabular-nums">
          Pico: {formatValue(maxVal)}
        </span>
      </div>

      <div className="w-full overflow-x-auto pb-1">
        <div className="min-w-[340px] flex items-end gap-1.5 h-44 pt-4 px-1 border-b border-[var(--kz-border-subtle)]">
          {points.map((pt, idx) => {
            const hA = maxVal > 0 ? Math.round((Math.abs(pt.valueA) / maxVal) * 100) : 0;
            const hB = maxVal > 0 ? Math.round((Math.abs(pt.valueB) / maxVal) * 100) : 0;
            const showLabel = idx % labelStep === 0 || idx === points.length - 1;

            return (
              <div
                key={pt.key}
                className="flex-1 min-w-[14px] h-full flex flex-col justify-end items-center gap-1 group"
              >
                <div className="w-full flex-1 flex items-end justify-center gap-0.5 px-0.5">
                  <div
                    className="flex-1 max-w-[14px] rounded-t-sm transition-all duration-200 opacity-90 group-hover:opacity-100"
                    style={{
                      height: `${pt.valueA !== 0 ? Math.max(4, hA) : 0}%`,
                      backgroundColor: colorA,
                    }}
                    title={`${pt.label} · ${labelA}: ${pt.tooltipA || formatValue(pt.valueA)}`}
                  />
                  <div
                    className="flex-1 max-w-[14px] rounded-t-sm transition-all duration-200 opacity-90 group-hover:opacity-100"
                    style={{
                      height: `${pt.valueB !== 0 ? Math.max(4, hB) : 0}%`,
                      backgroundColor: colorB,
                    }}
                    title={`${pt.label} · ${labelB}: ${pt.tooltipB || formatValue(pt.valueB)}`}
                  />
                </div>
                <span className="text-[9px] font-mono text-[var(--kz-text-muted)] h-4 flex items-center whitespace-nowrap">
                  {showLabel ? pt.label : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const DataLimitationBanner: React.FC<{
  title?: string;
  message: string;
  visible?: boolean;
  alwaysShow?: boolean;
}> = ({
  title = 'Transparência dos Dados',
  message,
  visible = true,
  alwaysShow = false,
}) => {
  if (!alwaysShow && !visible) return null;
  return (
    <Alert variant="info" title={title}>
      <div className="flex items-start gap-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 hidden" />
        <span>{message}</span>
      </div>
    </Alert>
  );
};
