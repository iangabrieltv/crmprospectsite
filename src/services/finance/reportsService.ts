import {
  FinancialCategory,
  FinancialEntry,
  FinancialPeriodPreset,
  FinancialRecurrence,
  FinancialReportId,
  FinancialSettings,
  FinancialTransaction,
  FINANCIAL_ENTRY_STATUS_META,
  getPaymentMethodLabel,
  getRecurrenceFrequencyLabel,
} from '../../types/finance';
import { Client, Project } from '../../types/kaizen';
import {
  computeCashFlow,
  getCurrentRealizedCashBalanceCents,
  getTransactionSignedCashCents,
} from './cashFlowService';
import { getCategoryName } from './categoriesService';
import {
  getDaysOverdue,
  getDaysUntilDue,
  getEffectiveEntryStatus,
  getEntryAllowedTotalCents,
  getEntryPendingCents,
} from './entriesService';
import {
  KAIZEN_TIMEZONE,
  addDaysYmd,
  addMonthsYmd,
  buildCsvContent,
  formatBrlFromCents,
  formatDateBr,
  formatMonthYearBr,
  getTodayInTimezone,
  resolvePeriodRange,
} from './money';

export interface FinanceAlertItem {
  id: string;
  severity: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  targetSubView:
    | 'contas_a_receber'
    | 'contas_a_pagar'
    | 'fluxo_de_caixa';
  entryId?: string;
}

export interface MonthlyComparisonPoint {
  ym: string;
  label: string;
  realizedRevenueCents: number;
  realizedExpenseCents: number;
  realizedProfitCents: number;
  projectedCashNetCents: number;
  endingCashBalanceCents: number;
  overdueOpenCents: number;
}

export interface CategorySlicePoint {
  id: string;
  name: string;
  amountCents: number;
  percent: number;
}

export interface FinanceDashboardSnapshot {
  periodLabel: string;
  startDate: string;
  endDate: string;
  // 9 Indicadores principais obrigatórios
  receivedRevenueCents: number;
  predictedRevenueCents: number;
  paidExpensesCents: number;
  predictedExpensesCents: number;
  realizedProfitCents: number; // Lucro realizado = resultado gerencial
  accountsReceivableCents: number;
  accountsPayableCents: number;
  cashBalanceCents: number;
  delinquencyCents: number;
  delinquencyCount: number;
  // Gráficos reais (8 datasets)
  monthlySeries: MonthlyComparisonPoint[];
  revenueByClient: CategorySlicePoint[];
  expensesByCategory: CategorySlicePoint[];
  revenueByService: CategorySlicePoint[];
  receivedVsPending: {
    receivedCents: number;
    pendingOnTimeCents: number;
    overdueCents: number;
  };
  alerts: FinanceAlertItem[];
}

export function computeFinanceDashboardSnapshot(params: {
  entries: FinancialEntry[];
  transactions: FinancialTransaction[];
  categories: FinancialCategory[];
  settings: FinancialSettings;
  clients: Client[];
  preset: FinancialPeriodPreset;
  customStart?: string;
  customEnd?: string;
  todayStr?: string;
}): FinanceDashboardSnapshot {
  const {
    entries,
    transactions,
    categories,
    settings,
    clients,
    preset,
    customStart,
    customEnd,
    todayStr = getTodayInTimezone(settings.timezone || KAIZEN_TIMEZONE),
  } = params;

  const { startDate, endDate, label: periodLabel } = resolvePeriodRange(
    preset,
    customStart,
    customEnd,
    todayStr
  );

  // 1. Receita recebida & Despesas pagas no período = estritamente via transações reais
  let receivedRevenueCents = 0;
  let paidExpensesCents = 0;

  for (const tx of transactions) {
    if (tx.date < startDate || tx.date > endDate) continue;
    const signed = getTransactionSignedCashCents(tx);
    if (tx.entryKind === 'receita') {
      receivedRevenueCents += signed.inflowCents - signed.outflowCents;
    } else {
      paidExpensesCents += signed.outflowCents - signed.inflowCents;
    }
  }

  // 2. Previstos no período (vencimento dentro do período, não cancelados) + Contas a Receber / Pagar / Inadimplência globais em aberto
  let predictedRevenueCents = 0;
  let predictedExpensesCents = 0;
  let accountsReceivableCents = 0;
  let accountsPayableCents = 0;
  let delinquencyCents = 0;
  let delinquencyCount = 0;

  let periodReceivedTotalCents = 0;
  let periodPendingOnTimeCents = 0;
  let periodOverdueCents = 0;

  const clientNameMap = new Map(clients.map((c) => [c.id, c.companyName]));
  const revenueByClientMap = new Map<string, { name: string; amountCents: number }>();
  const expensesByCategoryMap = new Map<string, { name: string; amountCents: number }>();
  const revenueByServiceMap = new Map<string, { name: string; amountCents: number }>();

  const alerts: FinanceAlertItem[] = [];
  const alertDays = Math.max(0, settings.alertDaysAhead ?? 5);

  for (const entry of entries) {
    if (entry.status === 'cancelada') continue;
    const allowedTotal = getEntryAllowedTotalCents(entry);
    const pending = getEntryPendingCents(entry);
    const effStatus = getEffectiveEntryStatus(entry, todayStr);
    const inPeriodByDue = entry.dueDate >= startDate && entry.dueDate <= endDate;

    if (entry.kind === 'receita') {
      accountsReceivableCents += pending;
      if (effStatus === 'atrasada' && pending > 0) {
        delinquencyCents += pending;
        delinquencyCount += 1;
      }
      if (inPeriodByDue) {
        predictedRevenueCents += allowedTotal;
        periodReceivedTotalCents += Math.min(allowedTotal, entry.settledCents || 0);
        if (effStatus === 'atrasada') {
          periodOverdueCents += pending;
        } else {
          periodPendingOnTimeCents += pending;
        }
      }
    } else {
      accountsPayableCents += pending;
      if (inPeriodByDue) {
        predictedExpensesCents += allowedTotal;
      }
    }

    // Breakdown por serviço (receitas no período por vencimento)
    if (entry.kind === 'receita' && inPeriodByDue) {
      const svcKey = (entry.serviceName || getCategoryName(categories, entry.categoryId)).trim();
      const prev = revenueByServiceMap.get(svcKey) || { name: svcKey, amountCents: 0 };
      prev.amountCents += allowedTotal;
      revenueByServiceMap.set(svcKey, prev);
    }

    // Alertas acionáveis
    if (pending > 0) {
      if (effStatus === 'atrasada') {
        const days = getDaysOverdue(entry, todayStr);
        alerts.push({
          id: `al-ov-${entry.id}`,
          severity: 'danger',
          title:
            entry.kind === 'receita'
              ? `Recebimento atrasado há ${days} dia(s): ${entry.description}`
              : `Conta a pagar atrasada há ${days} dia(s): ${entry.description}`,
          description: `Saldo em aberto: ${formatBrlFromCents(pending)} · Vencimento: ${formatDateBr(
            entry.dueDate
          )}`,
          targetSubView:
            entry.kind === 'receita' ? 'contas_a_receber' : 'contas_a_pagar',
          entryId: entry.id,
        });
      } else {
        const daysUntil = getDaysUntilDue(entry, todayStr);
        if (daysUntil !== null && daysUntil >= 0 && daysUntil <= alertDays) {
          alerts.push({
            id: `al-due-${entry.id}`,
            severity: 'warning',
            title:
              daysUntil === 0
                ? `Vence hoje: ${entry.description}`
                : `Vence em ${daysUntil} dia(s): ${entry.description}`,
            description: `${
              entry.kind === 'receita' ? 'A receber' : 'A pagar'
            }: ${formatBrlFromCents(pending)} · Venc.: ${formatDateBr(entry.dueDate)}`,
            targetSubView:
              entry.kind === 'receita' ? 'contas_a_receber' : 'contas_a_pagar',
            entryId: entry.id,
          });
        }
      }
    }
  }

  // Quebras reais realizadas no período para Receitas por cliente e Despesas por categoria
  const entryById = new Map(entries.map((e) => [e.id, e]));
  for (const tx of transactions) {
    if (tx.date < startDate || tx.date > endDate) continue;
    const entry = entryById.get(tx.entryId);
    if (!entry) continue;
    const signed = getTransactionSignedCashCents(tx);
    const netIn = signed.inflowCents - signed.outflowCents;
    const netOut = signed.outflowCents - signed.inflowCents;

    if (entry.kind === 'receita' && netIn !== 0) {
      const clientKey = entry.clientId || 'avulsa';
      const clientName = entry.clientId
        ? clientNameMap.get(entry.clientId) || 'Cliente'
        : 'Receitas Avulsas';
      const cur = revenueByClientMap.get(clientKey) || { name: clientName, amountCents: 0 };
      cur.amountCents += netIn;
      revenueByClientMap.set(clientKey, cur);
    } else if (entry.kind === 'despesa' && netOut !== 0) {
      const catName = getCategoryName(categories, entry.categoryId);
      const cur = expensesByCategoryMap.get(entry.categoryId) || {
        name: catName,
        amountCents: 0,
      };
      cur.amountCents += netOut;
      expensesByCategoryMap.set(entry.categoryId, cur);
    }
  }

  // Fallback para mostrar previsão caso não haja baixas no filtro em Receitas por cliente / Despesas por categoria
  if (revenueByClientMap.size === 0) {
    for (const entry of entries) {
      if (
        entry.kind === 'receita' &&
        entry.status !== 'cancelada' &&
        entry.dueDate >= startDate &&
        entry.dueDate <= endDate
      ) {
        const clientKey = entry.clientId || 'avulsa';
        const clientName = entry.clientId
          ? clientNameMap.get(entry.clientId) || 'Cliente'
          : 'Receitas Avulsas';
        const cur = revenueByClientMap.get(clientKey) || { name: clientName, amountCents: 0 };
        cur.amountCents += getEntryAllowedTotalCents(entry);
        revenueByClientMap.set(clientKey, cur);
      }
    }
  }
  if (expensesByCategoryMap.size === 0) {
    for (const entry of entries) {
      if (
        entry.kind === 'despesa' &&
        entry.status !== 'cancelada' &&
        entry.dueDate >= startDate &&
        entry.dueDate <= endDate
      ) {
        const catName = getCategoryName(categories, entry.categoryId);
        const cur = expensesByCategoryMap.get(entry.categoryId) || {
          name: catName,
          amountCents: 0,
        };
        cur.amountCents += getEntryAllowedTotalCents(entry);
        expensesByCategoryMap.set(entry.categoryId, cur);
      }
    }
  }

  const normalizeSlices = (
    map: Map<string, { name: string; amountCents: number }>
  ): CategorySlicePoint[] => {
    const items = Array.from(map.entries())
      .map(([id, v]) => ({ id, name: v.name, amountCents: Math.max(0, v.amountCents) }))
      .filter((x) => x.amountCents > 0)
      .sort((a, b) => b.amountCents - a.amountCents);
    const total = items.reduce((s, i) => s + i.amountCents, 0) || 1;
    return items.slice(0, 7).map((i) => ({
      ...i,
      percent: Number(((i.amountCents / total) * 100).toFixed(1)),
    }));
  };

  // Série mensal de 6 meses terminando no mês do endDate (para os gráficos temporais)
  const endMonthFirst = `${endDate.slice(0, 7)}-01`;
  const sixMonthsStart = addMonthsYmd(endMonthFirst, -5);
  const sixMonthLastDay = new Date(
    Date.UTC(Number(endDate.slice(0, 4)), Number(endDate.slice(5, 7)), 0)
  ).getUTCDate();
  const sixMonthsEnd = `${endDate.slice(0, 7)}-${String(sixMonthLastDay).padStart(2, '0')}`;

  const cfMonthly = computeCashFlow({
    entries,
    transactions,
    settings,
    startDate: sixMonthsStart,
    endDate: sixMonthsEnd,
    granularity: 'mensal',
    todayStr,
  });

  const monthlySeries: MonthlyComparisonPoint[] = cfMonthly.buckets.map((b) => {
    const overdueInMonth = entries
      .filter(
        (e) =>
          e.kind === 'receita' &&
          e.status !== 'cancelada' &&
          e.dueDate.startsWith(b.key) &&
          getEffectiveEntryStatus(e, todayStr) === 'atrasada'
      )
      .reduce((s, e) => s + getEntryPendingCents(e), 0);

    return {
      ym: b.key,
      label: b.label,
      realizedRevenueCents: b.realizedInflowCents,
      realizedExpenseCents: b.realizedOutflowCents,
      realizedProfitCents: b.realizedInflowCents - b.realizedOutflowCents,
      projectedCashNetCents: b.projectedNetCents,
      endingCashBalanceCents: b.realizedBalanceCents,
      overdueOpenCents: overdueInMonth,
    };
  });

  const cashBalanceCents = getCurrentRealizedCashBalanceCents(transactions, settings);
  if (cashBalanceCents < 0) {
    alerts.unshift({
      id: 'al-neg-cash',
      severity: 'danger',
      title: `Saldo de caixa realizado negativo (${formatBrlFromCents(cashBalanceCents)})`,
      description: 'As saídas realizadas superaram o saldo inicial + entradas.',
      targetSubView: 'fluxo_de_caixa',
    });
  }

  alerts.sort((a, b) => {
    const order = { danger: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return {
    periodLabel,
    startDate,
    endDate,
    receivedRevenueCents,
    predictedRevenueCents,
    paidExpensesCents,
    predictedExpensesCents,
    realizedProfitCents: receivedRevenueCents - paidExpensesCents,
    accountsReceivableCents,
    accountsPayableCents,
    cashBalanceCents,
    delinquencyCents,
    delinquencyCount,
    monthlySeries,
    revenueByClient: normalizeSlices(revenueByClientMap),
    expensesByCategory: normalizeSlices(expensesByCategoryMap),
    revenueByService: normalizeSlices(revenueByServiceMap),
    receivedVsPending: {
      receivedCents: periodReceivedTotalCents,
      pendingOnTimeCents: periodPendingOnTimeCents,
      overdueCents: periodOverdueCents,
    },
    alerts: alerts.slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// 15 RELATÓRIOS GERENCIAIS OBRIGATÓRIOS
// ---------------------------------------------------------------------------

export const FINANCIAL_REPORT_DEFINITIONS: {
  id: FinancialReportId;
  title: string;
  description: string;
}[] = [
  {
    id: 'receitas_periodo',
    title: '1. Receitas por período',
    description: 'Detalhamento completo de receitas previstas, recebidas e pendentes.',
  },
  {
    id: 'despesas_periodo',
    title: '2. Despesas por período',
    description: 'Despesas operacionais por fornecedor, categoria e vencimento.',
  },
  {
    id: 'lucro_realizado',
    title: '3. Lucro realizado (Resultado Gerencial)',
    description: 'Recebimentos efetivos menos pagamentos efetivos no período.',
  },
  {
    id: 'resultado_previsto',
    title: '4. Resultado previsto',
    description: 'Comparativo entre receitas previstas e despesas previstas.',
  },
  {
    id: 'fluxo_de_caixa',
    title: '5. Fluxo de caixa',
    description: 'Movimentação mensal realizada vs projetada com saldo acumulado.',
  },
  {
    id: 'receitas_cliente',
    title: '6. Receitas por cliente',
    description: 'Faturamento, recebido e saldo em aberto consolidados por cliente.',
  },
  {
    id: 'receitas_servico',
    title: '7. Receitas por serviço',
    description: 'Receita segmentada por serviço/categoria prestada pela Kaizen.',
  },
  {
    id: 'despesas_categoria',
    title: '8. Despesas por categoria',
    description: 'Distribuição de custos operacionais por categoria cadastrada.',
  },
  {
    id: 'contas_a_receber',
    title: '9. Contas a receber',
    description: 'Carteira de recebíveis em aberto com vencimentos e saldos.',
  },
  {
    id: 'contas_a_pagar',
    title: '10. Contas a pagar',
    description: 'Obrigações financeiras a vencer ou atrasadas com fornecedores.',
  },
  {
    id: 'inadimplencia',
    title: '11. Inadimplência',
    description: 'Recebíveis vencidos com dias em atraso e cliente responsável.',
  },
  {
    id: 'receitas_recorrentes',
    title: '12. Receitas recorrentes',
    description: 'Contratos e assinaturas ativas geradoras de MRR.',
  },
  {
    id: 'despesas_recorrentes',
    title: '13. Despesas recorrentes',
    description: 'Ferramentas SaaS, servidores e custos fixos recorrentes.',
  },
  {
    id: 'resultado_projeto',
    title: '14. Resultado financeiro por projeto',
    description: 'Receitas vinculadas, despesas e margem por projeto da agência.',
  },
  {
    id: 'comparativo_mensal',
    title: '15. Comparativo entre meses',
    description: 'Evolução mês a mês de entradas, saídas e resultado realizado.',
  },
];

export interface GeneratedFinancialReport {
  id: FinancialReportId;
  title: string;
  subtitle: string;
  periodLabel: string;
  generatedAtIso: string;
  summaryCards: { label: string; value: string }[];
  columns: string[];
  rows: string[][];
  totalsRow?: string[];
  emptyMessage: string;
}

export function generateFinancialReport(params: {
  reportId: FinancialReportId;
  entries: FinancialEntry[];
  transactions: FinancialTransaction[];
  categories: FinancialCategory[];
  recurrences: FinancialRecurrence[];
  settings: FinancialSettings;
  clients: Client[];
  projects: Project[];
  startDate: string;
  endDate: string;
  periodLabel: string;
  clientIdFilter?: string;
  categoryIdFilter?: string;
  todayStr?: string;
}): GeneratedFinancialReport {
  const {
    reportId,
    entries,
    transactions,
    categories,
    recurrences,
    settings,
    clients,
    projects,
    startDate,
    endDate,
    periodLabel,
    clientIdFilter,
    categoryIdFilter,
    todayStr = getTodayInTimezone(settings.timezone || KAIZEN_TIMEZONE),
  } = params;

  const def =
    FINANCIAL_REPORT_DEFINITIONS.find((d) => d.id === reportId) ||
    FINANCIAL_REPORT_DEFINITIONS[0];
  const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  const filteredEntries = entries.filter((e) => {
    if (clientIdFilter && e.clientId !== clientIdFilter) return false;
    if (categoryIdFilter && e.categoryId !== categoryIdFilter) return false;
    return true;
  });

  const periodEntries = filteredEntries.filter(
    (e) => e.dueDate >= startDate && e.dueDate <= endDate && e.status !== 'cancelada'
  );

  const generatedAtIso = new Date().toISOString();

  switch (reportId) {
    case 'receitas_periodo':
    case 'despesas_periodo': {
      const targetKind = reportId === 'receitas_periodo' ? 'receita' : 'despesa';
      const list = periodEntries
        .filter((e) => e.kind === targetKind)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const totalAmt = list.reduce((s, e) => s + getEntryAllowedTotalCents(e), 0);
      const totalSettled = list.reduce((s, e) => s + (e.settledCents || 0), 0);
      const totalPending = list.reduce((s, e) => s + getEntryPendingCents(e), 0);

      return {
        id: reportId,
        title: def.title,
        subtitle: def.description,
        periodLabel,
        generatedAtIso,
        summaryCards: [
          { label: 'Lançamentos', value: String(list.length) },
          { label: 'Valor Total', value: formatBrlFromCents(totalAmt) },
          { label: targetKind === 'receita' ? 'Recebido' : 'Pago', value: formatBrlFromCents(totalSettled) },
          { label: 'Em Aberto', value: formatBrlFromCents(totalPending) },
        ],
        columns: [
          'Vencimento',
          'Descrição',
          targetKind === 'receita' ? 'Cliente' : 'Fornecedor',
          'Categoria',
          'Valor Total',
          targetKind === 'receita' ? 'Recebido' : 'Pago',
          'Pendente',
          'Status',
        ],
        rows: list.map((e) => [
          formatDateBr(e.dueDate),
          e.description,
          targetKind === 'receita'
            ? (e.clientId ? clientMap.get(e.clientId) : '') || 'Avulsa'
            : e.supplierName || '—',
          getCategoryName(categories, e.categoryId),
          formatBrlFromCents(getEntryAllowedTotalCents(e)),
          formatBrlFromCents(e.settledCents || 0),
          formatBrlFromCents(getEntryPendingCents(e)),
          FINANCIAL_ENTRY_STATUS_META[getEffectiveEntryStatus(e, todayStr)]?.label || e.status,
        ]),
        totalsRow: [
          'TOTAL',
          `${list.length} registro(s)`,
          '—',
          '—',
          formatBrlFromCents(totalAmt),
          formatBrlFromCents(totalSettled),
          formatBrlFromCents(totalPending),
          '—',
        ],
        emptyMessage: `Nenhum lançamento encontrado no período selecionado.`,
      };
    }

    case 'lucro_realizado': {
      const entryMap = new Map(filteredEntries.map((e) => [e.id, e]));
      const periodTxs = transactions
        .filter((tx) => {
          if (tx.date < startDate || tx.date > endDate) return false;
          const e = entryMap.get(tx.entryId);
          if (!e && (clientIdFilter || categoryIdFilter)) return false;
          if (e && clientIdFilter && e.clientId !== clientIdFilter) return false;
          if (e && categoryIdFilter && e.categoryId !== categoryIdFilter) return false;
          return tx.kind !== 'ajuste';
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      let rev = 0;
      let exp = 0;
      const rows = periodTxs.map((tx) => {
        const signed = getTransactionSignedCashCents(tx);
        if (tx.entryKind === 'receita') {
          rev += signed.inflowCents - signed.outflowCents;
        } else {
          exp += signed.outflowCents - signed.inflowCents;
        }
        const entry = entryMap.get(tx.entryId);
        return [
          formatDateBr(tx.date),
          tx.kind === 'estorno'
            ? 'Estorno'
            : tx.entryKind === 'receita'
            ? 'Recebimento'
            : 'Pagamento',
          entry?.description || tx.entryId,
          getPaymentMethodLabel(tx.paymentMethod),
          formatBrlFromCents(signed.netCents, { signed: true }),
        ];
      });
      const profit = rev - exp;
      return {
        id: reportId,
        title: def.title,
        subtitle: def.description,
        periodLabel,
        generatedAtIso,
        summaryCards: [
          { label: 'Entradas Realizadas', value: formatBrlFromCents(rev) },
          { label: 'Saídas Realizadas', value: formatBrlFromCents(exp) },
          { label: 'Resultado Gerencial', value: formatBrlFromCents(profit) },
        ],
        columns: ['Data', 'Operação', 'Lançamento', 'Pagamento', 'Impacto no Caixa'],
        rows,
        totalsRow: [
          'RESULTADO',
          `${periodTxs.length} mov.`,
          `Entradas ${formatBrlFromCents(rev)} - Saídas ${formatBrlFromCents(exp)}`,
          '—',
          formatBrlFromCents(profit, { signed: true }),
        ],
        emptyMessage: 'Sem movimentações financeiras efetivas neste período.',
      };
    }

    case 'resultado_previsto': {
      const revEntries = periodEntries.filter((e) => e.kind === 'receita');
      const expEntries = periodEntries.filter((e) => e.kind === 'despesa');
      const revTotal = revEntries.reduce((s, e) => s + getEntryAllowedTotalCents(e), 0);
      const expTotal = expEntries.reduce((s, e) => s + getEntryAllowedTotalCents(e), 0);
      const result = revTotal - expTotal;
      return {
        id: reportId,
        title: def.title,
        subtitle: def.description,
        periodLabel,
        generatedAtIso,
        summaryCards: [
          { label: 'Receita Prevista', value: formatBrlFromCents(revTotal) },
          { label: 'Despesa Prevista', value: formatBrlFromCents(expTotal) },
          { label: 'Resultado Previsto', value: formatBrlFromCents(result) },
        ],
        columns: ['Vencimento', 'Tipo', 'Descrição', 'Categoria', 'Valor Previsto', 'Status'],
        rows: periodEntries
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          .map((e) => [
            formatDateBr(e.dueDate),
            e.kind === 'receita' ? 'Receita' : 'Despesa',
            e.description,
            getCategoryName(categories, e.categoryId),
            formatBrlFromCents(
              e.kind === 'receita'
                ? getEntryAllowedTotalCents(e)
                : -getEntryAllowedTotalCents(e),
              { signed: true }
            ),
            FINANCIAL_ENTRY_STATUS_META[getEffectiveEntryStatus(e, todayStr)]?.label ||
              e.status,
          ]),
        totalsRow: [
          'TOTAL PREVISTO',
          `${periodEntries.length} itens`,
          '—',
          '—',
          formatBrlFromCents(result, { signed: true }),
          '—',
        ],
        emptyMessage: 'Sem lançamentos previstos no período.',
      };
    }

    case 'fluxo_de_caixa': {
      const cf = computeCashFlow({
        entries: filteredEntries,
        transactions,
        settings,
        startDate,
        endDate,
        granularity: 'mensal',
        todayStr,
      });
      return {
        id: reportId,
        title: def.title,
        subtitle: def.description,
        periodLabel,
        generatedAtIso,
        summaryCards: [
          {
            label: 'Saldo Inicial Período',
            value: formatBrlFromCents(cf.openingBalanceInPeriodCents),
          },
          { label: 'Entradas Realizadas', value: formatBrlFromCents(cf.realizedInflowCents) },
          { label: 'Saídas Realizadas', value: formatBrlFromCents(cf.realizedOutflowCents) },
          {
            label: 'Saldo Projetado Final',
            value: formatBrlFromCents(cf.projectedClosingBalanceCents),
          },
        ],
        columns: [
          'Competência / Mês',
          'Entradas Realizadas',
          'Saídas Realizadas',
          'Saldo Acumulado Realizado',
          'Entradas Previstas',
          'Saídas Previstas',
          'Saldo Projetado',
        ],
        rows: cf.buckets.map((b) => [
          b.label,
          formatBrlFromCents(b.realizedInflowCents),
          formatBrlFromCents(b.realizedOutflowCents),
          formatBrlFromCents(b.realizedBalanceCents),
          formatBrlFromCents(b.projectedInflowCents),
          formatBrlFromCents(b.projectedOutflowCents),
          formatBrlFromCents(b.projectedBalanceCents),
        ]),
        totalsRow: [
          'FECHAMENTO',
          formatBrlFromCents(cf.realizedInflowCents),
          formatBrlFromCents(cf.realizedOutflowCents),
          formatBrlFromCents(cf.realizedClosingBalanceCents),
          formatBrlFromCents(cf.projectedInflowCents),
          formatBrlFromCents(cf.projectedOutflowCents),
          formatBrlFromCents(cf.projectedClosingBalanceCents),
        ],
        emptyMessage: 'Sem buckets de fluxo de caixa para o intervalo informado.',
      };
    }

    case 'receitas_cliente': {
      const map = new Map<
        string,
        { name: string; count: number; total: number; settled: number; pending: number }
      >();
      for (const e of periodEntries.filter((x) => x.kind === 'receita')) {
        const key = e.clientId || 'avulsa';
        const cur = map.get(key) || {
          name: e.clientId ? clientMap.get(e.clientId) || 'Cliente' : 'Receitas Avulsas',
          count: 0,
          total: 0,
          settled: 0,
          pending: 0,
        };
        cur.count += 1;
        cur.total += getEntryAllowedTotalCents(e);
        cur.settled += e.settledCents || 0;
        cur.pending += getEntryPendingCents(e);
        map.set(key, cur);
      }
      const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
      const grandTotal = list.reduce((s, x) => s + x.total, 0);
      const grandSettled = list.reduce((s, x) => s + x.settled, 0);
      const grandPending = list.reduce((s, x) => s + x.pending, 0);

      return {
        id: reportId,
        title: def.title,
        subtitle: def.description,
        periodLabel,
        generatedAtIso,
        summaryCards: [
          { label: 'Clientes Faturados', value: String(list.length) },
          { label: 'Total Faturado', value: formatBrlFromCents(grandTotal) },
          { label: 'Recebido', value: formatBrlFromCents(grandSettled) },
          { label: 'A Receber', value: formatBrlFromCents(grandPending) },
        ],
        columns: ['Cliente', 'Lançamentos', 'Faturado', 'Recebido', 'Em Aberto'],
        rows: list.map((i) => [
          i.name,
          String(i.count),
          formatBrlFromCents(i.total),
          formatBrlFromCents(i.settled),
          formatBrlFromCents(i.pending),
        ]),
        totalsRow: [
          'TOTAL',
          String(list.reduce((s, x) => s + x.count, 0)),
          formatBrlFromCents(grandTotal),
          formatBrlFromCents(grandSettled),
          formatBrlFromCents(grandPending),
        ],
        emptyMessage: 'Sem receitas registradas para clientes no período.',
      };
    }

    case 'receitas_servico': {
      const map = new Map<
        string,
        { service: string; count: number; total: number; settled: number }
      >();
      for (const e of periodEntries.filter((x) => x.kind === 'receita')) {
        const svc = (e.serviceName || getCategoryName(categories, e.categoryId)).trim();
        const cur = map.get(svc) || { service: svc, count: 0, total: 0, settled: 0 };
        cur.count += 1;
        cur.total += getEntryAllowedTotalCents(e);
        cur.settled += e.settledCents || 0;
        map.set(svc, cur);
      }
      const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
      const grandTotal = list.reduce((s, x) => s + x.total, 0);
      const grandSettled = list.reduce((s, x) => s + x.settled, 0);

      return {
        id: reportId,
        title: def.title,
        subtitle: def.description,
        periodLabel,
        generatedAtIso,
        summaryCards: [
          { label: 'Serviços distintos', value: String(list.length) },
          { label: 'Faturado', value: formatBrlFromCents(grandTotal) },
          { label: 'Recebido', value: formatBrlFromCents(grandSettled) },
        ],
        columns: ['Serviço / Pacote', 'Lançamentos', 'Faturado', 'Recebido', '% do Total'],
        rows: list.map((i) => [
          i.service,
          String(i.count),
          formatBrlFromCents(i.total),
          formatBrlFromCents(i.settled),
          grandTotal > 0 ? `${((i.total / grandTotal) * 100).toFixed(1)}%` : '0,0%',
        ]),
        totalsRow: [
          'TOTAL',
          String(list.reduce((s, x) => s + x.count, 0)),
          formatBrlFromCents(grandTotal),
          formatBrlFromCents(grandSettled),
          '100,0%',
        ],
        emptyMessage: 'Sem receitas por serviço no período.',
      };
    }

    case 'despesas_categoria': {
      const map = new Map<
        string,
        { category: string; count: number; total: number; paid: number; pending: number }
      >();
      for (const e of periodEntries.filter((x) => x.kind === 'despesa')) {
        const cat = getCategoryName(categories, e.categoryId);
        const cur = map.get(e.categoryId) || {
          category: cat,
          count: 0,
          total: 0,
          paid: 0,
          pending: 0,
        };
        cur.count += 1;
        cur.total += getEntryAllowedTotalCents(e);
        cur.paid += e.settledCents || 0;
        cur.pending += getEntryPendingCents(e);
        map.set(e.categoryId, cur);
      }
      const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
      const grandTotal = list.reduce((s, x) => s + x.total, 0);
      const grandPaid = list.reduce((s, x) => s + x.paid, 0);
      const grandPending = list.reduce((s, x) => s + x.pending, 0);

      return {
        id: reportId,
        title: def.title,
        subtitle: def.description,
        periodLabel,
        generatedAtIso,
        summaryCards: [
          { label: 'Categorias com custo', value: String(list.length) },
          { label: 'Total Despesas', value: formatBrlFromCents(grandTotal) },
          { label: 'Pago', value: formatBrlFromCents(grandPaid) },
          { label: 'A Pagar', value: formatBrlFromCents(grandPending) },
        ],
        columns: ['Categoria', 'Qtd', 'Total', 'Pago', 'Em Aberto', '% Participação'],
        rows: list.map((i) => [
          i.category,
          String(i.count),
          formatBrlFromCents(i.total),
          formatBrlFromCents(i.paid),
          formatBrlFromCents(i.pending),
          grandTotal > 0 ? `${((i.total / grandTotal) * 100).toFixed(1)}%` : '0,0%',
        ]),
        totalsRow: [
          'TOTAL',
          String(list.reduce((s, x) => s + x.count, 0)),
          formatBrlFromCents(grandTotal),
          formatBrlFromCents(grandPaid),
          formatBrlFromCents(grandPending),
          '100,0%',
        ],
        emptyMessage: 'Sem despesas por categoria no período.',
      };
    }

    case 'contas_a_receber':
    case 'contas_a_pagar': {
      const targetKind = reportId === 'contas_a_receber' ? 'receita' : 'despesa';
      const list = filteredEntries
        .filter(
          (e) =>
            e.kind === targetKind &&
            e.status !== 'cancelada' &&
            getEntryPendingCents(e) > 0
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const totalOriginal = list.reduce((s, e) => s + getEntryAllowedTotalCents(e), 0);
      const totalSettled = list.reduce((s, e) => s + (e.settledCents || 0), 0);
      const totalPending = list.reduce((s, e) => s + getEntryPendingCents(e), 0);

      return {
        id: reportId,
        title: def.title,
        subtitle: def.description,
        periodLabel: `Posição em aberto em ${formatDateBr(todayStr)}`,
        generatedAtIso,
        summaryCards: [
          { label: 'Títulos em Aberto', value: String(list.length) },
          { label: 'Valor Original', value: formatBrlFromCents(totalOriginal) },
          { label: 'Já Baixado', value: formatBrlFromCents(totalSettled) },
          { label: 'Saldo em Aberto', value: formatBrlFromCents(totalPending) },
        ],
        columns: [
          'Vencimento',
          targetKind === 'receita' ? 'Cliente' : 'Fornecedor',
          'Descrição',
          'Valor Total',
          'Baixado',
          'Saldo Pendente',
          'Situação',
        ],
        rows: list.map((e) => [
          formatDateBr(e.dueDate),
          targetKind === 'receita'
            ? (e.clientId ? clientMap.get(e.clientId) : '') || 'Avulsa'
            : e.supplierName || '—',
          e.description,
          formatBrlFromCents(getEntryAllowedTotalCents(e)),
          formatBrlFromCents(e.settledCents || 0),
          formatBrlFromCents(getEntryPendingCents(e)),
          FINANCIAL_ENTRY_STATUS_META[getEffectiveEntryStatus(e, todayStr)]?.label || e.status,
        ]),
        totalsRow: [
          'TOTAL',
          '—',
          `${list.length} título(s)`,
          formatBrlFromCents(totalOriginal),
          formatBrlFromCents(totalSettled),
          formatBrlFromCents(totalPending),
          '—',
        ],
        emptyMessage: `Não há títulos em aberto em ${
          targetKind === 'receita' ? 'Contas a Receber' : 'Contas a Pagar'
        }.`,
      };
    }

    case 'inadimplencia': {
      const list = filteredEntries
        .filter(
          (e) =>
            e.kind === 'receita' &&
            getEffectiveEntryStatus(e, todayStr) === 'atrasada' &&
            getEntryPendingCents(e) > 0
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const totalOverdue = list.reduce((s, e) => s + getEntryPendingCents(e), 0);

      return {
        id: reportId,
        title: def.title,
        subtitle: def.description,
        periodLabel: `Vencidos até ${formatDateBr(todayStr)}`,
        generatedAtIso,
        summaryCards: [
          { label: 'Títulos Vencidos', value: String(list.length) },
          { label: 'Total em Inadimplência', value: formatBrlFromCents(totalOverdue) },
        ],
        columns: [
          'Vencimento',
          'Dias Atraso',
          'Cliente',
          'Descrição',
          'Valor Original',
          'Saldo Vencido',
        ],
        rows: list.map((e) => [
          formatDateBr(e.dueDate),
          `${getDaysOverdue(e, todayStr)} dia(s)`,
          (e.clientId ? clientMap.get(e.clientId) : '') || 'Receita Avulsa',
          e.description,
          formatBrlFromCents(getEntryAllowedTotalCents(e)),
          formatBrlFromCents(getEntryPendingCents(e)),
        ]),
        totalsRow: [
          'TOTAL',
          '—',
          '—',
          `${list.length} título(s)`,
          '—',
          formatBrlFromCents(totalOverdue),
        ],
        emptyMessage: 'Nenhum título em inadimplência no momento.',
      };
    }

    case 'receitas_recorrentes':
    case 'despesas_recorrentes': {
      const targetKind = reportId === 'receitas_recorrentes' ? 'receita' : 'despesa';
      const list = recurrences.filter((r) => {
        if (r.kind !== targetKind) return false;
        if (clientIdFilter && r.clientId !== clientIdFilter) return false;
        if (categoryIdFilter && r.categoryId !== categoryIdFilter) return false;
        return true;
      });
      const activeTotal = list
        .filter((r) => r.status === 'ativa')
        .reduce((s, r) => s + r.amountCents, 0);

      return {
        id: reportId,
        title: def.title,
        subtitle: def.description,
        periodLabel: 'Base ativa e histórico de recorrências',
        generatedAtIso,
        summaryCards: [
          { label: 'Recorrências Ativas', value: String(list.filter((r) => r.status === 'ativa').length) },
          { label: 'Valor Base Ativo', value: formatBrlFromCents(activeTotal) },
        ],
        columns: [
          'Nome',
          targetKind === 'receita' ? 'Cliente' : 'Fornecedor',
          'Frequência',
          'Próxima Ocorrência',
          'Valor',
          'Status',
        ],
        rows: list.map((r) => [
          r.name,
          targetKind === 'receita'
            ? (r.clientId ? clientMap.get(r.clientId) : '') || 'Kaizen'
            : r.supplierName || '—',
          getRecurrenceFrequencyLabel(r.frequency, r.customIntervalDays),
          formatDateBr(r.nextOccurrenceDate),
          formatBrlFromCents(r.amountCents),
          r.status.toUpperCase(),
        ]),
        totalsRow: [
          'TOTAL ATIVAS',
          '—',
          '—',
          '—',
          formatBrlFromCents(activeTotal),
          '—',
        ],
        emptyMessage: 'Nenhuma recorrência cadastrada neste filtro.',
      };
    }

    case 'resultado_projeto': {
      const map = new Map<
        string,
        {
          projectName: string;
          revBilled: number;
          revReceived: number;
          expTotal: number;
          expPaid: number;
        }
      >();

      for (const e of filteredEntries) {
        if (!e.projectId || e.status === 'cancelada') continue;
        const cur = map.get(e.projectId) || {
          projectName: projectMap.get(e.projectId) || e.projectId,
          revBilled: 0,
          revReceived: 0,
          expTotal: 0,
          expPaid: 0,
        };
        if (e.kind === 'receita') {
          cur.revBilled += getEntryAllowedTotalCents(e);
          cur.revReceived += e.settledCents || 0;
        } else {
          cur.expTotal += getEntryAllowedTotalCents(e);
          cur.expPaid += e.settledCents || 0;
        }
        map.set(e.projectId, cur);
      }

      const list = Array.from(map.values()).sort(
        (a, b) => b.revReceived - b.expPaid - (a.revReceived - a.expPaid)
      );
      const totalRevRec = list.reduce((s, x) => s + x.revReceived, 0);
      const totalExpPaid = list.reduce((s, x) => s + x.expPaid, 0);
      const totalResReal = totalRevRec - totalExpPaid;

      return {
        id: reportId,
        title: def.title,
        subtitle: def.description,
        periodLabel: 'Consolidado por projeto vinculado',
        generatedAtIso,
        summaryCards: [
          { label: 'Projetos c/ Lançamentos', value: String(list.length) },
          { label: 'Receita Recebida', value: formatBrlFromCents(totalRevRec) },
          { label: 'Despesa Paga', value: formatBrlFromCents(totalExpPaid) },
          { label: 'Resultado Realizado', value: formatBrlFromCents(totalResReal) },
        ],
        columns: [
          'Projeto',
          'Receita Prevista',
          'Receita Recebida',
          'Despesa Prevista',
          'Despesa Paga',
          'Resultado Realizado',
        ],
        rows: list.map((p) => [
          p.projectName,
          formatBrlFromCents(p.revBilled),
          formatBrlFromCents(p.revReceived),
          formatBrlFromCents(p.expTotal),
          formatBrlFromCents(p.expPaid),
          formatBrlFromCents(p.revReceived - p.expPaid, { signed: true }),
        ]),
        totalsRow: [
          'TOTAL',
          formatBrlFromCents(list.reduce((s, x) => s + x.revBilled, 0)),
          formatBrlFromCents(totalRevRec),
          formatBrlFromCents(list.reduce((s, x) => s + x.expTotal, 0)),
          formatBrlFromCents(totalExpPaid),
          formatBrlFromCents(totalResReal, { signed: true }),
        ],
        emptyMessage: 'Nenhum projeto possui lançamentos financeiros vinculados ainda.',
      };
    }

    case 'comparativo_mensal': {
      const cf = computeCashFlow({
        entries: filteredEntries,
        transactions,
        settings,
        startDate: addDaysYmd(`${startDate.slice(0, 7)}-01`, 0),
        endDate,
        granularity: 'mensal',
        todayStr,
      });

      const totIn = cf.buckets.reduce((s, b) => s + b.realizedInflowCents, 0);
      const totOut = cf.buckets.reduce((s, b) => s + b.realizedOutflowCents, 0);
      const totNet = totIn - totOut;

      return {
        id: reportId,
        title: def.title,
        subtitle: def.description,
        periodLabel,
        generatedAtIso,
        summaryCards: [
          { label: 'Meses Analisados', value: String(cf.buckets.length) },
          { label: 'Total Entradas', value: formatBrlFromCents(totIn) },
          { label: 'Total Saídas', value: formatBrlFromCents(totOut) },
          { label: 'Resultado Acumulado', value: formatBrlFromCents(totNet) },
        ],
        columns: [
          'Mês',
          'Receita Recebida',
          'Despesa Paga',
          'Lucro Realizado (Gerencial)',
          'Variação Saldo Caixa',
          'A Receber/Pagar Projetado (Líq.)',
        ],
        rows: cf.buckets.map((b) => [
          formatMonthYearBr(b.key),
          formatBrlFromCents(b.realizedInflowCents),
          formatBrlFromCents(b.realizedOutflowCents),
          formatBrlFromCents(b.realizedNetCents, { signed: true }),
          formatBrlFromCents(b.realizedBalanceCents),
          formatBrlFromCents(b.projectedNetCents, { signed: true }),
        ]),
        totalsRow: [
          'CONSOLIDADO',
          formatBrlFromCents(totIn),
          formatBrlFromCents(totOut),
          formatBrlFromCents(totNet, { signed: true }),
          formatBrlFromCents(cf.realizedClosingBalanceCents),
          formatBrlFromCents(cf.projectedNetCents, { signed: true }),
        ],
        emptyMessage: 'Sem dados mensais suficientes no intervalo selecionado.',
      };
    }
  }
}

export function buildGeneratedReportCsv(report: GeneratedFinancialReport): string {
  const rowsWithTotal = report.totalsRow
    ? [...report.rows, report.totalsRow]
    : report.rows;
  return buildCsvContent(report.columns, rowsWithTotal);
}
