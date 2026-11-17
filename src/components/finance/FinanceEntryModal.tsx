import React, { useEffect, useState } from 'react';
import { DollarSign } from 'lucide-react';
import { Modal, Button, Input, Select, Textarea, Alert } from '../ui';
import {
  FINANCIAL_PAYMENT_METHOD_OPTIONS,
  FinancialCategory,
  FinancialEntry,
  FinancialKind,
  FinancialPaymentMethod,
} from '../../types/finance';
import { Client, Project, ProposalContract } from '../../types/kaizen';
import {
  KAIZEN_TIMEZONE,
  centsToInputValue,
  getTodayInTimezone,
  parseBrlToCents,
} from '../../services/finance';

interface FinanceEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultKind: FinancialKind;
  editingEntry: FinancialEntry | null;
  prefill?: Partial<{
    clientId: string;
    projectId: string;
    proposalId: string;
    description: string;
    serviceName: string;
    amountCents: number;
  }>;
  categories: FinancialCategory[];
  clients: Client[];
  projects: Project[];
  proposals: ProposalContract[];
  onSave: (payload: {
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
    amountCents: number;
    competenceDate: string;
    dueDate: string;
    paymentMethod: FinancialPaymentMethod;
    initialStatus: 'prevista' | 'pendente';
    attachmentUrl?: string;
    notes?: string;
  }) => Promise<void>;
}

export const FinanceEntryModal: React.FC<FinanceEntryModalProps> = ({
  isOpen,
  onClose,
  defaultKind,
  editingEntry,
  prefill,
  categories,
  clients,
  projects,
  proposals,
  onSave,
}) => {
  const kind: FinancialKind = editingEntry?.kind || defaultKind;
  const availableCategories = categories.filter(
    (c) => c.kind === kind && (c.active || c.id === editingEntry?.categoryId)
  );
  const today = getTodayInTimezone(KAIZEN_TIMEZONE);

  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [clientId, setClientId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [proposalId, setProposalId] = useState('');
  const [competenceDate, setCompetenceDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState<FinancialPaymentMethod>('pix');
  const [initialStatus, setInitialStatus] = useState<'prevista' | 'pendente'>('pendente');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editingEntry) {
      setDescription(editingEntry.description);
      setAmountInput(centsToInputValue(editingEntry.amountCents));
      setCategoryId(editingEntry.categoryId);
      setClientId(editingEntry.clientId || '');
      setSupplierName(editingEntry.supplierName || '');
      setServiceName(editingEntry.serviceName || '');
      setProjectId(editingEntry.projectId || '');
      setProposalId(editingEntry.proposalId || '');
      setCompetenceDate(editingEntry.competenceDate);
      setDueDate(editingEntry.dueDate);
      setPaymentMethod(editingEntry.paymentMethod);
      setInitialStatus(editingEntry.status === 'prevista' ? 'prevista' : 'pendente');
      setAttachmentUrl(editingEntry.attachmentUrl || '');
      setNotes(editingEntry.notes || '');
    } else {
      setDescription(prefill?.description || '');
      setAmountInput(
        prefill?.amountCents ? centsToInputValue(prefill.amountCents) : ''
      );
      setCategoryId(availableCategories[0]?.id || '');
      setClientId(prefill?.clientId || '');
      setSupplierName('');
      setServiceName(prefill?.serviceName || '');
      setProjectId(prefill?.projectId || '');
      setProposalId(prefill?.proposalId || '');
      setCompetenceDate(today);
      setDueDate(today);
      setPaymentMethod('pix');
      setInitialStatus('pendente');
      setAttachmentUrl('');
      setNotes('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingEntry?.id, defaultKind]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountCents = parseBrlToCents(amountInput);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError('Informe um valor válido maior que R$ 0,00.');
      return;
    }
    if (!categoryId) {
      setError('Selecione uma categoria financeira.');
      return;
    }

    const matchedProposal = proposalId
      ? proposals.find((p) => p.id === proposalId)
      : undefined;

    setSaving(true);
    try {
      await onSave({
        ...(editingEntry ? { id: editingEntry.id } : {}),
        kind,
        description: description.trim(),
        ...(clientId ? { clientId } : {}),
        ...(kind === 'despesa' && supplierName.trim()
          ? { supplierName: supplierName.trim() }
          : {}),
        ...(serviceName.trim() ? { serviceName: serviceName.trim() } : {}),
        ...(projectId ? { projectId } : {}),
        ...(proposalId ? { proposalId } : {}),
        ...(matchedProposal?.code ? { contractCode: matchedProposal.code } : {}),
        categoryId,
        amountCents,
        competenceDate,
        dueDate,
        paymentMethod,
        initialStatus,
        ...(attachmentUrl.trim() ? { attachmentUrl: attachmentUrl.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar lançamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      closeDisabled={saving}
      title={
        editingEntry
          ? `Editar ${kind === 'receita' ? 'Receita' : 'Despesa'}`
          : kind === 'receita'
          ? 'Nova Receita'
          : 'Nova Despesa'
      }
      subtitle="Lançamento único rastreável com valores em reais (BRL) e histórico auditável."
      icon={
        <div className="w-9 h-9 rounded-full bg-[var(--kz-accent-soft)] flex items-center justify-center text-[var(--kz-accent-text)]">
          <DollarSign className="w-4 h-4" />
        </div>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="kz-finance-entry-form" variant="primary" loading={saving}>
            {editingEntry ? 'Salvar Alterações' : 'Criar Lançamento'}
          </Button>
        </>
      }
    >
      <form id="kz-finance-entry-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="danger" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Input
          label="Descrição"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            kind === 'receita'
              ? 'Ex: Mensalidade Gestão Kaizen — Novembro'
              : 'Ex: Assinatura Servidor Cloud / APIs'
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Valor Total (R$)"
            required
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="Ex: 1.500,00"
            className="font-mono"
          />

          <Select
            label="Categoria"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Selecione uma categoria</option>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Data de Competência"
            type="date"
            required
            value={competenceDate}
            onChange={(e) => setCompetenceDate(e.target.value)}
          />
          <Input
            label="Data de Vencimento"
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Forma de Pagamento"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as FinancialPaymentMethod)}
          >
            {FINANCIAL_PAYMENT_METHOD_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>

          <Select
            label="Situação Inicial"
            value={initialStatus}
            disabled={Boolean(editingEntry && editingEntry.settledCents > 0)}
            onChange={(e) =>
              setInitialStatus(e.target.value as 'prevista' | 'pendente')
            }
          >
            <option value="pendente">Pendente (em aberto)</option>
            <option value="prevista">Prevista (planejada)</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {kind === 'receita' ? (
            <Select
              label="Cliente (opcional para receita avulsa)"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Receita avulsa / sem cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              label="Fornecedor / Favorecido"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Ex: Vercel, Google Cloud, Designer..."
            />
          )}

          <Select
            label="Projeto Vinculado (opcional)"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Sem vínculo com projeto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        {kind === 'receita' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Serviço Contratado (opcional)"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="Ex: Landing Page, Tráfego Pago, SEO"
            />
            <Select
              label="Proposta / Contrato (opcional)"
              value={proposalId}
              onChange={(e) => setProposalId(e.target.value)}
            >
              <option value="">Sem proposta vinculada</option>
              {proposals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.recipientCompany}
                </option>
              ))}
            </Select>
          </div>
        )}

        {kind === 'despesa' && (
          <Input
            label="Link de Comprovante / Nota Fiscal (opcional)"
            value={attachmentUrl}
            onChange={(e) => setAttachmentUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
          />
        )}

        <Textarea
          label="Observações"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Detalhes adicionais sobre este lançamento..."
        />
      </form>
    </Modal>
  );
};
