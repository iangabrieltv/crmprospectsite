import {
  FinancialAuditLog,
  FinancialEntry,
  FinancialPaymentMethod,
  FinancialTransaction,
  getPaymentMethodLabel,
} from '../../types/finance';
import { createFinancialAuditLog } from './auditService';
import { getEntryAllowedTotalCents } from './entriesService';
import {
  buildFinancialId,
  formatBrlFromCents,
  formatDateBr,
  isValidYmd,
} from './money';

export interface RegisterSettlementParams {
  entry: FinancialEntry;
  existingTransactions: FinancialTransaction[];
  amountCents: number;
  date: string;
  paymentMethod: FinancialPaymentMethod;
  adjustmentCents?: number;
  notes?: string;
  actor: string;
}

export function computeSettledFromTransactions(
  entryId: string,
  transactions: FinancialTransaction[]
): { settledCents: number; lastSettledDate?: string } {
  const entryTxs = transactions
    .filter((t) => t.entryId === entryId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  let settledCents = 0;
  let lastSettledDate: string | undefined;

  for (const tx of entryTxs) {
    if (tx.kind === 'recebimento' || tx.kind === 'pagamento') {
      settledCents += tx.amountCents;
      lastSettledDate = tx.date;
    } else if (tx.kind === 'estorno') {
      settledCents -= tx.amountCents;
    }
  }

  settledCents = Math.max(0, settledCents);
  return {
    settledCents,
    lastSettledDate: settledCents > 0 ? lastSettledDate : undefined,
  };
}

export function registerSettlement(params: RegisterSettlementParams): {
  updatedEntry: FinancialEntry;
  createdTransactions: FinancialTransaction[];
  auditLogs: FinancialAuditLog[];
} {
  const {
    entry,
    existingTransactions,
    amountCents,
    date,
    paymentMethod,
    adjustmentCents = 0,
    notes,
    actor,
  } = params;

  if (entry.status === 'cancelada') {
    throw new Error('Não é possível registrar baixa em um lançamento cancelado.');
  }
  if (!isValidYmd(date)) {
    throw new Error('Data efetiva da movimentação é inválida.');
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('O valor da baixa deve ser um número positivo maior que R$ 0,00.');
  }
  if (!Number.isInteger(adjustmentCents)) {
    throw new Error('O ajuste de valor deve estar em centavos inteiros.');
  }

  const nextAdjustmentCents = (entry.adjustmentCents || 0) + adjustmentCents;
  const nextAllowedTotal = Math.max(0, entry.amountCents + nextAdjustmentCents);
  const currentSettled =
    existingTransactions.some((t) => t.entryId === entry.id)
      ? computeSettledFromTransactions(entry.id, existingTransactions).settledCents
      : entry.settledCents || 0;

  const projectedSettled = currentSettled + amountCents;
  if (projectedSettled > nextAllowedTotal) {
    const excessCents = projectedSettled - nextAllowedTotal;
    throw new Error(
      `O valor excede o saldo pendente em ${formatBrlFromCents(
        excessCents
      )}. Para receber/pagar acima do valor original, informe um acréscimo explícito ou reduza o valor da baixa.`
    );
  }

  const now = new Date().toISOString();
  const createdTransactions: FinancialTransaction[] = [];
  const auditLogs: FinancialAuditLog[] = [];

  if (adjustmentCents !== 0) {
    const adjTx: FinancialTransaction = {
      id: buildFinancialId('ftx'),
      entryId: entry.id,
      entryKind: entry.kind,
      kind: 'ajuste',
      amountCents: Math.abs(adjustmentCents),
      date,
      paymentMethod,
      notes: `${adjustmentCents > 0 ? 'Acréscimo' : 'Desconto'} explícito${
        notes?.trim() ? `: ${notes.trim()}` : ''
      }`,
      createdBy: actor || 'Admin',
      createdAt: now,
      schemaVersion: 1,
    };
    createdTransactions.push(adjTx);
    auditLogs.push(
      createFinancialAuditLog({
        entityType: 'entry',
        entityId: entry.id,
        action: 'ajuste',
        description: `${
          adjustmentCents > 0 ? 'Acréscimo' : 'Desconto'
        } de ${formatBrlFromCents(Math.abs(adjustmentCents))} aplicado em "${
          entry.description
        }"`,
        amountCents: Math.abs(adjustmentCents),
        actor,
        createdAt: now,
      })
    );
  }

  const txKind = entry.kind === 'receita' ? 'recebimento' : 'pagamento';
  const mainTx: FinancialTransaction = {
    id: buildFinancialId('ftx'),
    entryId: entry.id,
    entryKind: entry.kind,
    kind: txKind,
    amountCents,
    date,
    paymentMethod,
    ...(notes?.trim() ? { notes: notes.trim() } : {}),
    createdBy: actor || 'Admin',
    createdAt: now,
    schemaVersion: 1,
  };
  createdTransactions.push(mainTx);

  const isFullySettled = projectedSettled >= nextAllowedTotal && nextAllowedTotal > 0;
  const nextStatus = isFullySettled
    ? entry.kind === 'receita'
      ? 'recebida'
      : 'paga'
    : entry.kind === 'receita'
    ? 'parcialmente_recebida'
    : 'parcialmente_paga';

  const updatedEntry: FinancialEntry = {
    ...entry,
    ...(nextAdjustmentCents !== 0 ? { adjustmentCents: nextAdjustmentCents } : {}),
    settledCents: projectedSettled,
    lastSettledDate:
      !entry.lastSettledDate || date >= entry.lastSettledDate
        ? date
        : entry.lastSettledDate,
    paymentMethod,
    status: nextStatus,
    updatedAt: now,
  };

  auditLogs.push(
    createFinancialAuditLog({
      entityType: 'transaction',
      entityId: mainTx.id,
      action: txKind,
      description: `${
        txKind === 'recebimento' ? 'Recebimento' : 'Pagamento'
      } ${isFullySettled ? 'integral' : 'parcial'} de ${formatBrlFromCents(
        amountCents
      )} via ${getPaymentMethodLabel(paymentMethod)} em ${formatDateBr(
        date
      )} para "${entry.description}"`,
      amountCents,
      actor,
      createdAt: now,
    })
  );

  return { updatedEntry, createdTransactions, auditLogs };
}

export function reverseTransaction(params: {
  entry: FinancialEntry;
  transaction: FinancialTransaction;
  existingTransactions: FinancialTransaction[];
  reason: string;
  date: string;
  actor: string;
}): {
  updatedEntry: FinancialEntry;
  reversalTransaction: FinancialTransaction;
  auditLog: FinancialAuditLog;
} {
  const { entry, transaction, existingTransactions, reason, date, actor } = params;

  if (transaction.entryId !== entry.id) {
    throw new Error('A movimentação selecionada não pertence a este lançamento.');
  }
  if (transaction.kind === 'estorno' || transaction.kind === 'ajuste') {
    throw new Error('Apenas movimentações de recebimento ou pagamento podem ser estornadas.');
  }
  if (!isValidYmd(date)) {
    throw new Error('Data do estorno inválida.');
  }

  const current = computeSettledFromTransactions(entry.id, existingTransactions);
  if (transaction.amountCents > current.settledCents) {
    throw new Error(
      'Este valor excede o saldo atualmente baixado no lançamento (possível estorno já realizado).'
    );
  }

  const now = new Date().toISOString();
  const reversalTransaction: FinancialTransaction = {
    id: buildFinancialId('ftx'),
    entryId: entry.id,
    entryKind: entry.kind,
    kind: 'estorno',
    amountCents: transaction.amountCents,
    date,
    paymentMethod: transaction.paymentMethod,
    notes: `Estorno da transação ${transaction.id}: ${reason.trim() || 'Estorno manual'}`,
    createdBy: actor || 'Admin',
    createdAt: now,
    schemaVersion: 1,
  };

  const nextSummary = computeSettledFromTransactions(entry.id, [
    ...existingTransactions,
    reversalTransaction,
  ]);
  const allowedTotal = getEntryAllowedTotalCents(entry);

  const nextStatus =
    entry.status === 'cancelada'
      ? 'cancelada'
      : nextSummary.settledCents >= allowedTotal && allowedTotal > 0
      ? entry.kind === 'receita'
        ? 'recebida'
        : 'paga'
      : nextSummary.settledCents > 0
      ? entry.kind === 'receita'
        ? 'parcialmente_recebida'
        : 'parcialmente_paga'
      : 'pendente';

  const updatedEntry: FinancialEntry = {
    ...entry,
    settledCents: nextSummary.settledCents,
    lastSettledDate: nextSummary.lastSettledDate,
    status: nextStatus,
    updatedAt: now,
  };

  const auditLog = createFinancialAuditLog({
    entityType: 'transaction',
    entityId: reversalTransaction.id,
    action: 'estorno',
    description: `Estorno de ${formatBrlFromCents(
      transaction.amountCents
    )} em "${entry.description}". Motivo: ${reason.trim() || 'Estorno manual'}`,
    amountCents: transaction.amountCents,
    actor,
    createdAt: now,
  });

  return { updatedEntry, reversalTransaction, auditLog };
}
