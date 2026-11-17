import { FinancialPeriodPreset } from '../../types/finance';

export const KAIZEN_TIMEZONE = 'America/Maceio';

export function buildFinancialId(
  prefix: 'fin' | 'ftx' | 'fcat' | 'frec' | 'faud'
): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rnd}`;
}

export function isValidYmd(ymd?: string): boolean {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function getTodayInTimezone(
  timezone: string = KAIZEN_TIMEZONE,
  date: Date = new Date()
): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback if runtime lacks ICU timezone data
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function addMonthsYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const targetMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const maxDayInMonth = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(d, maxDayInMonth);
  const mm = String(normalizedMonth + 1).padStart(2, '0');
  const dd = String(clampedDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

export function diffDaysYmd(aYmd: string, bYmd: string): number {
  if (!isValidYmd(aYmd) || !isValidYmd(bYmd)) return 0;
  const [ay, am, ad] = aYmd.split('-').map(Number);
  const [by, bm, bd] = bYmd.split('-').map(Number);
  const aMs = Date.UTC(ay, am - 1, ad);
  const bMs = Date.UTC(by, bm - 1, bd);
  return Math.round((aMs - bMs) / 86400000);
}

export function formatDateBr(ymdOrIso?: string): string {
  if (!ymdOrIso) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymdOrIso)) {
    return ymdOrIso.split('-').reverse().join('/');
  }
  const d = new Date(ymdOrIso);
  if (Number.isNaN(d.getTime())) return ymdOrIso;
  return d.toLocaleDateString('pt-BR', { timeZone: KAIZEN_TIMEZONE });
}

export function formatMonthYearBr(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split('-');
  const months = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  return `${months[Number(m) - 1] || m}/${y}`;
}

export function formatBrlFromCents(
  cents: number,
  options?: { compact?: boolean; signed?: boolean }
): string {
  const safeCents = Number.isFinite(cents) ? Math.round(cents) : 0;
  const value = safeCents / 100;
  if (options?.compact && Math.abs(value) >= 1000) {
    const absK = Math.abs(value) / 1000;
    const prefix = safeCents < 0 ? '-' : options.signed && safeCents > 0 ? '+' : '';
    return `${prefix}R$ ${absK.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}k`;
  }
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  if (safeCents < 0) return `-${formatted}`;
  if (options?.signed && safeCents > 0) return `+${formatted}`;
  return formatted;
}

/**
 * Converte entrada monetária em string ou número (em reais) para centavos inteiros.
 * Aceita formatos BR ("1.250,50", "R$ 497,00", "497,5") e ponto decimal ("1250.50").
 * Retorna NaN se inválido.
 */
export function parseBrlToCents(raw: string | number): number {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return NaN;
    return Math.round(raw * 100);
  }
  if (typeof raw !== 'string') return NaN;
  const cleaned = raw.replace(/[R$\s]/g, '').trim();
  if (!cleaned) return NaN;

  const isNegative = cleaned.startsWith('-');
  const unsigned = cleaned.replace(/^[+-]/, '');
  if (!/^[\d.,]+$/.test(unsigned)) return NaN;

  let normalized = unsigned;
  const hasComma = unsigned.includes(',');
  const hasDot = unsigned.includes('.');

  if (hasComma && hasDot) {
    // Formato BR: 1.234,56 -> remove pontos e troca vírgula por ponto
    if (unsigned.lastIndexOf(',') > unsigned.lastIndexOf('.')) {
      normalized = unsigned.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato US: 1,234.56
      normalized = unsigned.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = unsigned.replace(',', '.');
  } else if (hasDot) {
    // Se tiver múltiplos pontos ou exatamente 3 dígitos após ponto (ex: 1.500), trata como milhar
    const parts = unsigned.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      normalized = unsigned.replace(/\./g, '');
    }
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return NaN;
  const cents = Math.round(parsed * 100);
  return isNegative ? -cents : cents;
}

export function centsToInputValue(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  return (safe / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface PeriodRange {
  startDate: string;
  endDate: string;
  label: string;
}

export function resolvePeriodRange(
  preset: FinancialPeriodPreset,
  customStart?: string,
  customEnd?: string,
  referenceYmd: string = getTodayInTimezone()
): PeriodRange {
  const [y, m, d] = referenceYmd.split('-').map(Number);

  switch (preset) {
    case 'hoje':
      return {
        startDate: referenceYmd,
        endDate: referenceYmd,
        label: `Hoje (${formatDateBr(referenceYmd)})`,
      };
    case 'esta_semana': {
      const dt = new Date(Date.UTC(y, m - 1, d));
      const dow = dt.getUTCDay(); // 0=Dom..6=Sab
      const mondayOffset = dow === 0 ? -6 : 1 - dow;
      const startDate = addDaysYmd(referenceYmd, mondayOffset);
      const endDate = addDaysYmd(startDate, 6);
      return {
        startDate,
        endDate,
        label: `Esta semana (${formatDateBr(startDate)} a ${formatDateBr(endDate)})`,
      };
    }
    case 'este_mes': {
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return {
        startDate,
        endDate,
        label: `Este mês (${formatMonthYearBr(`${y}-${String(m).padStart(2, '0')}`)})`,
      };
    }
    case 'mes_anterior': {
      const prevMonthStart = addMonthsYmd(`${y}-${String(m).padStart(2, '0')}-01`, -1);
      const [py, pm] = prevMonthStart.split('-').map(Number);
      const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
      const endDate = `${py}-${String(pm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return {
        startDate: prevMonthStart,
        endDate,
        label: `Mês anterior (${formatMonthYearBr(`${py}-${String(pm).padStart(2, '0')}`)})`,
      };
    }
    case 'ultimos_30_dias': {
      const startDate = addDaysYmd(referenceYmd, -29);
      return {
        startDate,
        endDate: referenceYmd,
        label: 'Últimos 30 dias',
      };
    }
    case 'ultimos_90_dias': {
      const startDate = addDaysYmd(referenceYmd, -89);
      return {
        startDate,
        endDate: referenceYmd,
        label: 'Últimos 90 dias',
      };
    }
    case 'este_trimestre': {
      const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
      const qEndMonth = qStartMonth + 2;
      const startDate = `${y}-${String(qStartMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(Date.UTC(y, qEndMonth, 0)).getUTCDate();
      const endDate = `${y}-${String(qEndMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return {
        startDate,
        endDate,
        label: `${Math.floor((m - 1) / 3) + 1}º Trimestre/${y}`,
      };
    }
    case 'este_semestre': {
      const sStartMonth = m <= 6 ? 1 : 7;
      const sEndMonth = m <= 6 ? 6 : 12;
      const startDate = `${y}-${String(sStartMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(Date.UTC(y, sEndMonth, 0)).getUTCDate();
      const endDate = `${y}-${String(sEndMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return {
        startDate,
        endDate,
        label: `${m <= 6 ? '1º' : '2º'} Semestre/${y}`,
      };
    }
    case 'este_ano': {
      return {
        startDate: `${y}-01-01`,
        endDate: `${y}-12-31`,
        label: `Ano ${y}`,
      };
    }
    case 'personalizado': {
      const startDate = isValidYmd(customStart) ? customStart! : addDaysYmd(referenceYmd, -29);
      const endDate = isValidYmd(customEnd) ? customEnd! : referenceYmd;
      const orderedStart = startDate <= endDate ? startDate : endDate;
      const orderedEnd = startDate <= endDate ? endDate : startDate;
      return {
        startDate: orderedStart,
        endDate: orderedEnd,
        label: `${formatDateBr(orderedStart)} a ${formatDateBr(orderedEnd)}`,
      };
    }
  }
}

export function sanitizeCsvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  // Mitigates CSV formula injection
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildCsvContent(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.map(sanitizeCsvCell).join(';');
  const bodyLines = rows.map((row) => row.map(sanitizeCsvCell).join(';'));
  return `\uFEFF${[headerLine, ...bodyLines].join('\r\n')}`;
}

export function triggerCsvDownload(filename: string, csvContent: string): void {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
