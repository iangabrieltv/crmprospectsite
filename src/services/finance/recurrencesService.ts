import {
  FinancialAuditLog,
  FinancialEntry,
  FinancialKind,
  FinancialPaymentMethod,
  FinancialRecurrence,
  FinancialRecurrenceFrequency,
  FinancialRecurrenceStatus,
} from '../../types/finance';
import { createFinancialAuditLog } from './auditService';
import {
  KAIZEN_TIMEZONE,
  addDaysYmd,
  addMonthsYmd,
  buildFinancialId,
  formatBrlFromCents,
  formatDateBr,
  getTodayInTimezone,
  isValidYmd,
} from './money';

export interface CreateRecurrenceInput {
  name: string;
  kind: FinancialKind;
  amountCents: number;
  categoryId: string;
  clientId?: string;
  supplierName?: string;
  serviceName?: string;
  projectId?: string;
  proposalId?: string;
  paymentMethod: FinancialPaymentMethod;
  frequency: FinancialRecurrenceFrequency;
  customIntervalDays?: number;
  startDate: string;
  endDate?: string;
  notes?: string;
}

export function stepNextOccurrenceDate(
  currentDate: string,
  frequency: FinancialRecurrenceFrequency,
  customIntervalDays?: number
): string {
  switch (frequency) {
    case 'semanal':
      return addDaysYmd(currentDate, 7);
    case 'mensal':
      return addMonthsYmd(currentDate, 1);
    case 'bimestral':
      return addMonthsYmd(currentDate, 2);
    case 'trimestral':
      return addMonthsYmd(currentDate, 3);
    case 'semestral':
      return addMonthsYmd(currentDate, 6);
    case 'anual':
      return addMonthsYmd(currentDate, 12);
    case 'personalizada':
      return addDaysYmd(currentDate, Math.max(1, customIntervalDays || 30));
  }
}

export function createFinancialRecurrenceRecord(
  input: CreateRecurrenceInput,
  actor: string
): { recurrence: FinancialRecurrence; auditLog: FinancialAuditLog } {
  if (!input.name.trim()) {
    throw new Error('Informe um nome para a recorrência.');
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error('Informe um valor recorrente válido maior que R$ 0,00.');
  }
  if (!isValidYmd(input.startDate)) {
    throw new Error('Data de início da recorrência é inválida.');
  }
  if (input.endDate && (!isValidYmd(input.endDate) || input.endDate < input.startDate)) {
    throw new Error('A data final não pode ser anterior à data de início.');
  }
  if (!input.categoryId) {
    throw new Error('Selecione uma categoria financeira.');
  }
  if (
    input.frequency === 'personalizada' &&
    (!input.customIntervalDays || input.customIntervalDays < 1)
  ) {
    throw new Error('Informe um intervalo em dias maior ou igual a 1.');
  }

  const now = new Date().toISOString();
  const recurrence: FinancialRecurrence = {
    id: buildFinancialId('frec'),
    name: input.name.trim(),
    kind: input.kind,
    amountCents: input.amountCents,
    categoryId: input.categoryId,
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(input.supplierName?.trim() ? { supplierName: input.supplierName.trim() } : {}),
    ...(input.serviceName?.trim() ? { serviceName: input.serviceName.trim() } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.proposalId ? { proposalId: input.proposalId } : {}),
    paymentMethod: input.paymentMethod,
    frequency: input.frequency,
    ...(input.frequency === 'personalizada'
      ? { customIntervalDays: Math.max(1, input.customIntervalDays || 30) }
      : {}),
    startDate: input.startDate,
    ...(input.endDate ? { endDate: input.endDate } : {}),
    nextOccurrenceDate: input.startDate,
    status: 'ativa',
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    createdAt: now,
    schemaVersion: 1,
    updatedAt: now,
  };

  const auditLog = createFinancialAuditLog({
    entityType: 'recurrence',
    entityId: recurrence.id,
    action: 'criacao',
    description: `Recorrência criada: "${recurrence.name}" (${formatBrlFromCents(
      recurrence.amountCents
    )}, início ${formatDateBr(recurrence.startDate)})`,
    amountCents: recurrence.amountCents,
    actor,
    createdAt: now,
  });

  return { recurrence, auditLog };
}

/**
 * Atualiza um template de recorrência para ocorrências FUTURAS sem alterar
 * os lançamentos históricos já gerados no passado.
 */
export function updateFinancialRecurrenceRecord(
  existing: FinancialRecurrence,
  patch: Partial<CreateRecurrenceInput> & { nextOccurrenceDate?: string },
  actor: string
): { recurrence: FinancialRecurrence; auditLog: FinancialAuditLog } {
  const nextAmount =
    patch.amountCents !== undefined ? patch.amountCents : existing.amountCents;
  if (!Number.isInteger(nextAmount) || nextAmount <= 0) {
    throw new Error('Valor da recorrência inválido.');
  }

  const nextStart = patch.startDate || existing.startDate;
  const nextEnd =
    patch.endDate !== undefined ? patch.endDate || undefined : existing.endDate;
  if (nextEnd && nextEnd < nextStart) {
    throw new Error('A data final não pode ser anterior à data de início.');
  }

  const now = new Date().toISOString();
  const updated: FinancialRecurrence = {
    ...existing,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    amountCents: nextAmount,
    categoryId: patch.categoryId || existing.categoryId,
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
    paymentMethod: patch.paymentMethod || existing.paymentMethod,
    frequency: patch.frequency || existing.frequency,
    customIntervalDays:
      (patch.frequency || existing.frequency) === 'personalizada'
        ? Math.max(1, patch.customIntervalDays || existing.customIntervalDays || 30)
        : undefined,
    startDate: nextStart,
    endDate: nextEnd,
    nextOccurrenceDate: patch.nextOccurrenceDate || existing.nextOccurrenceDate,
    notes: patch.notes !== undefined ? patch.notes.trim() || undefined : existing.notes,
    updatedAt: now,
  };

  const auditLog = createFinancialAuditLog({
    entityType: 'recurrence',
    entityId: updated.id,
    action: 'edicao',
    description: `Recorrência "${updated.name}" atualizada para futuras ocorrências (${formatBrlFromCents(
      updated.amountCents
    )}). Lançamentos passados preservados.`,
    amountCents: updated.amountCents,
    actor,
    createdAt: now,
  });

  return { recurrence: updated, auditLog };
}

export function changeRecurrenceStatus(
  existing: FinancialRecurrence,
  nextStatus: FinancialRecurrenceStatus,
  actor: string
): { recurrence: FinancialRecurrence; auditLog: FinancialAuditLog } {
  const now = new Date().toISOString();
  const updated: FinancialRecurrence = {
    ...existing,
    status: nextStatus,
    updatedAt: now,
  };

  const labelMap: Record<FinancialRecurrenceStatus, string> = {
    ativa: 'reativada',
    pausada: 'pausada',
    encerrada: 'encerrada',
  };

  const auditLog = createFinancialAuditLog({
    entityType: 'recurrence',
    entityId: existing.id,
    action: 'recorrencia_status',
    description: `Recorrência "${existing.name}" foi ${labelMap[nextStatus]}.`,
    actor,
    createdAt: now,
  });

  return { recurrence: updated, auditLog };
}

/**
 * Gera de forma idempotente todas as ocorrências devidas até `referenceDate` (inclusivo).
 * - Nunca gera duplicidades (usa ID determinístico `fin-rec-${rec.id}-${periodKey}` + checagem por chave).
 * - Nunca marca como recebida/paga automaticamente (gera sempre em aberto: 'pendente').
 * - Respeita pausas, encerramentos e data fim.
 */
export function generateDueRecurrenceEntries(params: {
  recurrences: FinancialRecurrence[];
  existingEntries: FinancialEntry[];
  referenceDate?: string;
  actor?: string;
}): {
  createdEntries: FinancialEntry[];
  updatedRecurrences: FinancialRecurrence[];
  auditLogs: FinancialAuditLog[];
  skippedExistingCount: number;
} {
  const {
    recurrences,
    existingEntries,
    referenceDate = getTodayInTimezone(KAIZEN_TIMEZONE),
    actor = 'Admin',
  } = params;

  const existingIds = new Set(existingEntries.map((e) => e.id));
  const existingPeriodKeys = new Set(
    existingEntries
      .filter((e) => e.recurrenceId && e.recurrencePeriodKey)
      .map((e) => `${e.recurrenceId}::${e.recurrencePeriodKey}`)
  );

  const createdEntries: FinancialEntry[] = [];
  const updatedRecurrences: FinancialRecurrence[] = [];
  const auditLogs: FinancialAuditLog[] = [];
  let skippedExistingCount = 0;

  const now = new Date().toISOString();

  for (const rec of recurrences) {
    if (rec.status !== 'ativa') continue;

    let cursor = rec.nextOccurrenceDate || rec.startDate;
    let changedRecurrence = false;
    let lastGeneratedKey = rec.lastGeneratedPeriodKey;
    let nextStatus: FinancialRecurrenceStatus = rec.status;
    let guard = 0;

    while (cursor <= referenceDate && guard < 120) {
      guard++;
      if (rec.endDate && cursor > rec.endDate) {
        nextStatus = 'encerrada';
        changedRecurrence = true;
        break;
      }

      const periodKey = cursor;
      const deterministicId = `fin-rec-${rec.id}-${periodKey}`;
      const compositeKey = `${rec.id}::${periodKey}`;

      if (!existingIds.has(deterministicId) && !existingPeriodKeys.has(compositeKey)) {
        const entry: FinancialEntry = {
          id: deterministicId,
          kind: rec.kind,
          description: `${rec.name} (${formatDateBr(periodKey).slice(3)})`,
          ...(rec.clientId ? { clientId: rec.clientId } : {}),
          ...(rec.supplierName ? { supplierName: rec.supplierName } : {}),
          ...(rec.serviceName ? { serviceName: rec.serviceName } : {}),
          ...(rec.projectId ? { projectId: rec.projectId } : {}),
          ...(rec.proposalId ? { proposalId: rec.proposalId } : {}),
          categoryId: rec.categoryId,
          recurrenceId: rec.id,
          recurrencePeriodKey: periodKey,
          amountCents: rec.amountCents,
          settledCents: 0,
          competenceDate: periodKey,
          dueDate: periodKey,
          paymentMethod: rec.paymentMethod,
          status: 'pendente',
          ...(rec.notes ? { notes: rec.notes } : {}),
          createdAt: now,
          schemaVersion: 1,
          updatedAt: now,
        };
        createdEntries.push(entry);
        existingIds.add(deterministicId);
        existingPeriodKeys.add(compositeKey);
        lastGeneratedKey = periodKey;

        auditLogs.push(
          createFinancialAuditLog({
            entityType: 'recurrence',
            entityId: rec.id,
            action: 'recorrencia_gerada',
            description: `Ocorrência recorrente gerada em aberto: "${entry.description}" (${formatBrlFromCents(
              entry.amountCents
            )}, venc. ${formatDateBr(entry.dueDate)})`,
            amountCents: entry.amountCents,
            actor,
            createdAt: now,
          })
        );
      } else {
        skippedExistingCount++;
      }

      cursor = stepNextOccurrenceDate(
        cursor,
        rec.frequency,
        rec.customIntervalDays
      );
      changedRecurrence = true;

      if (rec.endDate && cursor > rec.endDate) {
        nextStatus = 'encerrada';
        break;
      }
    }

    if (changedRecurrence) {
      updatedRecurrences.push({
        ...rec,
        nextOccurrenceDate: cursor,
        status: nextStatus,
        ...(lastGeneratedKey ? { lastGeneratedPeriodKey: lastGeneratedKey } : {}),
        lastGeneratedAt: now,
        updatedAt: now,
      });
    }
  }

  return {
    createdEntries,
    updatedRecurrences,
    auditLogs,
    skippedExistingCount,
  };
}
