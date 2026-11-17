import React, { useMemo, useState } from 'react';
import {
  Client,
  ProposalContract,
  ProposalStatus,
  getProposalStatusMeta,
} from '../types/kaizen';
import {
  FINANCIAL_PAYMENT_METHOD_OPTIONS,
  FinancialEntry,
  FinancialPaymentMethod,
  FinancialRecurrence,
} from '../types/finance';
import { findDuplicateClient } from '../services/clientService';
import { buildProposalWhatsAppMessage } from '../services/proposalService';
import { downloadProposalPdf } from '../services/pdfService';
import {
  BuildProposalFinancialInput,
  KAIZEN_TIMEZONE,
  ProposalBillingMode,
  formatBrlFromCents,
  getTodayInTimezone,
} from '../services/finance';
import { buildWhatsAppLink } from '../utils/phone';
import {
  Modal,
  ConfirmDialog,
  Button,
  Badge,
  Alert,
  Input,
  Select,
} from './ui';
import {
  Download,
  Edit3,
  MessageCircle,
  CheckCircle2,
  FileCheck2,
  Send,
  XCircle,
  Trash2,
  UserCheck,
  Clock,
  Wallet,
} from 'lucide-react';

interface ProposalPreviewModalProps {
  proposal: ProposalContract;
  clients: Client[];
  financialEntries?: FinancialEntry[];
  financialRecurrences?: FinancialRecurrence[];
  onClose: () => void;
  onEdit: (proposal: ProposalContract) => void;
  onDelete: (proposalId: string) => Promise<void>;
  onTransitionStatus: (
    proposal: ProposalContract,
    nextStatus: ProposalStatus,
    note?: string
  ) => Promise<void>;
  onApproveAndSyncClient: (proposal: ProposalContract) => Promise<Client>;
  onOpenClient?: (client: Client) => void;
  onGenerateFinancialForecast?: (
    input: Omit<BuildProposalFinancialInput, 'actor'>
  ) => Promise<{ createdEntriesCount: number; createdRecurrencesCount: number }>;
  onOpenFinance?: () => void;
}

export const ProposalPreviewModal: React.FC<ProposalPreviewModalProps> = ({
  proposal,
  clients,
  financialEntries = [],
  financialRecurrences = [],
  onClose,
  onEdit,
  onDelete,
  onTransitionStatus,
  onApproveAndSyncClient,
  onOpenClient,
  onGenerateFinancialForecast,
  onOpenFinance,
}) => {
  const [isBusy, setIsBusy] = useState(false);
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Explicit Financial Forecast generation form state
  const [showForecastForm, setShowForecastForm] = useState(false);
  const [forecastMode, setForecastMode] = useState<ProposalBillingMode>(
    proposal.setupTotal > 0 ? 'pontual' : 'recorrente'
  );
  const [installmentsCount, setInstallmentsCount] = useState(2);
  const [firstDueDate, setFirstDueDate] = useState(
    getTodayInTimezone(KAIZEN_TIMEZONE)
  );
  const [paymentMethod, setPaymentMethod] =
    useState<FinancialPaymentMethod>('pix');
  const [includeSetup, setIncludeSetup] = useState(proposal.setupTotal > 0);
  const [includeMrr, setIncludeMrr] = useState(proposal.monthlyMrr > 0);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [forecastFeedback, setForecastFeedback] = useState<string | null>(null);

  const statusMeta = getProposalStatusMeta(proposal.status);

  const linkedClient = useMemo(() => {
    if (proposal.clientId) {
      const exact = clients.find((c) => c.id === proposal.clientId);
      if (exact) return exact;
    }
    const match = findDuplicateClient(clients, {
      originLeadId: proposal.leadId,
      phone: proposal.recipientPhone,
      companyName: proposal.recipientCompany,
    });
    return match?.existingClient || null;
  }, [clients, proposal]);

  const handleDownloadPdf = () => {
    const filename = downloadProposalPdf(proposal);
    setPdfFeedback(`PDF gerado e baixado: ${filename}`);
    setTimeout(() => setPdfFeedback(null), 4000);
  };

  const handleStatusAction = async (nextStatus: ProposalStatus, note?: string) => {
    setIsBusy(true);
    try {
      await onTransitionStatus(proposal, nextStatus, note);
    } finally {
      setIsBusy(false);
    }
  };

  const handleConvertOrSyncClient = async () => {
    setIsBusy(true);
    try {
      const syncedClient = await onApproveAndSyncClient(proposal);
      if (onOpenClient) {
        onClose();
        onOpenClient(syncedClient);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsBusy(true);
    try {
      await onDelete(proposal.id);
      setShowDeleteConfirm(false);
      onClose();
    } finally {
      setIsBusy(false);
    }
  };

  const existingForecastEntries = useMemo(
    () =>
      financialEntries.filter(
        (e) => e.proposalId === proposal.id && e.status !== 'cancelada'
      ),
    [financialEntries, proposal.id]
  );

  const existingForecastRecs = useMemo(
    () =>
      financialRecurrences.filter(
        (r) => r.proposalId === proposal.id && r.status !== 'encerrada'
      ),
    [financialRecurrences, proposal.id]
  );

  const hasExistingForecast =
    existingForecastEntries.length > 0 || existingForecastRecs.length > 0;

  const handleConfirmForecast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onGenerateFinancialForecast) return;
    setForecastError(null);
    setForecastFeedback(null);
    setIsBusy(true);
    try {
      const result = await onGenerateFinancialForecast({
        proposal,
        mode: forecastMode,
        firstDueDate,
        installmentsCount: forecastMode === 'parcelado' ? installmentsCount : undefined,
        paymentMethod,
        includeSetup,
        includeMrr,
      });
      setShowForecastForm(false);
      setForecastFeedback(
        `Previsão financeira criada: ${result.createdEntriesCount} lançamento(s) em aberto e ${result.createdRecurrencesCount} recorrência(s). Nenhuma baixa foi marcada automaticamente.`
      );
    } catch (err) {
      setForecastError(
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar a previsão financeira.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const whatsAppUrl = proposal.recipientPhone
    ? buildWhatsAppLink(proposal.recipientPhone, buildProposalWhatsAppMessage(proposal))
    : null;

  const isAcceptedOrSigned =
    proposal.status === 'aprovada' || proposal.status === 'assinada';

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        size="xl"
        title={`${proposal.code} — ${proposal.title}`}
        subtitle={`${
          proposal.kind === 'contrato' ? 'Contrato' : 'Proposta Comercial'
        } · Destinatário: ${proposal.recipientCompany}`}
        footer={
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 className="w-3.5 h-3.5 text-[var(--kz-danger-solid)]" />}
              className="text-[var(--kz-danger-text)] hover:bg-[var(--kz-danger-bg)]"
              disabled={isBusy}
              onClick={() => setShowDeleteConfirm(true)}
            >
              Excluir
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {whatsAppUrl && (
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)] hover:bg-emerald-500/20 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Enviar no WhatsApp</span>
                </a>
              )}

              <Button
                variant="outline"
                size="sm"
                leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                disabled={isBusy}
                onClick={() => {
                  onClose();
                  onEdit(proposal);
                }}
              >
                Editar
              </Button>

              <Button
                variant="primary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={handleDownloadPdf}
              >
                Baixar PDF
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {pdfFeedback && <Alert variant="success">{pdfFeedback}</Alert>}

          {/* Status & Workflow Bar */}
          <div className="p-3.5 rounded-xl bg-[var(--kz-bg-subtle)]/75 border border-[var(--kz-border-subtle)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge variant={statusMeta.variant} dot size="md">
                {statusMeta.label}
              </Badge>
              {linkedClient && onOpenClient && (
                <Button
                  variant="ghost"
                  size="xs"
                  leftIcon={<UserCheck className="w-3.5 h-3.5 text-[var(--kz-success-text)]" />}
                  onClick={() => {
                    onClose();
                    onOpenClient(linkedClient);
                  }}
                >
                  Cliente: {linkedClient.companyName}
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {proposal.status === 'rascunho' && (
                <Button
                  variant="outline"
                  size="xs"
                  loading={isBusy}
                  leftIcon={<Send className="w-3 h-3" />}
                  onClick={() =>
                    handleStatusAction('enviada', 'Marcada como enviada ao cliente.')
                  }
                >
                  Marcar Enviada
                </Button>
              )}
              {(proposal.status === 'enviada' ||
                proposal.status === 'em_negociacao') && (
                <>
                  {proposal.status !== 'em_negociacao' && (
                    <Button
                      variant="outline"
                      size="xs"
                      loading={isBusy}
                      onClick={() =>
                        handleStatusAction('em_negociacao', 'Proposta em negociação.')
                      }
                    >
                      Em Negociação
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="xs"
                    loading={isBusy}
                    leftIcon={<XCircle className="w-3 h-3 text-[var(--kz-danger-solid)]" />}
                    onClick={() =>
                      handleStatusAction('recusada', 'Proposta recusada pelo cliente.')
                    }
                  >
                    Recusar
                  </Button>
                </>
              )}
              {!isAcceptedOrSigned && (
                <Button
                  variant="secondary"
                  size="xs"
                  loading={isBusy}
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-[var(--kz-success-solid)]" />}
                  onClick={handleConvertOrSyncClient}
                >
                  Aprovar & Vincular Cliente
                </Button>
              )}
              {proposal.status === 'aprovada' && (
                <Button
                  variant="primary"
                  size="xs"
                  loading={isBusy}
                  leftIcon={<FileCheck2 className="w-3.5 h-3.5" />}
                  onClick={() =>
                    handleStatusAction('assinada', 'Contrato formalmente assinado.')
                  }
                >
                  Marcar como Assinada
                </Button>
              )}
              {isAcceptedOrSigned && !linkedClient && (
                <Button
                  variant="primary"
                  size="xs"
                  loading={isBusy}
                  leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                  onClick={handleConvertOrSyncClient}
                >
                  Gerar Ficha do Cliente
                </Button>
              )}
              {isAcceptedOrSigned &&
                onGenerateFinancialForecast &&
                !hasExistingForecast && (
                  <Button
                    variant="outline"
                    size="xs"
                    leftIcon={<Wallet className="w-3.5 h-3.5 text-[var(--kz-accent)]" />}
                    onClick={() => {
                      setForecastError(null);
                      setShowForecastForm((prev) => !prev);
                    }}
                  >
                    Gerar Previsão Financeira
                  </Button>
                )}
              {hasExistingForecast && onOpenFinance && (
                <Button
                  variant="outline"
                  size="xs"
                  leftIcon={<Wallet className="w-3.5 h-3.5 text-[var(--kz-success-solid)]" />}
                  onClick={() => {
                    onClose();
                    onOpenFinance();
                  }}
                >
                  Ver no Financeiro ({existingForecastEntries.length})
                </Button>
              )}
            </div>
          </div>

          {forecastFeedback && <Alert variant="success">{forecastFeedback}</Alert>}

          {showForecastForm && (
            <form
              onSubmit={handleConfirmForecast}
              className="p-4 rounded-xl bg-[var(--kz-bg-surface)] border border-[var(--kz-accent-border)] space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[var(--kz-text-primary)]">
                    Gerar Previsão Financeira a partir de {proposal.code}
                  </div>
                  <div className="text-[11px] text-[var(--kz-text-muted)]">
                    Cria lançamentos em aberto (previstos/pendentes). Recebimentos são confirmados apenas na baixa manual.
                  </div>
                </div>
                <Badge variant="accent" size="sm">
                  Setup {formatBrlFromCents(Math.round((proposal.setupTotal || 0) * 100))} · MRR{' '}
                  {formatBrlFromCents(Math.round((proposal.monthlyMrr || 0) * 100))}
                </Badge>
              </div>

              {forecastError && <Alert variant="danger">{forecastError}</Alert>}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <Select
                  label="Modalidade do Setup"
                  value={forecastMode}
                  onChange={(e) =>
                    setForecastMode(e.target.value as ProposalBillingMode)
                  }
                >
                  <option value="pontual">Pontual (à vista)</option>
                  <option value="parcelado">Parcelado (2x a 24x)</option>
                  <option value="recorrente">Recorrente (MRR)</option>
                </Select>

                {forecastMode === 'parcelado' && (
                  <Input
                    label="Nº de Parcelas"
                    type="number"
                    min={2}
                    max={24}
                    value={String(installmentsCount)}
                    onChange={(e) =>
                      setInstallmentsCount(Math.max(2, Number(e.target.value) || 2))
                    }
                  />
                )}

                <Input
                  label="1º Vencimento"
                  type="date"
                  value={firstDueDate}
                  onChange={(e) => setFirstDueDate(e.target.value)}
                  required
                />

                <Select
                  label="Forma de Pagamento"
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as FinancialPaymentMethod)
                  }
                >
                  {FINANCIAL_PAYMENT_METHOD_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--kz-text-secondary)]">
                  {proposal.setupTotal > 0 && (
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeSetup}
                        onChange={(e) => setIncludeSetup(e.target.checked)}
                        className="accent-[var(--kz-accent)]"
                      />
                      <span>
                        Incluir Setup (R$ {proposal.setupTotal.toLocaleString('pt-BR')})
                      </span>
                    </label>
                  )}
                  {proposal.monthlyMrr > 0 && (
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeMrr}
                        onChange={(e) => setIncludeMrr(e.target.checked)}
                        className="accent-[var(--kz-accent)]"
                      />
                      <span>
                        Criar Recorrência MRR (R${' '}
                        {proposal.monthlyMrr.toLocaleString('pt-BR')}/mês)
                      </span>
                    </label>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setShowForecastForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="xs"
                    loading={isBusy}
                  >
                    Confirmar Previsão
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* Executive Document Sheet Preview */}
          <div className="rounded-xl border border-[var(--kz-border-default)] bg-[var(--kz-bg-canvas)] overflow-hidden">
            {/* Document Header */}
            <div className="p-5 border-b border-[#C6A15B]/40 bg-[#101014] flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[10px] font-bold tracking-widest uppercase text-[#C6A15B]">
                  {proposal.kind === 'contrato'
                    ? 'Kaizen — Contrato de Prestação de Serviços'
                    : 'Kaizen — Proposta Comercial'}
                </div>
                <h3 className="text-base font-bold text-[var(--kz-text-primary)]">
                  {proposal.title}
                </h3>
                <div className="text-[11px] font-mono text-[var(--kz-text-muted)]">
                  Código: {proposal.code} · Emissão:{' '}
                  {new Date(proposal.createdAt).toLocaleDateString('pt-BR')}
                  {proposal.validUntil &&
                    ` · Validade: ${proposal.validUntil.split('-').reverse().join('/')}`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-[#C6A15B] font-mono">
                  {proposal.code}
                </div>
                {proposal.deliveryDeadlineDays && (
                  <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5">
                    Prazo: {proposal.deliveryDeadlineDays} dias
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 space-y-5 text-xs">
              {/* Parties */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-xl bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)]">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--kz-text-muted)]">
                    Contratante / Cliente
                  </div>
                  <div className="font-bold text-[var(--kz-text-primary)]">
                    {proposal.recipientCompany}
                  </div>
                  {proposal.recipientContact && (
                    <div className="text-[var(--kz-text-secondary)]">
                      Resp.: {proposal.recipientContact}
                    </div>
                  )}
                  <div className="text-[var(--kz-text-muted)] font-mono">
                    {[proposal.recipientDocument, proposal.recipientPhone, proposal.recipientCity]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--kz-text-muted)]">
                    Contratada / Emissor
                  </div>
                  <div className="font-bold text-[var(--kz-text-primary)]">
                    {proposal.issuerName}
                  </div>
                  {proposal.issuerDocument && (
                    <div className="text-[var(--kz-text-muted)] font-mono">
                      Doc.: {proposal.issuerDocument}
                    </div>
                  )}
                  {proposal.paymentTerms && (
                    <div className="text-[var(--kz-text-secondary)]">
                      Pagamento: {proposal.paymentTerms}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              {proposal.summary && (
                <div className="space-y-1.5">
                  <div className="font-bold text-[var(--kz-text-primary)]">
                    1. Visão Geral & Objetivo
                  </div>
                  <p className="text-[var(--kz-text-secondary)] leading-relaxed whitespace-pre-wrap">
                    {proposal.summary}
                  </p>
                </div>
              )}

              {/* Items table */}
              <div className="space-y-2">
                <div className="font-bold text-[var(--kz-text-primary)]">
                  2. Escopo e Itens Contratados
                </div>
                <div className="rounded-lg border border-[var(--kz-border-subtle)] overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[var(--kz-bg-subtle)] text-[11px] text-[var(--kz-text-muted)]">
                      <tr>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3">Tipo</th>
                        <th className="py-2 px-3 text-right">Qtd</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--kz-border-subtle)]">
                      {proposal.items.map((item) => {
                        const sub =
                          (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0);
                        return (
                          <tr key={item.id}>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-[var(--kz-text-primary)]">
                                {item.title}
                              </div>
                              {item.description && (
                                <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5">
                                  {item.description}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[var(--kz-text-secondary)] capitalize">
                              {item.billingType}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[var(--kz-text-primary)]">
                              R$ {sub.toLocaleString('pt-BR')}
                              {item.billingType === 'mensal' ? '/mês' : ''}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="p-4 rounded-xl bg-[var(--kz-accent-soft)]/35 border border-[var(--kz-accent-border)] flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--kz-accent-text)]">
                    Resumo do Investimento
                  </div>
                  <div className="flex flex-wrap items-center gap-6 font-mono tabular-nums">
                    <div>
                      <span className="text-[var(--kz-text-muted)] font-sans">Setup: </span>
                      <span className="text-sm font-bold text-[var(--kz-text-primary)]">
                        R$ {proposal.setupTotal.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--kz-text-muted)] font-sans">Recorrência: </span>
                      <span className="text-sm font-bold text-[var(--kz-success-text)]">
                        R$ {proposal.monthlyMrr.toLocaleString('pt-BR')}/mês
                      </span>
                    </div>
                  </div>
                </div>
                {proposal.discountValue && proposal.discountValue > 0 ? (
                  <div className="text-[11px] font-mono text-[var(--kz-accent-text)]">
                    Desconto aplicado: R$ {proposal.discountValue.toLocaleString('pt-BR')}
                  </div>
                ) : null}
              </div>

              {/* Clauses */}
              {proposal.clausesText && (
                <div className="space-y-1.5">
                  <div className="font-bold text-[var(--kz-text-primary)]">
                    3. Cláusulas e Condições Gerais
                  </div>
                  <div className="p-3.5 rounded-lg bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)] text-[11px] text-[var(--kz-text-secondary)] whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
                    {proposal.clausesText}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Document History Log */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--kz-text-primary)]">
              <Clock className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
              <span>Histórico do Documento ({proposal.history?.length || 0})</span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {(proposal.history || []).map((evt) => (
                <div
                  key={evt.id}
                  className="px-3 py-2 rounded-lg bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] flex flex-wrap items-center justify-between gap-2 text-[11px]"
                >
                  <div>
                    <span className="font-semibold text-[var(--kz-text-primary)]">
                      {evt.title}
                    </span>
                    {evt.note && (
                      <span className="text-[var(--kz-text-muted)] ml-1.5">
                        — {evt.note}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[var(--kz-text-muted)]">
                    {new Date(evt.date).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                    {evt.author ? ` · ${evt.author}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Documento"
        description={
          <span>
            Deseja excluir permanentemente <strong>{proposal.code}</strong> ({proposal.title})?
          </span>
        }
        confirmLabel="Confirmar Exclusão"
        variant="danger"
        loading={isBusy}
      />
    </>
  );
};
