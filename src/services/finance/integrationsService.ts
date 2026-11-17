import {
  FinancialAuditLog,
  FinancialEntry,
  FinancialPaymentMethod,
  FinancialRecurrence,
  FinancialTransaction,
} from '../../types/finance';
import { Client, Project, ProposalContract } from '../../types/kaizen';
import { createFinancialAuditLog } from './auditService';
import {
  getEffectiveEntryStatus,
  getEntryAllowedTotalCents,
  getEntryPendingCents,
} from './entriesService';
import {
  KAIZEN_TIMEZONE,
  addMonthsYmd,
  buildFinancialId,
  formatBrlFromCents,
  formatDateBr,
  getTodayInTimezone,
  isValidYmd,
} from './money';
import { createFinancialRecurrenceRecord } from './recurrencesService';

export interface ClientFinancialSummary {
  contractedSetupCents: number;
  contractedMrrCents: number;
  billedTotalCents: number;
  receivedTotalCents: number;
  pendingTotalCents: number;
  overdueTotalCents: number;
  overdueCount: number;
  entries: FinancialEntry[];
  recentTransactions: FinancialTransaction[];
}

/**
 * Consolida os números financeiros reais do cliente sem somar em duplicidade
 * valores de contrato com lançamentos já faturados.
 */
export function computeClientFinancialSummary(params: {
  client: Client;
  proposals: ProposalContract[];
  entries: FinancialEntry[];
  transactions: FinancialTransaction[];
  todayStr?: string;
}): ClientFinancialSummary {
  const {
    client,
    proposals,
    entries,
    transactions,
    todayStr = getTodayInTimezone(KAIZEN_TIMEZONE),
  } = params;

  const acceptedProposals = proposals.filter(
    (p) =>
      p.clientId === client.id &&
      (p.status === 'aprovada' || p.status === 'assinada')
  );

  // Valor contratado vem exclusivamente dos contratos/cadastro comercial do cliente
  const contractedSetupCents =
    acceptedProposals.length > 0
      ? acceptedProposals.reduce(
          (sum, p) => sum + Math.round((p.setupTotal || 0) * 100),
          0
        )
      : Math.round((client.setupValue || 0) * 100);

  const contractedMrrCents =
    acceptedProposals.length > 0
      ? acceptedProposals.reduce(
          (sum, p) => sum + Math.round((p.monthlyMrr || 0) * 100),
          0
        )
      : Math.round((client.monthlyMrr || 0) * 100);

  const clientEntries = entries
    .filter((e) => e.clientId === client.id)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  let billedTotalCents = 0;
  let receivedTotalCents = 0;
  let pendingTotalCents = 0;
  let overdueTotalCents = 0;
  let overdueCount = 0;

  const clientEntryIds = new Set(clientEntries.map((e) => e.id));

  for (const entry of clientEntries) {
    if (entry.kind !== 'receita') continue;
    if (entry.status !== 'cancelada') {
      billedTotalCents += getEntryAllowedTotalCents(entry);
    }
    receivedTotalCents += entry.settledCents || 0;
    const pending = getEntryPendingCents(entry);
    pendingTotalCents += pending;
    if (getEffectiveEntryStatus(entry, todayStr) === 'atrasada') {
      overdueTotalCents += pending;
      overdueCount += 1;
    }
  }

  const recentTransactions = transactions
    .filter((t) => clientEntryIds.has(t.entryId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  return {
    contractedSetupCents,
    contractedMrrCents,
    billedTotalCents,
    receivedTotalCents,
    pendingTotalCents,
    overdueTotalCents,
    overdueCount,
    entries: clientEntries,
    recentTransactions,
  };
}

export interface ProjectFinancialSummary {
  contractedValueCents: number;
  billedRevenueCents: number;
  receivedRevenueCents: number;
  pendingRevenueCents: number;
  linkedExpensesTotalCents: number;
  paidExpensesCents: number;
  pendingExpensesCents: number;
  realizedResultCents: number;
  projectedResultCents: number;
  entries: FinancialEntry[];
}

export function computeProjectFinancialSummary(params: {
  project: Project;
  proposals: ProposalContract[];
  entries: FinancialEntry[];
}): ProjectFinancialSummary {
  const { project, proposals, entries } = params;

  const linkedProposal = project.proposalId
    ? proposals.find((p) => p.id === project.proposalId)
    : undefined;

  const contractedValueCents = linkedProposal
    ? Math.round(((linkedProposal.setupTotal || 0) + (linkedProposal.monthlyMrr || 0)) * 100)
    : 0;

  const projectEntries = entries
    .filter((e) => e.projectId === project.id)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  let billedRevenueCents = 0;
  let receivedRevenueCents = 0;
  let pendingRevenueCents = 0;
  let linkedExpensesTotalCents = 0;
  let paidExpensesCents = 0;
  let pendingExpensesCents = 0;

  for (const entry of projectEntries) {
    if (entry.status === 'cancelada') continue;
    const total = getEntryAllowedTotalCents(entry);
    const pending = getEntryPendingCents(entry);

    if (entry.kind === 'receita') {
      billedRevenueCents += total;
      receivedRevenueCents += entry.settledCents || 0;
      pendingRevenueCents += pending;
    } else {
      linkedExpensesTotalCents += total;
      paidExpensesCents += entry.settledCents || 0;
      pendingExpensesCents += pending;
    }
  }

  return {
    contractedValueCents,
    billedRevenueCents,
    receivedRevenueCents,
    pendingRevenueCents,
    linkedExpensesTotalCents,
    paidExpensesCents,
    pendingExpensesCents,
    realizedResultCents: receivedRevenueCents - paidExpensesCents,
    projectedResultCents: billedRevenueCents - linkedExpensesTotalCents,
    entries: projectEntries,
  };
}

export type ProposalBillingMode = 'pontual' | 'parcelado' | 'recorrente';

export interface BuildProposalFinancialInput {
  proposal: ProposalContract;
  mode: ProposalBillingMode;
  firstDueDate: string; // YYYY-MM-DD
  installmentsCount?: number;
  paymentMethod: FinancialPaymentMethod;
  includeSetup?: boolean;
  includeMrr?: boolean;
  setupCategoryId?: string;
  mrrCategoryId?: string;
  actor: string;
}

/**
 * Gera previsão financeira explícita a partir de uma proposta/contrato aprovado ou assinado.
 * - Previne duplicação verificando proposalId nos lançamentos/recorrências existentes.
 * - Nunca sobrescreve baixas reais já confirmadas.
 * - Nunca marca automaticamente como recebido ao fechar contrato.
 */
export function buildProposalFinancialForecast(
  input: BuildProposalFinancialInput,
  existingEntries: FinancialEntry[],
  existingRecurrences: FinancialRecurrence[]
): {
  entries: FinancialEntry[];
  recurrences: FinancialRecurrence[];
  auditLogs: FinancialAuditLog[];
} {
  const {
    proposal,
    mode,
    firstDueDate,
    installmentsCount = 2,
    paymentMethod,
    includeSetup = true,
    includeMrr = true,
    setupCategoryId = 'fcat-rec-setup',
    mrrCategoryId = 'fcat-rec-mrr',
    actor,
  } = input;

  if (!isValidYmd(firstDueDate)) {
    throw new Error('Data do primeiro vencimento inválida.');
  }

  const existingActiveForProposal = existingEntries.filter(
    (e) => e.proposalId === proposal.id && e.status !== 'cancelada'
  );
  const existingRecsForProposal = existingRecurrences.filter(
    (r) => r.proposalId === proposal.id && r.status !== 'encerrada'
  );

  if (existingActiveForProposal.length > 0 || existingRecsForProposal.length > 0) {
    throw new Error(
      `Já existe previsão financeira vinculada ao documento ${proposal.code} (${existingActiveForProposal.length} lançamento(s) e ${existingRecsForProposal.length} recorrência(s)). Gerencie os registros existentes no Financeiro para evitar duplicação.`
    );
  }

  const setupCents = includeSetup ? Math.round((proposal.setupTotal || 0) * 100) : 0;
  const mrrCents = includeMrr ? Math.round((proposal.monthlyMrr || 0) * 100) : 0;

  if (setupCents <= 0 && mrrCents <= 0) {
    throw new Error(
      'Esta proposta não possui valor de implantação ou mensalidade selecionado maior que zero.'
    );
  }

  const now = new Date().toISOString();
  const createdEntries: FinancialEntry[] = [];
  const createdRecurrences: FinancialRecurrence[] = [];
  const auditLogs: FinancialAuditLog[] = [];

  const serviceSummary = proposal.items
    .map((i) => i.title)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');

  if (setupCents > 0) {
    if (mode === 'parcelado' && installmentsCount > 1) {
      const n = Math.min(24, Math.max(2, Math.floor(installmentsCount)));
      const baseInstallment = Math.floor(setupCents / n);
      const remainder = setupCents - baseInstallment * n;

      for (let idx = 0; idx < n; idx++) {
        const installmentAmount =
          idx === 0 ? baseInstallment + remainder : baseInstallment;
        const dueYmd = addMonthsYmd(firstDueDate, idx);
        const entry: FinancialEntry = {
          id: buildFinancialId('fin'),
          kind: 'receita',
          description: `${proposal.code} · ${proposal.title} (Parcela ${idx + 1}/${n})`,
          ...(proposal.clientId ? { clientId: proposal.clientId } : {}),
          ...(serviceSummary ? { serviceName: serviceSummary } : {}),
          proposalId: proposal.id,
          contractCode: proposal.code,
          categoryId: setupCategoryId,
          installmentIndex: idx + 1,
          installmentTotal: n,
          amountCents: installmentAmount,
          settledCents: 0,
          competenceDate: dueYmd,
          dueDate: dueYmd,
          paymentMethod,
          status: idx === 0 ? 'pendente' : 'prevista',
          notes: `Gerado a partir de ${proposal.code} (${proposal.recipientCompany})`,
          createdAt: now,
          schemaVersion: 1,
          updatedAt: now,
        };
        createdEntries.push(entry);
      }
    } else {
      const entry: FinancialEntry = {
        id: buildFinancialId('fin'),
        kind: 'receita',
        description: `${proposal.code} · Implantação / Setup — ${proposal.title}`,
        ...(proposal.clientId ? { clientId: proposal.clientId } : {}),
        ...(serviceSummary ? { serviceName: serviceSummary } : {}),
        proposalId: proposal.id,
        contractCode: proposal.code,
        categoryId: setupCategoryId,
        amountCents: setupCents,
        settledCents: 0,
        competenceDate: firstDueDate,
        dueDate: firstDueDate,
        paymentMethod,
        status: 'pendente',
        notes: `Gerado a partir de ${proposal.code} (${proposal.recipientCompany})`,
        createdAt: now,
        schemaVersion: 1,
        updatedAt: now,
      };
      createdEntries.push(entry);
    }
  }

  if (mrrCents > 0) {
    if (mode === 'recorrente' || mode === 'pontual' || mode === 'parcelado') {
      // Se tiver mensalidade: em modo 'recorrente' ou quando incluir MRR, cria recorrência mensal
      // e a primeira parcela em aberto caso ainda não exista para o primeiro vencimento
      const recStart =
        setupCents > 0 && mode !== 'recorrente'
          ? addMonthsYmd(firstDueDate, 1)
          : firstDueDate;

      const { recurrence, auditLog } = createFinancialRecurrenceRecord(
        {
          name: `${proposal.code} · Mensalidade ${proposal.recipientCompany}`,
          kind: 'receita',
          amountCents: mrrCents,
          categoryId: mrrCategoryId,
          clientId: proposal.clientId,
          serviceName: serviceSummary || 'Assessoria Mensal Kaizen',
          proposalId: proposal.id,
          paymentMethod,
          frequency: 'mensal',
          startDate: recStart,
          notes: `Recorrência vinculada ao contrato ${proposal.code}`,
        },
        actor
      );

      // Cria a 1ª parcela prevista vinculada ao contrato imediatamente para visibilidade em Contas a Receber
      const firstMrrEntry: FinancialEntry = {
        id: `fin-rec-${recurrence.id}-${recStart}`,
        kind: 'receita',
        description: `${recurrence.name} (${formatDateBr(recStart).slice(3)})`,
        ...(proposal.clientId ? { clientId: proposal.clientId } : {}),
        ...(serviceSummary ? { serviceName: serviceSummary } : {}),
        proposalId: proposal.id,
        contractCode: proposal.code,
        categoryId: mrrCategoryId,
        recurrenceId: recurrence.id,
        recurrencePeriodKey: recStart,
        amountCents: mrrCents,
        settledCents: 0,
        competenceDate: recStart,
        dueDate: recStart,
        paymentMethod,
        status: 'prevista',
        notes: `1ª mensalidade vinculada ao contrato ${proposal.code}`,
        createdAt: now,
        schemaVersion: 1,
        updatedAt: now,
      };

      recurrence.nextOccurrenceDate = addMonthsYmd(recStart, 1);
      recurrence.lastGeneratedPeriodKey = recStart;
      recurrence.lastGeneratedAt = now;

      createdRecurrences.push(recurrence);
      createdEntries.push(firstMrrEntry);
      auditLogs.push(auditLog);
    }
  }

  auditLogs.push(
    createFinancialAuditLog({
      entityType: 'entry',
      entityId: proposal.id,
      action: 'integracao_proposta',
      description: `Previsão financeira gerada para ${proposal.code} (${proposal.recipientCompany}): ${
        createdEntries.length
      } lançamento(s) e ${createdRecurrences.length} recorrência(s), total previsto ${formatBrlFromCents(
        createdEntries.reduce((s, e) => s + e.amountCents, 0)
      )}.`,
      amountCents: createdEntries.reduce((s, e) => s + e.amountCents, 0),
      actor,
      createdAt: now,
    })
  );

  return {
    entries: createdEntries,
    recurrences: createdRecurrences,
    auditLogs,
  };
}
