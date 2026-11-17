import {
  CashFlowGranularity,
  FinancialEntry,
  FinancialSettings,
  FinancialTransaction,
} from '../../types/finance';
import { getEntryPendingCents } from './entriesService';
import {
  KAIZEN_TIMEZONE,
  addDaysYmd,
  addMonthsYmd,
  formatDateBr,
  formatMonthYearBr,
  getTodayInTimezone,
} from './money';

export interface CashFlowBucket {
  key: string;
  label: string;
  realizedInflowCents: number;
  realizedOutflowCents: number;
  realizedNetCents: number;
  realizedBalanceCents: number;
  projectedInflowCents: number;
  projectedOutflowCents: number;
  projectedNetCents: number;
  projectedBalanceCents: number;
}

export interface CashFlowMovementRow {
  id: string;
  date: string;
  kind: 'receita' | 'despesa';
  mode: 'realizado' | 'projetado';
  description: string;
  amountCents: number;
  entryId: string;
  transactionId?: string;
}

export interface CashFlowComputation {
  openingBalanceInPeriodCents: number;
  realizedInflowCents: number;
  realizedOutflowCents: number;
  realizedNetCents: number;
  realizedClosingBalanceCents: number;
  projectedInflowCents: number;
  projectedOutflowCents: number;
  projectedNetCents: number;
  projectedClosingBalanceCents: number;
  currentRealizedCashBalanceCents: number;
  buckets: CashFlowBucket[];
  movements: CashFlowMovementRow[];
}

export function getTransactionSignedCashCents(tx: FinancialTransaction): {
  inflowCents: number;
  outflowCents: number;
  netCents: number;
} {
  if (tx.kind === 'recebimento') {
    return { inflowCents: tx.amountCents, outflowCents: 0, netCents: tx.amountCents };
  }
  if (tx.kind === 'pagamento') {
    return { inflowCents: 0, outflowCents: tx.amountCents, netCents: -tx.amountCents };
  }
  if (tx.kind === 'estorno') {
    if (tx.entryKind === 'receita') {
      return { inflowCents: 0, outflowCents: tx.amountCents, netCents: -tx.amountCents };
    }
    return { inflowCents: tx.amountCents, outflowCents: 0, netCents: tx.amountCents };
  }
  // 'ajuste' altera o valor devido do lançamento, não movimenta caixa diretamente
  return { inflowCents: 0, outflowCents: 0, netCents: 0 };
}

/**
 * Calcula o saldo atual de caixa realizado a partir do saldo inicial configurado
 * somado a todas as movimentações reais (recebimentos/pagamentos/estornos) desde a data de referência.
 * O saldo inicial nunca é contabilizado como receita operacional.
 */
export function getCurrentRealizedCashBalanceCents(
  transactions: FinancialTransaction[],
  settings: FinancialSettings
): number {
  const anchorDate = settings.openingBalanceDate || '1970-01-01';
  let balance = settings.openingBalanceCents || 0;
  for (const tx of transactions) {
    if (tx.date >= anchorDate) {
      balance += getTransactionSignedCashCents(tx).netCents;
    }
  }
  return balance;
}

function getBucketKeyAndLabel(
  ymd: string,
  granularity: CashFlowGranularity
): { key: string; label: string } {
  if (granularity === 'diario') {
    return { key: ymd, label: formatDateBr(ymd).slice(0, 5) };
  }
  if (granularity === 'semanal') {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const dow = dt.getUTCDay();
    const monday = addDaysYmd(ymd, dow === 0 ? -6 : 1 - dow);
    return { key: monday, label: `Sem ${formatDateBr(monday).slice(0, 5)}` };
  }
  if (granularity === 'mensal') {
    const ym = ymd.slice(0, 7);
    return { key: ym, label: formatMonthYearBr(ym) };
  }
  const yr = ymd.slice(0, 4);
  return { key: yr, label: yr };
}

function enumeratePeriodBuckets(
  startDate: string,
  endDate: string,
  granularity: CashFlowGranularity
): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = [];
  const seen = new Set<string>();

  if (granularity === 'diario') {
    let cursor = startDate;
    let guard = 0;
    while (cursor <= endDate && guard < 400) {
      const b = getBucketKeyAndLabel(cursor, 'diario');
      if (!seen.has(b.key)) {
        seen.add(b.key);
        result.push(b);
      }
      cursor = addDaysYmd(cursor, 1);
      guard++;
    }
    return result;
  }

  if (granularity === 'semanal') {
    let cursor = getBucketKeyAndLabel(startDate, 'semanal').key;
    let guard = 0;
    while (cursor <= endDate && guard < 120) {
      const b = getBucketKeyAndLabel(cursor, 'semanal');
      if (!seen.has(b.key)) {
        seen.add(b.key);
        result.push(b);
      }
      cursor = addDaysYmd(cursor, 7);
      guard++;
    }
    return result;
  }

  if (granularity === 'mensal') {
    let cursor = `${startDate.slice(0, 7)}-01`;
    const endMonth = `${endDate.slice(0, 7)}-01`;
    let guard = 0;
    while (cursor <= endMonth && guard < 120) {
      const b = getBucketKeyAndLabel(cursor, 'mensal');
      if (!seen.has(b.key)) {
        seen.add(b.key);
        result.push(b);
      }
      cursor = addMonthsYmd(cursor, 1);
      guard++;
    }
    return result;
  }

  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  for (let y = startYear; y <= endYear && y - startYear < 30; y++) {
    result.push({ key: String(y), label: String(y) });
  }
  return result;
}

export function computeCashFlow(params: {
  entries: FinancialEntry[];
  transactions: FinancialTransaction[];
  settings: FinancialSettings;
  startDate: string;
  endDate: string;
  granularity: CashFlowGranularity;
  todayStr?: string;
}): CashFlowComputation {
  const {
    entries,
    transactions,
    settings,
    startDate,
    endDate,
    granularity,
    todayStr = getTodayInTimezone(KAIZEN_TIMEZONE),
  } = params;

  const anchorDate = settings.openingBalanceDate || '1970-01-01';
  // Saldo acumulado no início exato do período filtrado
  let openingBalanceInPeriodCents =
    startDate >= anchorDate ? settings.openingBalanceCents || 0 : 0;

  for (const tx of transactions) {
    if (tx.date >= anchorDate && tx.date < startDate) {
      openingBalanceInPeriodCents += getTransactionSignedCashCents(tx).netCents;
    }
  }

  const bucketMap = new Map<string, CashFlowBucket>();
  for (const b of enumeratePeriodBuckets(startDate, endDate, granularity)) {
    bucketMap.set(b.key, {
      key: b.key,
      label: b.label,
      realizedInflowCents: 0,
      realizedOutflowCents: 0,
      realizedNetCents: 0,
      realizedBalanceCents: 0,
      projectedInflowCents: 0,
      projectedOutflowCents: 0,
      projectedNetCents: 0,
      projectedBalanceCents: 0,
    });
  }

  const entryMap = new Map(entries.map((e) => [e.id, e]));
  const movements: CashFlowMovementRow[] = [];

  let realizedInflowCents = 0;
  let realizedOutflowCents = 0;

  for (const tx of transactions) {
    if (tx.date < startDate || tx.date > endDate) continue;
    const signed = getTransactionSignedCashCents(tx);
    if (signed.inflowCents === 0 && signed.outflowCents === 0) continue;

    realizedInflowCents += signed.inflowCents;
    realizedOutflowCents += signed.outflowCents;

    const { key, label } = getBucketKeyAndLabel(tx.date, granularity);
    const existing = bucketMap.get(key) || {
      key,
      label,
      realizedInflowCents: 0,
      realizedOutflowCents: 0,
      realizedNetCents: 0,
      realizedBalanceCents: 0,
      projectedInflowCents: 0,
      projectedOutflowCents: 0,
      projectedNetCents: 0,
      projectedBalanceCents: 0,
    };
    existing.realizedInflowCents += signed.inflowCents;
    existing.realizedOutflowCents += signed.outflowCents;
    existing.realizedNetCents = existing.realizedInflowCents - existing.realizedOutflowCents;
    bucketMap.set(key, existing);

    const linkedEntry = entryMap.get(tx.entryId);
    movements.push({
      id: `mov-real-${tx.id}`,
      date: tx.date,
      kind: tx.entryKind,
      mode: 'realizado',
      description: `${linkedEntry?.description || 'Lançamento'} (${
        tx.kind === 'estorno' ? 'Estorno' : tx.kind === 'recebimento' ? 'Recebimento' : 'Pagamento'
      })`,
      amountCents: signed.netCents,
      entryId: tx.entryId,
      transactionId: tx.id,
    });
  }

  // Projetado: apenas saldos em aberto de lançamentos ativos dentro da janela [startDate, endDate]
  let projectedInflowCents = 0;
  let projectedOutflowCents = 0;

  for (const entry of entries) {
    if (entry.status === 'cancelada') continue;
    const pendingCents = getEntryPendingCents(entry);
    if (pendingCents <= 0) continue;
    if (entry.dueDate < startDate || entry.dueDate > endDate) continue;

    if (entry.kind === 'receita') {
      projectedInflowCents += pendingCents;
    } else {
      projectedOutflowCents += pendingCents;
    }

    const { key, label } = getBucketKeyAndLabel(entry.dueDate, granularity);
    const existing = bucketMap.get(key) || {
      key,
      label,
      realizedInflowCents: 0,
      realizedOutflowCents: 0,
      realizedNetCents: 0,
      realizedBalanceCents: 0,
      projectedInflowCents: 0,
      projectedOutflowCents: 0,
      projectedNetCents: 0,
      projectedBalanceCents: 0,
    };
    if (entry.kind === 'receita') {
      existing.projectedInflowCents += pendingCents;
    } else {
      existing.projectedOutflowCents += pendingCents;
    }
    existing.projectedNetCents =
      existing.projectedInflowCents - existing.projectedOutflowCents;
    bucketMap.set(key, existing);

    movements.push({
      id: `mov-proj-${entry.id}`,
      date: entry.dueDate,
      kind: entry.kind,
      mode: 'projetado',
      description: `${entry.description}${entry.dueDate < todayStr ? ' (vencido em aberto)' : ' (previsto)'}`,
      amountCents: entry.kind === 'receita' ? pendingCents : -pendingCents,
      entryId: entry.id,
    });
  }

  const buckets = Array.from(bucketMap.values()).sort((a, b) =>
    a.key.localeCompare(b.key)
  );

  let runningRealized = openingBalanceInPeriodCents;
  let runningProjected = openingBalanceInPeriodCents;

  for (const b of buckets) {
    b.realizedNetCents = b.realizedInflowCents - b.realizedOutflowCents;
    runningRealized += b.realizedNetCents;
    b.realizedBalanceCents = runningRealized;

    b.projectedNetCents = b.projectedInflowCents - b.projectedOutflowCents;
    runningProjected += b.realizedNetCents + b.projectedNetCents;
    b.projectedBalanceCents = runningProjected;
  }

  movements.sort((a, b) => b.date.localeCompare(a.date));

  const realizedNetCents = realizedInflowCents - realizedOutflowCents;
  const projectedNetCents = projectedInflowCents - projectedOutflowCents;

  return {
    openingBalanceInPeriodCents,
    realizedInflowCents,
    realizedOutflowCents,
    realizedNetCents,
    realizedClosingBalanceCents: openingBalanceInPeriodCents + realizedNetCents,
    projectedInflowCents,
    projectedOutflowCents,
    projectedNetCents,
    projectedClosingBalanceCents:
      openingBalanceInPeriodCents + realizedNetCents + projectedNetCents,
    currentRealizedCashBalanceCents: getCurrentRealizedCashBalanceCents(
      transactions,
      settings
    ),
    buckets,
    movements,
  };
}
