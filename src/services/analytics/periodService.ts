import {
  AnalyticsPeriodPreset,
  ResolvedAnalyticsPeriod,
} from '../../types/analytics';
import {
  KAIZEN_TIMEZONE,
  addDaysYmd,
  addMonthsYmd,
  diffDaysYmd,
  formatDateBr,
  formatMonthYearBr,
  getTodayInTimezone,
  isValidYmd,
} from '../finance/money';

/**
 * Converte string YYYY-MM-DD ou timestamp ISO-8601 para data local (YYYY-MM-DD)
 * no fuso oficial da Kaizen (America/Maceio), preservando YYYY-MM-DD puros.
 */
export function extractLocalYmd(
  dateOrIso?: string,
  timezone: string = KAIZEN_TIMEZONE
): string | null {
  if (!dateOrIso || typeof dateOrIso !== 'string') return null;
  const trimmed = dateOrIso.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isValidYmd(trimmed) ? trimmed : null;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return getTodayInTimezone(timezone, parsed);
}

/**
 * Verifica se uma data (YYYY-MM-DD ou ISO-8601) pertence ao intervalo fechado [startDate, endDate]
 * considerando o fuso America/Maceio.
 */
export function isDateInRange(
  dateOrIso: string | undefined,
  startDate: string,
  endDate: string,
  timezone: string = KAIZEN_TIMEZONE
): boolean {
  const ymd = extractLocalYmd(dateOrIso, timezone);
  if (!ymd) return false;
  return ymd >= startDate && ymd <= endDate;
}

/**
 * Enumera todos os 10 presets de período do módulo de Relatórios & Inteligência
 * e resolve também o período anterior equivalente para comparações honestas.
 */
export function resolveAnalyticsPeriod(params: {
  preset: AnalyticsPeriodPreset;
  customStart?: string;
  customEnd?: string;
  referenceYmd?: string;
  timezone?: string;
}): ResolvedAnalyticsPeriod {
  const timezone = params.timezone || KAIZEN_TIMEZONE;
  const todayStr = params.referenceYmd || getTodayInTimezone(timezone);
  const [y, m] = todayStr.split('-').map(Number);

  let startDate = todayStr;
  let endDate = todayStr;
  let label = '';
  let previousStartDate = todayStr;
  let previousEndDate = todayStr;
  let previousLabel = '';

  switch (params.preset) {
    case 'hoje': {
      startDate = todayStr;
      endDate = todayStr;
      label = `Hoje (${formatDateBr(todayStr)})`;
      previousStartDate = addDaysYmd(todayStr, -1);
      previousEndDate = previousStartDate;
      previousLabel = `Ontem (${formatDateBr(previousStartDate)})`;
      break;
    }

    case 'ontem': {
      const yesterday = addDaysYmd(todayStr, -1);
      startDate = yesterday;
      endDate = yesterday;
      label = `Ontem (${formatDateBr(yesterday)})`;
      previousStartDate = addDaysYmd(yesterday, -1);
      previousEndDate = previousStartDate;
      previousLabel = `Anteontem (${formatDateBr(previousStartDate)})`;
      break;
    }

    case 'ultimos_7_dias': {
      startDate = addDaysYmd(todayStr, -6);
      endDate = todayStr;
      label = `Últimos 7 dias (${formatDateBr(startDate)} a ${formatDateBr(endDate)})`;
      previousEndDate = addDaysYmd(startDate, -1);
      previousStartDate = addDaysYmd(previousEndDate, -6);
      previousLabel = `7 dias anteriores (${formatDateBr(previousStartDate)} a ${formatDateBr(
        previousEndDate
      )})`;
      break;
    }

    case 'ultimos_30_dias': {
      startDate = addDaysYmd(todayStr, -29);
      endDate = todayStr;
      label = `Últimos 30 dias (${formatDateBr(startDate)} a ${formatDateBr(endDate)})`;
      previousEndDate = addDaysYmd(startDate, -1);
      previousStartDate = addDaysYmd(previousEndDate, -29);
      previousLabel = `30 dias anteriores (${formatDateBr(previousStartDate)} a ${formatDateBr(
        previousEndDate
      )})`;
      break;
    }

    case 'este_mes': {
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      startDate = `${ym}-01`;
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      endDate = `${ym}-${String(lastDay).padStart(2, '0')}`;
      label = `Este mês (${formatMonthYearBr(ym)})`;

      const prevMonthStart = addMonthsYmd(`${ym}-01`, -1);
      const [py, pm] = prevMonthStart.split('-').map(Number);
      const prevLastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
      previousStartDate = prevMonthStart;
      previousEndDate = `${py}-${String(pm).padStart(2, '0')}-${String(prevLastDay).padStart(
        2,
        '0'
      )}`;
      previousLabel = `Mês anterior (${formatMonthYearBr(prevMonthStart.slice(0, 7))})`;
      break;
    }

    case 'mes_anterior': {
      const prevMonthStart = addMonthsYmd(`${y}-${String(m).padStart(2, '0')}-01`, -1);
      const [py, pm] = prevMonthStart.split('-').map(Number);
      const prevLastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
      startDate = prevMonthStart;
      endDate = `${py}-${String(pm).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;
      label = `Mês anterior (${formatMonthYearBr(prevMonthStart.slice(0, 7))})`;

      const twoMonthsAgoStart = addMonthsYmd(prevMonthStart, -1);
      const [py2, pm2] = twoMonthsAgoStart.split('-').map(Number);
      const lastDay2 = new Date(Date.UTC(py2, pm2, 0)).getUTCDate();
      previousStartDate = twoMonthsAgoStart;
      previousEndDate = `${py2}-${String(pm2).padStart(2, '0')}-${String(lastDay2).padStart(
        2,
        '0'
      )}`;
      previousLabel = `2 meses atrás (${formatMonthYearBr(twoMonthsAgoStart.slice(0, 7))})`;
      break;
    }

    case 'ultimos_90_dias': {
      startDate = addDaysYmd(todayStr, -89);
      endDate = todayStr;
      label = `Últimos 3 meses / 90 dias (${formatDateBr(startDate)} a ${formatDateBr(endDate)})`;
      previousEndDate = addDaysYmd(startDate, -1);
      previousStartDate = addDaysYmd(previousEndDate, -89);
      previousLabel = `90 dias anteriores (${formatDateBr(previousStartDate)} a ${formatDateBr(
        previousEndDate
      )})`;
      break;
    }

    case 'este_semestre': {
      const sStartMonth = m <= 6 ? 1 : 7;
      const sEndMonth = m <= 6 ? 6 : 12;
      startDate = `${y}-${String(sStartMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(Date.UTC(y, sEndMonth, 0)).getUTCDate();
      endDate = `${y}-${String(sEndMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      label = `${m <= 6 ? '1º' : '2º'} Semestre/${y}`;

      const prevSemStart = addMonthsYmd(startDate, -6);
      const [psy, psm] = prevSemStart.split('-').map(Number);
      const prevSemEndMonth = psm + 5;
      const prevSemLastDay = new Date(Date.UTC(psy, prevSemEndMonth, 0)).getUTCDate();
      previousStartDate = prevSemStart;
      previousEndDate = `${psy}-${String(prevSemEndMonth).padStart(2, '0')}-${String(
        prevSemLastDay
      ).padStart(2, '0')}`;
      previousLabel = `${psm === 1 ? '1º' : '2º'} Semestre/${psy}`;
      break;
    }

    case 'este_ano': {
      startDate = `${y}-01-01`;
      endDate = `${y}-12-31`;
      label = `Este ano (${y})`;
      previousStartDate = `${y - 1}-01-01`;
      previousEndDate = `${y - 1}-12-31`;
      previousLabel = `Ano anterior (${y - 1})`;
      break;
    }

    case 'personalizado': {
      const rawStart = isValidYmd(params.customStart)
        ? params.customStart!
        : addDaysYmd(todayStr, -29);
      const rawEnd = isValidYmd(params.customEnd) ? params.customEnd! : todayStr;
      startDate = rawStart <= rawEnd ? rawStart : rawEnd;
      endDate = rawStart <= rawEnd ? rawEnd : rawStart;
      label = `${formatDateBr(startDate)} a ${formatDateBr(endDate)}`;

      const spanDays = Math.max(1, diffDaysYmd(endDate, startDate) + 1);
      previousEndDate = addDaysYmd(startDate, -1);
      previousStartDate = addDaysYmd(previousEndDate, -(spanDays - 1));
      previousLabel = `${formatDateBr(previousStartDate)} a ${formatDateBr(previousEndDate)}`;
      break;
    }
  }

  const daysCount = Math.max(1, diffDaysYmd(endDate, startDate) + 1);
  const granularity: 'diario' | 'semanal' | 'mensal' =
    daysCount <= 21 ? 'diario' : daysCount <= 95 ? 'semanal' : 'mensal';

  return {
    preset: params.preset,
    startDate,
    endDate,
    label,
    daysCount,
    granularity,
    previousStartDate,
    previousEndDate,
    previousLabel,
  };
}

export interface PeriodTimeBucket {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

/**
 * Gera buckets temporais contínuos dentro de um intervalo fechado [startDate, endDate]
 * para gráficos de evolução em qualquer módulo (Comercial, Operacional, Social, Produtividade).
 */
export function buildTimeBucketsForPeriod(
  period: Pick<ResolvedAnalyticsPeriod, 'startDate' | 'endDate' | 'granularity'>
): PeriodTimeBucket[] {
  const buckets: PeriodTimeBucket[] = [];
  const { startDate, endDate, granularity } = period;

  if (granularity === 'diario') {
    let cursor = startDate;
    let guard = 0;
    while (cursor <= endDate && guard < 120) {
      buckets.push({
        key: cursor,
        label: formatDateBr(cursor).slice(0, 5),
        startDate: cursor,
        endDate: cursor,
      });
      cursor = addDaysYmd(cursor, 1);
      guard++;
    }
    return buckets;
  }

  if (granularity === 'semanal') {
    let cursor = startDate;
    let guard = 0;
    while (cursor <= endDate && guard < 60) {
      const candidateEnd = addDaysYmd(cursor, 6);
      const bucketEnd = candidateEnd <= endDate ? candidateEnd : endDate;
      buckets.push({
        key: cursor,
        label: `${formatDateBr(cursor).slice(0, 5)}`,
        startDate: cursor,
        endDate: bucketEnd,
      });
      cursor = addDaysYmd(bucketEnd, 1);
      guard++;
    }
    return buckets;
  }

  // mensal
  let cursor = `${startDate.slice(0, 7)}-01`;
  const endMonth = `${endDate.slice(0, 7)}-01`;
  let guard = 0;
  while (cursor <= endMonth && guard < 60) {
    const ym = cursor.slice(0, 7);
    const [cy, cm] = ym.split('-').map(Number);
    const lastDay = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
    const monthEnd = `${ym}-${String(lastDay).padStart(2, '0')}`;
    buckets.push({
      key: ym,
      label: formatMonthYearBr(ym),
      startDate: cursor < startDate ? startDate : cursor,
      endDate: monthEnd > endDate ? endDate : monthEnd,
    });
    cursor = addMonthsYmd(cursor, 1);
    guard++;
  }
  return buckets;
}

export function getBucketKeyForYmd(
  ymd: string,
  buckets: PeriodTimeBucket[]
): string | null {
  for (const b of buckets) {
    if (ymd >= b.startDate && ymd <= b.endDate) {
      return b.key;
    }
  }
  return null;
}

export function computeRatioPct(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  if (!Number.isFinite(numerator) || numerator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}
