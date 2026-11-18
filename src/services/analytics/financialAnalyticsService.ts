import {
  FinancialCategory,
  FinancialEntry,
  FinancialRecurrence,
  FinancialSettings,
  FinancialTransaction,
} from '../../types/finance';
import { Client, Project } from '../../types/kaizen';
import {
  ResolvedAnalyticsPeriod,
  mapAnalyticsPresetToFinancialPreset,
} from '../../types/analytics';
import {
  CashFlowComputation,
  computeCashFlow,
} from '../finance/cashFlowService';
import {
  FinanceDashboardSnapshot,
  computeFinanceDashboardSnapshot,
} from '../finance/reportsService';
import { KAIZEN_TIMEZONE, getTodayInTimezone } from '../finance/money';

export interface FinancialAnalyticsSnapshot {
  period: ResolvedAnalyticsPeriod;
  current: FinanceDashboardSnapshot;
  previous: FinanceDashboardSnapshot;
  cashFlow: CashFlowComputation;
  deltas: {
    receivedRevenueDeltaCents: number;
    paidExpensesDeltaCents: number;
    realizedProfitDeltaCents: number;
    predictedRevenueDeltaCents: number;
  };
  activeRecurrences: {
    activeRevenueCount: number;
    activeRevenueMonthlyCents: number;
    activeExpenseCount: number;
    activeExpenseMonthlyCents: number;
  };
  projectResultSummary: {
    projectId: string;
    projectName: string;
    receivedCents: number;
    paidExpensesCents: number;
    netRealizedCents: number;
  }[];
  dataIntegrityNote: string;
}

/**
 * Consome diretamente o motor oficial de `src/services/finance/*` para garantir 100%
 * de paridade entre os números do módulo Financeiro e os de Relatórios & Inteligência.
 * Nunca soma saldo inicial como receita e nunca mistura Realizado com Previsto.
 */
export function computeFinancialAnalytics(params: {
  entries: FinancialEntry[];
  transactions: FinancialTransaction[];
  categories: FinancialCategory[];
  recurrences: FinancialRecurrence[];
  settings: FinancialSettings;
  clients: Client[];
  projects: Project[];
  period: ResolvedAnalyticsPeriod;
  todayStr?: string;
}): FinancialAnalyticsSnapshot {
  const {
    entries,
    transactions,
    categories,
    recurrences,
    settings,
    clients,
    projects,
    period,
    todayStr = getTodayInTimezone(settings.timezone || KAIZEN_TIMEZONE),
  } = params;

  const currentFinancialPreset = mapAnalyticsPresetToFinancialPreset(period.preset);

  const current = computeFinanceDashboardSnapshot({
    entries,
    transactions,
    categories,
    settings,
    clients,
    preset: currentFinancialPreset,
    customStart: period.startDate,
    customEnd: period.endDate,
    todayStr,
  });

  const previous = computeFinanceDashboardSnapshot({
    entries,
    transactions,
    categories,
    settings,
    clients,
    preset: 'personalizado',
    customStart: period.previousStartDate,
    customEnd: period.previousEndDate,
    todayStr,
  });

  const cashFlow = computeCashFlow({
    entries,
    transactions,
    settings,
    startDate: period.startDate,
    endDate: period.endDate,
    granularity: period.granularity,
    todayStr,
  });

  let activeRevenueCount = 0;
  let activeRevenueMonthlyCents = 0;
  let activeExpenseCount = 0;
  let activeExpenseMonthlyCents = 0;

  for (const rec of recurrences) {
    if (rec.status !== 'ativa') continue;
    let monthlyEquivalent = rec.amountCents;
    switch (rec.frequency) {
      case 'semanal':
        monthlyEquivalent = rec.amountCents * 4;
        break;
      case 'mensal':
        monthlyEquivalent = rec.amountCents;
        break;
      case 'bimestral':
        monthlyEquivalent = Math.round(rec.amountCents / 2);
        break;
      case 'trimestral':
        monthlyEquivalent = Math.round(rec.amountCents / 3);
        break;
      case 'semestral':
        monthlyEquivalent = Math.round(rec.amountCents / 6);
        break;
      case 'anual':
        monthlyEquivalent = Math.round(rec.amountCents / 12);
        break;
      case 'personalizada': {
        const days = Math.max(1, rec.customIntervalDays || 30);
        monthlyEquivalent = Math.round((rec.amountCents * 30) / days);
        break;
      }
    }
    if (rec.kind === 'receita') {
      activeRevenueCount += 1;
      activeRevenueMonthlyCents += monthlyEquivalent;
    } else {
      activeExpenseCount += 1;
      activeExpenseMonthlyCents += monthlyEquivalent;
    }
  }

  // Resultado realizado por projeto usando apenas transações ligadas ao lançamento do projeto no período
  const entryMap = new Map(entries.map((e) => [e.id, e]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const projAgg = new Map<
    string,
    { projectName: string; receivedCents: number; paidExpensesCents: number }
  >();

  for (const tx of transactions) {
    if (tx.date < period.startDate || tx.date > period.endDate) continue;
    const entry = entryMap.get(tx.entryId);
    if (!entry || !entry.projectId) continue;
    const cur = projAgg.get(entry.projectId) || {
      projectName: projectMap.get(entry.projectId) || entry.projectId,
      receivedCents: 0,
      paidExpensesCents: 0,
    };
    if (tx.entryKind === 'receita') {
      cur.receivedCents += tx.kind === 'estorno' ? -tx.amountCents : tx.amountCents;
    } else if (tx.entryKind === 'despesa') {
      cur.paidExpensesCents += tx.kind === 'estorno' ? -tx.amountCents : tx.amountCents;
    }
    projAgg.set(entry.projectId, cur);
  }

  const projectResultSummary = Array.from(projAgg.entries())
    .map(([projectId, val]) => ({
      projectId,
      projectName: val.projectName,
      receivedCents: val.receivedCents,
      paidExpensesCents: val.paidExpensesCents,
      netRealizedCents: val.receivedCents - val.paidExpensesCents,
    }))
    .sort((a, b) => b.netRealizedCents - a.netRealizedCents);

  return {
    period,
    current,
    previous,
    cashFlow,
    deltas: {
      receivedRevenueDeltaCents:
        current.receivedRevenueCents - previous.receivedRevenueCents,
      paidExpensesDeltaCents: current.paidExpensesCents - previous.paidExpensesCents,
      realizedProfitDeltaCents:
        current.realizedProfitCents - previous.realizedProfitCents,
      predictedRevenueDeltaCents:
        current.predictedRevenueCents - previous.predictedRevenueCents,
    },
    activeRecurrences: {
      activeRevenueCount,
      activeRevenueMonthlyCents,
      activeExpenseCount,
      activeExpenseMonthlyCents,
    },
    projectResultSummary,
    dataIntegrityNote:
      'Indicadores calculados diretamente pelo motor oficial do módulo Financeiro: valores realizados vêm exclusivamente de transações reais e nunca misturam saldo inicial ou lançamentos previstos.',
  };
}
