import React, { useEffect, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { Modal, Button, Input, Select, Textarea, Alert, Badge } from '../ui';
import {
  FINANCIAL_ENTRY_STATUS_META,
  FINANCIAL_PAYMENT_METHOD_OPTIONS,
  FinancialAuditLog,
  FinancialEntry,
  FinancialPaymentMethod,
  FinancialTransaction,
  getPaymentMethodLabel,
} from '../../types/finance';
import {
  KAIZEN_TIMEZONE,
  centsToInputValue,
  formatBrlFromCents,
  formatDateBr,
  getEffectiveEntryStatus,
  getEntryAllowedTotalCents,
  getEntryPendingCents,
  getTodayInTimezone,
  parseBrlToCents,
} from '../../services/finance';

interface FinanceSettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: FinancialEntry | null;
  transactions: FinancialTransaction[];
  auditLogs: FinancialAuditLog[];
  onConfirmSettlement: (params: {
    entry: FinancialEntry;
    amountCents: number;
    date: string;
    paymentMethod: FinancialPaymentMethod;
    adjustmentCents?: number;
    notes?: string;
  }) => Promise<void>;
  onReverseTransaction: (params: {
    entry: FinancialEntry;
    transaction: FinancialTransaction;
    reason: string;
    date: string;
  }) => Promise<void>;
}

export const FinanceSettleModal: React.FC<FinanceSettleModalProps> = ({
  isOpen,
  onClose,
  entry,
  transactions,
  auditLogs,
  onConfirmSettlement,
  onReverseTransaction,
}) => {
  const today = getTodayInTimezone(KAIZEN_TIMEZONE);
  const [amountInput, setAmountInput] = useState('');
  const [adjustmentInput, setAdjustmentInput] = useState('');
  const [date, setDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState<FinancialPaymentMethod>('pix');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [reversingTx, setReversingTx] = useState<FinancialTransaction | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  useEffect(() => {
    if (!isOpen || !entry) return;
    setError(null);
    setReversingTx(null);
    setReverseReason('');
    const pending = getEntryPendingCents(entry);
    setAmountInput(pending > 0 ? centsToInputValue(pending) : '');
    setAdjustmentInput('');
    setDate(today);
    setPaymentMethod(entry.paymentMethod || 'pix');
    setNotes('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entry?.id]);

  if (!entry) return null;

  const entryTxs = transactions
    .filter((t) => t.entryId === entry.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const txIds = new Set(entryTxs.map((t) => t.id));
  const relatedLogs = auditLogs
    .filter((l) => l.entityId === entry.id || txIds.has(l.entityId))
    .slice(0, 12);

  const allowedTotal = getEntryAllowedTotalCents(entry);
  const pendingCents = getEntryPendingCents(entry);
  const effStatus = getEffectiveEntryStatus(entry, today);
  const statusMeta = FINANCIAL_ENTRY_STATUS_META[effStatus];
  const isReceita = entry.kind === 'receita';

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amountCents = parseBrlToCents(amountInput);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError('Informe um valor positivo válido em R$.');
      return;
    }

    let adjustmentCents = 0;
    if (adjustmentInput.trim()) {
      const parsedAdj = parseBrlToCents(adjustmentInput);
      if (!Number.isFinite(parsedAdj)) {
        setError('Valor de acréscimo/desconto inválido.');
        return;
      }
      adjustmentCents = parsedAdj;
    }

    setSubmitting(true);
    try {
      await onConfirmSettlement({
        entry,
        amountCents,
        date,
        paymentMethod,
        ...(adjustmentCents !== 0 ? { adjustmentCents } : {}),
        notes,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar movimentação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverse = async () => {
    if (!reversingTx) return;
    setSubmitting(true);
    setError(null);
    try {
      await onReverseTransaction({
        entry,
        transaction: reversingTx,
        reason: reverseReason || 'Estorno manual registrado no histórico',
        date: today,
      });
      setReversingTx(null);
      setReverseReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao estornar movimentação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      closeDisabled={submitting}
      title={isReceita ? 'Registrar Recebimento & Histórico' : 'Registrar Pagamento & Histórico'}
      subtitle={entry.description}
      icon={
        <div className="w-9 h-9 rounded-full bg-[var(--kz-success-bg)] flex items-center justify-center text-[var(--kz-success-text)]">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Fechar
          </Button>
          {pendingCents > 0 && entry.status !== 'cancelada' && (
            <Button
              type="submit"
              form="kz-settle-form"
              variant="primary"
              loading={submitting}
            >
              {isReceita ? 'Confirmar Recebimento' : 'Confirmar Pagamento'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <Alert variant="danger" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Resumo do título */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-subtle)] rounded-xl p-3 text-xs">
          <div>
            <span className="text-[11px] text-[var(--kz-text-muted)] block">Total</span>
            <span className="font-mono font-bold text-[var(--kz-text-primary)]">
              {formatBrlFromCents(allowedTotal)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[var(--kz-text-muted)] block">
              {isReceita ? 'Já Recebido' : 'Já Pago'}
            </span>
            <span className="font-mono font-bold text-[var(--kz-success-text)]">
              {formatBrlFromCents(entry.settledCents || 0)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[var(--kz-text-muted)] block">Em Aberto</span>
            <span className="font-mono font-bold text-[var(--kz-warning-text)]">
              {formatBrlFromCents(pendingCents)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[var(--kz-text-muted)] block">Status Atual</span>
            <Badge variant={statusMeta.variant} className="mt-0.5">
              {statusMeta.label}
            </Badge>
          </div>
        </div>

        {/* Formulário de nova baixa */}
        {pendingCents > 0 && entry.status !== 'cancelada' && (
          <form id="kz-settle-form" onSubmit={handleSettleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label={isReceita ? 'Valor Recebido (R$)' : 'Valor Pago (R$)'}
                required
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="Ex: 500,00"
                className="font-mono"
                helperText="Aceita baixa parcial ou integral"
              />
              <Input
                label="Data Efetiva"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Select
                label="Meio de Pagamento"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as FinancialPaymentMethod)}
              >
                {FINANCIAL_PAYMENT_METHOD_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Acréscimo / Desconto explícito (R$, opcional)"
                value={adjustmentInput}
                onChange={(e) => setAdjustmentInput(e.target.value)}
                placeholder="Ex: 25,00 ou -50,00"
                className="font-mono"
                helperText="Use para juros/multa (+) ou desconto (-) sem alterar histórico"
              />
              <Input
                label="Observação da baixa (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Comprovante Pix enviado"
              />
            </div>
          </form>
        )}

        {/* Movimentações reais registradas */}
        <div className="space-y-2">
          <h4 className="kz-label">Movimentações Confirmadas (Razão Imutável)</h4>
          {entryTxs.length === 0 ? (
            <p className="text-xs text-[var(--kz-text-muted)]">
              Nenhuma movimentação financeira confirmada para este título até o momento.
            </p>
          ) : (
            <div className="divide-y divide-[var(--kz-border-subtle)] border border-[var(--kz-border-subtle)] rounded-xl bg-[var(--kz-bg-canvas)]">
              {entryTxs.map((tx) => (
                <div
                  key={tx.id}
                  className="px-3 py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--kz-text-primary)]">
                      {tx.kind === 'recebimento'
                        ? 'Recebimento'
                        : tx.kind === 'pagamento'
                        ? 'Pagamento'
                        : tx.kind === 'estorno'
                        ? 'Estorno'
                        : 'Ajuste'}{' '}
                      · {formatDateBr(tx.date)} · {getPaymentMethodLabel(tx.paymentMethod)}
                    </div>
                    {tx.notes && (
                      <div className="text-[11px] text-[var(--kz-text-muted)] truncate">
                        {tx.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-mono font-bold ${
                        tx.kind === 'estorno'
                          ? 'text-[var(--kz-danger-text)]'
                          : 'text-[var(--kz-success-text)]'
                      }`}
                    >
                      {tx.kind === 'estorno' ? '-' : ''}
                      {formatBrlFromCents(tx.amountCents)}
                    </span>
                    {(tx.kind === 'recebimento' || tx.kind === 'pagamento') &&
                      entry.settledCents >= tx.amountCents && (
                        <Button
                          variant="ghost"
                          size="xs"
                          leftIcon={<RotateCcw className="w-3 h-3" />}
                          onClick={() => setReversingTx(tx)}
                        >
                          Estornar
                        </Button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {reversingTx && (
            <div className="p-3 rounded-xl border border-[var(--kz-danger-border)] bg-[var(--kz-danger-bg)]/40 space-y-2">
              <div className="text-xs font-semibold text-[var(--kz-danger-text)]">
                Confirmar estorno de {formatBrlFromCents(reversingTx.amountCents)} (
                {formatDateBr(reversingTx.date)})
              </div>
              <Textarea
                rows={2}
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="Motivo do estorno (obrigatório para trilha de auditoria)"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setReversingTx(null)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  size="xs"
                  loading={submitting}
                  onClick={handleReverse}
                >
                  Confirmar Estorno
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Trilha de auditoria do título */}
        {relatedLogs.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="kz-label">Auditoria do Lançamento</h4>
            <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] text-[var(--kz-text-muted)]">
              {relatedLogs.map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-2">
                  <span>
                    • {log.description}{' '}
                    <span className="text-[var(--kz-text-subtle)]">({log.actor})</span>
                  </span>
                  <span className="font-mono shrink-0">
                    {formatDateBr(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
