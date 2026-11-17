import React, { useEffect, useState } from 'react';
import { Repeat } from 'lucide-react';
import { Modal, Button, Input, Select, Textarea, Alert } from '../ui';
import {
  FINANCIAL_PAYMENT_METHOD_OPTIONS,
  FINANCIAL_RECURRENCE_FREQUENCY_OPTIONS,
  FinancialCategory,
  FinancialKind,
  FinancialPaymentMethod,
  FinancialRecurrence,
  FinancialRecurrenceFrequency,
} from '../../types/finance';
import { Client, Project } from '../../types/kaizen';
import {
  KAIZEN_TIMEZONE,
  centsToInputValue,
  getTodayInTimezone,
  parseBrlToCents,
} from '../../services/finance';

interface FinanceRecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingRecurrence: FinancialRecurrence | null;
  categories: FinancialCategory[];
  clients: Client[];
  projects: Project[];
  onSave: (payload: {
    editingId?: string;
    name: string;
    kind: FinancialKind;
    amountCents: number;
    categoryId: string;
    clientId?: string;
    supplierName?: string;
    serviceName?: string;
    projectId?: string;
    paymentMethod: FinancialPaymentMethod;
    frequency: FinancialRecurrenceFrequency;
    customIntervalDays?: number;
    startDate: string;
    endDate?: string;
    notes?: string;
  }) => Promise<void>;
}

export const FinanceRecurrenceModal: React.FC<FinanceRecurrenceModalProps> = ({
  isOpen,
  onClose,
  editingRecurrence,
  categories,
  clients,
  projects,
  onSave,
}) => {
  const today = getTodayInTimezone(KAIZEN_TIMEZONE);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FinancialKind>('receita');
  const [amountInput, setAmountInput] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [clientId, setClientId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<FinancialPaymentMethod>('pix');
  const [frequency, setFrequency] = useState<FinancialRecurrenceFrequency>('mensal');
  const [customIntervalDays, setCustomIntervalDays] = useState('30');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const availableCategories = categories.filter((c) => c.kind === kind && c.active);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editingRecurrence) {
      setName(editingRecurrence.name);
      setKind(editingRecurrence.kind);
      setAmountInput(centsToInputValue(editingRecurrence.amountCents));
      setCategoryId(editingRecurrence.categoryId);
      setClientId(editingRecurrence.clientId || '');
      setSupplierName(editingRecurrence.supplierName || '');
      setServiceName(editingRecurrence.serviceName || '');
      setProjectId(editingRecurrence.projectId || '');
      setPaymentMethod(editingRecurrence.paymentMethod);
      setFrequency(editingRecurrence.frequency);
      setCustomIntervalDays(String(editingRecurrence.customIntervalDays || 30));
      setStartDate(editingRecurrence.startDate);
      setEndDate(editingRecurrence.endDate || '');
      setNotes(editingRecurrence.notes || '');
    } else {
      setName('');
      setKind('receita');
      setAmountInput('');
      setCategoryId(
        categories.find((c) => c.kind === 'receita' && c.active)?.id || ''
      );
      setClientId('');
      setSupplierName('');
      setServiceName('');
      setProjectId('');
      setPaymentMethod('pix');
      setFrequency('mensal');
      setCustomIntervalDays('30');
      setStartDate(today);
      setEndDate('');
      setNotes('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingRecurrence?.id]);

  const handleKindChange = (nextKind: FinancialKind) => {
    setKind(nextKind);
    const firstCat = categories.find((c) => c.kind === nextKind && c.active);
    setCategoryId(firstCat?.id || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amountCents = parseBrlToCents(amountInput);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError('Informe um valor recorrente válido maior que R$ 0,00.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...(editingRecurrence ? { editingId: editingRecurrence.id } : {}),
        name: name.trim(),
        kind,
        amountCents,
        categoryId,
        ...(clientId ? { clientId } : {}),
        ...(kind === 'despesa' && supplierName.trim()
          ? { supplierName: supplierName.trim() }
          : {}),
        ...(serviceName.trim() ? { serviceName: serviceName.trim() } : {}),
        ...(projectId ? { projectId } : {}),
        paymentMethod,
        frequency,
        ...(frequency === 'personalizada'
          ? { customIntervalDays: Math.max(1, Number(customIntervalDays) || 30) }
          : {}),
        startDate,
        ...(endDate ? { endDate } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar recorrência.');
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
      title={editingRecurrence ? 'Editar Recorrência (Futuras Ocorrências)' : 'Nova Recorrência Financeira'}
      subtitle="Alterações de valor preservam integralmente os lançamentos históricos já gerados."
      icon={
        <div className="w-9 h-9 rounded-full bg-[var(--kz-accent-soft)] flex items-center justify-center text-[var(--kz-accent-text)]">
          <Repeat className="w-4 h-4" />
        </div>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="kz-recurrence-form"
            variant="primary"
            loading={saving}
          >
            {editingRecurrence ? 'Salvar para Futuras' : 'Criar Recorrência'}
          </Button>
        </>
      }
    >
      <form id="kz-recurrence-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="danger" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              label="Nome da Recorrência"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Mensalidade Cliente Alpha / Assinatura Vercel"
            />
          </div>
          <Select
            label="Tipo"
            value={kind}
            disabled={Boolean(editingRecurrence)}
            onChange={(e) => handleKindChange(e.target.value as FinancialKind)}
          >
            <option value="receita">Receita (MRR)</option>
            <option value="despesa">Despesa Recorrente</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Valor Base (R$)"
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
            <option value="">Selecione...</option>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Frequência"
            value={frequency}
            onChange={(e) =>
              setFrequency(e.target.value as FinancialRecurrenceFrequency)
            }
          >
            {FINANCIAL_RECURRENCE_FREQUENCY_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
          <Input
            label="Data de Início"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Data Final (opcional)"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {frequency === 'personalizada' && (
          <Input
            label="Intervalo personalizado (em dias)"
            type="number"
            min={1}
            value={customIntervalDays}
            onChange={(e) => setCustomIntervalDays(e.target.value)}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {kind === 'receita' ? (
            <Select
              label="Cliente Vinculado (opcional)"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Sem vínculo com cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              label="Fornecedor"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Ex: Google Workspace, Hostinger..."
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
          <Input
            label="Serviço (opcional)"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="Ex: Gestão Mensal Kaizen Performance"
          />
        )}

        <Textarea
          label="Observações"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Modal>
  );
};
