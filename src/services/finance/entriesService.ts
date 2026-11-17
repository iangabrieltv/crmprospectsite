import {
  FinancialAuditLog,
  FinancialCategory,
  FinancialEntry,
  FinancialEntryStatus,
  FinancialKind,
  FinancialPaymentMethod,
  getPaymentMethodLabel,
  FINANCIAL_ENTRY_STATUS_META,
} from '../../types/finance';
import { Client } from '../../types/kaizen';
import { createFinancialAuditLog } from './auditService';
import { getCategoryName } from './categoriesService';
import {
  KAIZEN_TIMEZONE,
  buildCsvContent,
  buildFinancialId,
  diffDaysYmd,
  formatBrlFromCents,
  formatDateBr,
  getTodayInTimezone,
  isValidYmd,
} from './money';

export interface CreateFinancialEntryInput {
  id?: string;
  kind: FinancialKind;
  description: string;
  clientId?: string;
  supplierName?: string;
  serviceName?: string;
  projectId?: string;
  proposalId?: string;
  contractCode?: string;
  categoryId: string;
  recurrenceId?: string;
  recurrencePeriodKey?: string;
  installmentIndex?: number;
  installmentTotal?: number;
  amountCents: number;
  competenceDate: string;
  dueDate: string;
  paymentMethod: FinancialPaymentMethod;
  initialStatus?: 'prevista' | 'pendente';
  attachmentUrl?: string;
  notes?: string;
}

export function getEntryAllowedTotalCents(entry: FinancialEntry): number {
  return Math.max(0, (entry.amountCents || 0) + (entry.adjustmentCents || 0));
}

export function getEntryPendingCents(entry: FinancialEntry): number {
  if (entry.status === 'cancelada') return 0;
  return Math.max(0, getEntryAllowedTotalCents(entry) - (entry.settledCents || 0));
}

/**
 * Calcula o status efetivo em tempo de leitura sem mutar valores pagos/datas:
 * se o lançamento está em aberto e vencido (dueDate < todayStr), exibe como 'atrasada'.
 * Nunca marca um lançamento como recebido/pago automaticamente pelo vencimento.
 */
export function getEffectiveEntryStatus(
  entry: FinancialEntry,
  todayStr: string = getTodayInTimezone(KAIZEN_TIMEZONE)
): FinancialEntryStatus {
  if (entry.status === 'cancelada') return 'cancelada';

  const allowedTotal = getEntryAllowedTotalCents(entry);
  const settled = entry.settledCents || 0;

  if (allowedTotal > 0 && settled >= allowedTotal) {
    return entry.kind === 'receita' ? 'recebida' : 'paga';
  }

  if (entry.dueDate && entry.dueDate < todayStr) {
    return 'atrasada';
  }

  if (settled > 0 && settled < allowedTotal) {
    return entry.kind === 'receita' ? 'parcialmente_recebida' : 'parcialmente_paga';
  }

  if (entry.status === 'atrasada') {
    // Se a data de vencimento foi prorrogada para hoje ou futuro, deixa de estar atrasada
    return 'pendente';
  }

  return entry.status === 'prevista' ? 'prevista' : 'pendente';
}

export function getDaysOverdue(
  entry: FinancialEntry,
  todayStr: string = getTodayInTimezone(KAIZEN_TIMEZONE)
): number {
  const effective = getEffectiveEntryStatus(entry, todayStr);
  if (effective !== 'atrasada' || !entry.dueDate) return 0;
  return Math.max(0, diffDaysYmd(todayStr, entry.dueDate));
}

export function getDaysUntilDue(
  entry: FinancialEntry,
  todayStr: string = getTodayInTimezone(KAIZEN_TIMEZONE)
): number | null {
  if (!entry.dueDate || entry.status === 'cancelada') return null;
  if (getEntryPendingCents(entry) <= 0) return null;
  return diffDaysYmd(entry.dueDate, todayStr);
}

export function validateFinancialEntryInput(input: {
  description: string;
  amountCents: number;
  competenceDate: string;
  dueDate: string;
  categoryId: string;
}): string | null {
  if (!input.description || !input.description.trim()) {
    return 'Informe uma descrição para o lançamento financeiro.';
  }
  if (
    !Number.isFinite(input.amountCents) ||
    !Number.isInteger(input.amountCents) ||
    input.amountCents <= 0
  ) {
    return 'Informe um valor monetário válido e maior que R$ 0,00.';
  }
  if (!isValidYmd(input.competenceDate)) {
    return 'Data de competência inválida.';
  }
  if (!isValidYmd(input.dueDate)) {
    return 'Data de vencimento inválida.';
  }
  if (!input.categoryId || !input.categoryId.trim()) {
    return 'Selecione uma categoria financeira.';
  }
  return null;
}

export function createFinancialEntryRecord(
  input: CreateFinancialEntryInput,
  actor: string
): { entry: FinancialEntry; auditLog: FinancialAuditLog } {
  const err = validateFinancialEntryInput(input);
  if (err) {
    throw new Error(err);
  }

  const now = new Date().toISOString();
  const entry: FinancialEntry = {
    id: input.id || buildFinancialId('fin'),
    kind: input.kind,
    description: input.description.trim(),
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(input.supplierName?.trim() ? { supplierName: input.supplierName.trim() } : {}),
    ...(input.serviceName?.trim() ? { serviceName: input.serviceName.trim() } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.proposalId ? { proposalId: input.proposalId } : {}),
    ...(input.contractCode?.trim() ? { contractCode: input.contractCode.trim() } : {}),
    categoryId: input.categoryId,
    ...(input.recurrenceId ? { recurrenceId: input.recurrenceId } : {}),
    ...(input.recurrencePeriodKey
      ? { recurrencePeriodKey: input.recurrencePeriodKey }
      : {}),
    ...(input.installmentIndex !== undefined
      ? { installmentIndex: input.installmentIndex }
      : {}),
    ...(input.installmentTotal !== undefined
      ? { installmentTotal: input.installmentTotal }
      : {}),
    amountCents: input.amountCents,
    settledCents: 0,
    competenceDate: input.competenceDate,
    dueDate: input.dueDate,
    paymentMethod: input.paymentMethod,
    status: input.initialStatus || 'pendente',
    ...(input.attachmentUrl?.trim()
      ? { attachmentUrl: input.attachmentUrl.trim() }
      : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    createdAt: now,
    schemaVersion: 1,
    updatedAt: now,
  };

  const auditLog = createFinancialAuditLog({
    entityType: 'entry',
    entityId: entry.id,
    action: 'criacao',
    description: `${
      entry.kind === 'receita' ? 'Receita' : 'Despesa'
    } criada: "${entry.description}" (${formatBrlFromCents(entry.amountCents)}, venc. ${formatDateBr(
      entry.dueDate
    )})`,
    amountCents: entry.amountCents,
    actor,
    createdAt: now,
  });

  return { entry, auditLog };
}

export function updateFinancialEntryRecord(
  existing: FinancialEntry,
  patch: Partial<CreateFinancialEntryInput> & { status?: 'prevista' | 'pendente' },
  actor: string
): { entry: FinancialEntry; auditLog: FinancialAuditLog } {
  if (existing.status === 'cancelada') {
    throw new Error('Lançamentos cancelados não podem ser editados para preservar o histórico.');
  }

  const nextAmountCents =
    patch.amountCents !== undefined ? patch.amountCents : existing.amountCents;
  const nextCompetenceDate =
    patch.competenceDate !== undefined
      ? patch.competenceDate
      : existing.competenceDate;
  const nextDueDate = patch.dueDate !== undefined ? patch.dueDate : existing.dueDate;
  const nextCategoryId =
    patch.categoryId !== undefined ? patch.categoryId : existing.categoryId;
  const nextDescription =
    patch.description !== undefined ? patch.description : existing.description;

  const validationError = validateFinancialEntryInput({
    description: nextDescription,
    amountCents: nextAmountCents,
    competenceDate: nextCompetenceDate,
    dueDate: nextDueDate,
    categoryId: nextCategoryId,
  });
  if (validationError) {
    throw new Error(validationError);
  }

  const nextAllowedTotal = nextAmountCents + (existing.adjustmentCents || 0);
  if (existing.settledCents > nextAllowedTotal) {
    throw new Error(
      `O valor total (${formatBrlFromCents(
        nextAmountCents
      )}) não pode ser menor que o valor já baixado (${formatBrlFromCents(
        existing.settledCents
      )}). Registre um estorno antes de reduzir o valor.`
    );
  }

  const now = new Date().toISOString();
  const baseStatus =
    existing.settledCents > 0 && existing.settledCents >= nextAllowedTotal
      ? existing.kind === 'receita'
        ? 'recebida'
        : 'paga'
      : existing.settledCents > 0
      ? existing.kind === 'receita'
        ? 'parcialmente_recebida'
        : 'parcialmente_paga'
      : patch.status || (existing.status === 'prevista' ? 'prevista' : 'pendente');

  const updated: FinancialEntry = {
    ...existing,
    description: nextDescription.trim(),
    clientId:
      patch.clientId !== undefined ? patch.clientId || undefined : existing.clientId,
    supplierName:
      patch.supplierName !== undefined
        ? patch.supplierName.trim() || undefined
        : existing.supplierName,
    serviceName:
      patch.serviceName !== undefined
        ? patch.serviceName.trim() || undefined
        : existing.serviceName,
    projectId:
      patch.projectId !== undefined ? patch.projectId || undefined : existing.projectId,
    proposalId:
      patch.proposalId !== undefined
        ? patch.proposalId || undefined
        : existing.proposalId,
    contractCode:
      patch.contractCode !== undefined
        ? patch.contractCode.trim() || undefined
        : existing.contractCode,
    categoryId: nextCategoryId,
    amountCents: nextAmountCents,
    competenceDate: nextCompetenceDate,
    dueDate: nextDueDate,
    paymentMethod: patch.paymentMethod || existing.paymentMethod,
    attachmentUrl:
      patch.attachmentUrl !== undefined
        ? patch.attachmentUrl.trim() || undefined
        : existing.attachmentUrl,
    notes: patch.notes !== undefined ? patch.notes.trim() || undefined : existing.notes,
    status: baseStatus,
    updatedAt: now,
  };

  const dueChanged = existing.dueDate !== updated.dueDate;
  const auditLog = createFinancialAuditLog({
    entityType: 'entry',
    entityId: updated.id,
    action: dueChanged ? 'vencimento_alterado' : 'edicao',
    description: dueChanged
      ? `Vencimento alterado em "${updated.description}": de ${formatDateBr(
          existing.dueDate
        )} para ${formatDateBr(updated.dueDate)}`
      : `Lançamento atualizado: "${updated.description}" (${formatBrlFromCents(
          updated.amountCents
        )})`,
    amountCents: updated.amountCents,
    actor,
    createdAt: now,
  });

  return { entry: updated, auditLog };
}

export function cancelFinancialEntryRecord(
  existing: FinancialEntry,
  reason: string,
  actor: string
): { entry: FinancialEntry; auditLog: FinancialAuditLog } {
  if (existing.status === 'cancelada') {
    throw new Error('Este lançamento já está cancelado.');
  }
  const now = new Date().toISOString();
  const updated: FinancialEntry = {
    ...existing,
    status: 'cancelada',
    cancelledAt: now,
    cancellationReason: reason.trim() || 'Cancelamento administrativo',
    updatedAt: now,
  };
  const auditLog = createFinancialAuditLog({
    entityType: 'entry',
    entityId: existing.id,
    action: 'cancelamento',
    description: `Lançamento cancelado preservando histórico: "${existing.description}"${
      existing.settledCents > 0
        ? ` (${formatBrlFromCents(existing.settledCents)} já movimentados permanecem no histórico)`
        : ''
    }. Motivo: ${updated.cancellationReason}`,
    amountCents: existing.amountCents,
    actor,
    createdAt: now,
  });
  return { entry: updated, auditLog };
}

export function buildEntriesCsv(
  entries: FinancialEntry[],
  clients: Client[],
  categories: FinancialCategory[],
  todayStr: string = getTodayInTimezone(KAIZEN_TIMEZONE)
): string {
  const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));
  const headers = [
    'ID',
    'Tipo',
    'Descrição',
    'Cliente / Fornecedor',
    'Categoria',
    'Serviço',
    'Valor Total (R$)',
    'Valor Baixado (R$)',
    'Saldo Pendente (R$)',
    'Competência',
    'Vencimento',
    'Última Baixa',
    'Forma de Pagamento',
    'Status Efetivo',
  ];

  const rows = entries.map((entry) => {
    const entityLabel =
      entry.kind === 'receita'
        ? (entry.clientId ? clientMap.get(entry.clientId) : '') || 'Receita Avulsa'
        : entry.supplierName || 'Fornecedor não informado';
    const effStatus = getEffectiveEntryStatus(entry, todayStr);
    const pendingCents = getEntryPendingCents(entry);

    return [
      entry.id,
      entry.kind === 'receita' ? 'Receita' : 'Despesa',
      entry.description,
      entityLabel,
      getCategoryName(categories, entry.categoryId),
      entry.serviceName || '',
      (getEntryAllowedTotalCents(entry) / 100).toFixed(2).replace('.', ','),
      ((entry.settledCents || 0) / 100).toFixed(2).replace('.', ','),
      (pendingCents / 100).toFixed(2).replace('.', ','),
      formatDateBr(entry.competenceDate),
      formatDateBr(entry.dueDate),
      entry.lastSettledDate ? formatDateBr(entry.lastSettledDate) : '',
      getPaymentMethodLabel(entry.paymentMethod),
      FINANCIAL_ENTRY_STATUS_META[effStatus]?.label || effStatus,
    ];
  });

  return buildCsvContent(headers, rows);
}
