import React, { useMemo, useState } from 'react';
import { Lead, NicheCampaign } from '../types/crm';
import {
  Client,
  DocumentKind,
  PROPOSAL_STATUS_OPTIONS,
  ProposalContract,
  ProposalLineItem,
  ProposalStatus,
} from '../types/kaizen';
import { ModelTemplate } from '../types/resources';
import { SystemSettings } from '../types/system';
import {
  DEFAULT_CONTRACT_CLAUSES,
  buildProposalFromSource,
  calculateProposalTotals,
  generateNextProposalCode,
  generateProposalId,
  generateProposalItemId,
} from '../services/proposalService';
import { buildIndependentProposalFromTemplate } from '../services/resources';
import { getIssuerBrandingFromSettings } from '../services/system/settingsService';
import { cleanPhoneForWhatsApp } from '../utils/phone';
import {
  Modal,
  Button,
  Input,
  Select,
  Textarea,
  Alert,
} from './ui';
import { FileSignature, Plus, Trash2, ScrollText, Users, Layers } from 'lucide-react';

interface ProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProposals: ProposalContract[];
  clients: Client[];
  leads: Lead[];
  niches: NicheCampaign[];
  modelTemplates?: ModelTemplate[];
  systemSettings?: SystemSettings | null;
  userName: string;
  initialProposal?: ProposalContract | null;
  initialClient?: Client | null;
  initialLead?: Lead | null;
  initialKind?: DocumentKind;
  onSaveProposal: (proposal: ProposalContract, mode: 'create' | 'edit') => Promise<void>;
}

export const ProposalModal: React.FC<ProposalModalProps> = ({
  isOpen,
  onClose,
  existingProposals,
  clients,
  leads,
  niches,
  modelTemplates = [],
  systemSettings = null,
  userName,
  initialProposal = null,
  initialClient = null,
  initialLead = null,
  initialKind = 'proposta',
  onSaveProposal,
}) => {
  const isEditing = Boolean(initialProposal);

  const issuerBranding = useMemo(
    () => getIssuerBrandingFromSettings(systemSettings, userName),
    [systemSettings, userName]
  );

  const initialDraft = useMemo(() => {
    if (initialProposal) return initialProposal;
    const nicheMatch = initialLead
      ? niches.find((n) => n.id === initialLead.nicheId) || null
      : null;
    const built = buildProposalFromSource({
      kind: initialKind,
      existingProposals,
      issuerName: issuerBranding.issuerName,
      client: initialClient,
      lead: initialLead,
      niche: nicheMatch,
    });
    return {
      ...built,
      issuerDocument: issuerBranding.issuerDocument || built.issuerDocument,
    };
  }, [
    initialProposal,
    initialKind,
    existingProposals,
    issuerBranding,
    initialClient,
    initialLead,
    niches,
  ]);

  const [kind, setKind] = useState<DocumentKind>(initialDraft.kind);
  const [code, setCode] = useState<string>(initialDraft.code);
  const [title, setTitle] = useState<string>(initialDraft.title);
  const [status, setStatus] = useState<ProposalStatus>(initialDraft.status);
  const [selectedClientId, setSelectedClientId] = useState<string>(
    initialDraft.clientId || ''
  );
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialDraft.leadId || '');

  const [recipientCompany, setRecipientCompany] = useState<string>(
    initialDraft.recipientCompany
  );
  const [recipientContact, setRecipientContact] = useState<string>(
    initialDraft.recipientContact || ''
  );
  const [recipientDocument, setRecipientDocument] = useState<string>(
    initialDraft.recipientDocument || ''
  );
  const [recipientPhone, setRecipientPhone] = useState<string>(
    initialDraft.recipientPhone || ''
  );
  const [recipientEmail, setRecipientEmail] = useState<string>(
    initialDraft.recipientEmail || ''
  );
  const [recipientCity, setRecipientCity] = useState<string>(
    initialDraft.recipientCity || ''
  );

  const [issuerName, setIssuerName] = useState<string>(initialDraft.issuerName);
  const [issuerDocument, setIssuerDocument] = useState<string>(
    initialDraft.issuerDocument || ''
  );
  const [summary, setSummary] = useState<string>(initialDraft.summary || '');
  const [items, setItems] = useState<ProposalLineItem[]>(initialDraft.items || []);
  const [discountValue, setDiscountValue] = useState<string>(
    initialDraft.discountValue ? String(initialDraft.discountValue) : '0'
  );
  const [deliveryDeadlineDays, setDeliveryDeadlineDays] = useState<string>(
    initialDraft.deliveryDeadlineDays ? String(initialDraft.deliveryDeadlineDays) : '7'
  );
  const [paymentTerms, setPaymentTerms] = useState<string>(
    initialDraft.paymentTerms || ''
  );
  const [validUntil, setValidUntil] = useState<string>(initialDraft.validUntil || '');
  const [clausesText, setClausesText] = useState<string>(
    initialDraft.clausesText || ''
  );
  const [notes, setNotes] = useState<string>(initialDraft.notes || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const proposalModelTemplates = useMemo(
    () =>
      modelTemplates.filter(
        (t) => t.status === 'ativo' && (t.kind === 'proposta' || t.kind === 'contrato')
      ),
    [modelTemplates]
  );

  const handleApplyModelTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = proposalModelTemplates.find((t) => t.id === templateId);
    if (!tmpl) return;

    const currentClient = clients.find((c) => c.id === selectedClientId) || null;
    const currentLead = leads.find((l) => l.id === selectedLeadId) || null;
    const nicheMatch = currentLead
      ? niches.find((n) => n.id === currentLead.nicheId) || null
      : null;

    const draft = buildIndependentProposalFromTemplate({
      template: tmpl,
      existingProposals,
      issuerName: issuerName.trim() || issuerBranding.issuerName,
      client: currentClient,
      lead: currentLead,
      niche: nicheMatch,
    });

    setKind(draft.kind);
    setCode(draft.code);
    setTitle(draft.title);
    setSummary(draft.summary || '');
    setItems(draft.items || []);
    setDeliveryDeadlineDays(
      draft.deliveryDeadlineDays ? String(draft.deliveryDeadlineDays) : '14'
    );
    setPaymentTerms(draft.paymentTerms || '');
    setClausesText(draft.clausesText || '');
    if (draft.notes) setNotes(draft.notes);
  };

  const computedTotals = useMemo(
    () => calculateProposalTotals(items, parseFloat(discountValue) || 0),
    [items, discountValue]
  );

  const handleKindChange = (nextKind: DocumentKind) => {
    setKind(nextKind);
    if (!isEditing) {
      setCode(generateNextProposalCode(existingProposals, nextKind));
      const nextPrefix =
        nextKind === 'contrato'
          ? 'Contrato de Prestação de Serviços'
          : 'Proposta Comercial';
      if (
        title.startsWith('Proposta Comercial') ||
        title.startsWith('Contrato de Prestação de Serviços')
      ) {
        setTitle(
          recipientCompany
            ? `${nextPrefix} — ${recipientCompany}`
            : `${nextPrefix} — Posicionamento Digital`
        );
      }
      if (nextKind === 'contrato' && !clausesText.trim()) {
        setClausesText(DEFAULT_CONTRACT_CLAUSES);
      }
    }
  };

  const handleApplyClientSource = (clientId: string) => {
    setSelectedClientId(clientId);
    const cli = clients.find((c) => c.id === clientId);
    if (!cli) return;
    setSelectedLeadId(cli.originLeadId || '');
    setRecipientCompany(cli.companyName);
    setRecipientContact(cli.contactName || '');
    setRecipientDocument(cli.document || '');
    setRecipientPhone(cli.displayPhone || cli.phone || '');
    setRecipientEmail(cli.email || '');
    setRecipientCity(cli.city || '');
    const docLabel =
      kind === 'contrato' ? 'Contrato de Prestação de Serviços' : 'Proposta Comercial';
    setTitle(`${docLabel} — ${cli.companyName}`);
  };

  const handleApplyLeadSource = (leadId: string) => {
    setSelectedLeadId(leadId);
    const ld = leads.find((l) => l.id === leadId);
    if (!ld) return;

    const matchingClient = clients.find((c) => c.originLeadId === ld.id);
    if (matchingClient) {
      setSelectedClientId(matchingClient.id);
    }

    setRecipientCompany(ld.companyName);
    setRecipientContact(ld.contactName || '');
    setRecipientPhone(ld.displayPhone || ld.phone || '');
    setRecipientCity(ld.city || '');
    const docLabel =
      kind === 'contrato' ? 'Contrato de Prestação de Serviços' : 'Proposta Comercial';
    setTitle(`${docLabel} — ${ld.companyName}`);

    if (!isEditing && (ld.creationValue || ld.monthlyMrr)) {
      const nextItems: ProposalLineItem[] = [
        {
          id: generateProposalItemId(),
          title: 'Desenvolvimento e Implantação de Site Profissional',
          description:
            'Estrutura responsiva focada em conversão, integração com WhatsApp e otimização para Google.',
          billingType: 'setup',
          quantity: 1,
          unitPrice: ld.creationValue || 997,
        },
      ];
      if (ld.monthlyMrr && ld.monthlyMrr > 0) {
        nextItems.push({
          id: generateProposalItemId(),
          title: 'Gestão Técnica, Hospedagem e Suporte Contínuo',
          description: 'Monitoramento, backups automáticos, SSL e atualizações mensais.',
          billingType: 'mensal',
          quantity: 1,
          unitPrice: ld.monthlyMrr,
        });
      }
      setItems(nextItems);
    }
  };

  const handleAddLineItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: generateProposalItemId(),
        title: '',
        description: '',
        billingType: 'setup',
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  const handleUpdateItem = (
    itemId: string,
    patch: Partial<ProposalLineItem>
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Informe o título da proposta ou contrato.');
      return;
    }
    if (!recipientCompany.trim()) {
      setError('Informe o nome da empresa / contratante.');
      return;
    }

    const sanitizedItems = items
      .filter((it) => it.title.trim().length > 0)
      .map((it) => ({
        ...it,
        title: it.title.trim(),
        description: it.description?.trim() || undefined,
        quantity: Math.max(1, Number(it.quantity) || 1),
        unitPrice: Math.max(0, Number(it.unitPrice) || 0),
      }));

    if (sanitizedItems.length === 0) {
      setError('Adicione pelo menos um item de escopo com título preenchido.');
      return;
    }

    const numericDiscount = Math.max(0, parseFloat(discountValue) || 0);
    const totals = calculateProposalTotals(sanitizedItems, numericDiscount);
    const nowIso = new Date().toISOString();

    const payload: ProposalContract = {
      id: initialProposal?.id || generateProposalId(),
      code: code.trim() || generateNextProposalCode(existingProposals, kind),
      kind,
      title: title.trim(),
      status,
      clientId: selectedClientId || undefined,
      leadId: selectedLeadId || undefined,
      recipientCompany: recipientCompany.trim(),
      recipientContact: recipientContact.trim() || undefined,
      recipientDocument: recipientDocument.trim() || undefined,
      recipientPhone: cleanPhoneForWhatsApp(recipientPhone) || undefined,
      recipientEmail: recipientEmail.trim() || undefined,
      recipientCity: recipientCity.trim() || undefined,
      issuerName: issuerName.trim() || 'Agência Kaizen',
      issuerDocument: issuerDocument.trim() || undefined,
      summary: summary.trim() || undefined,
      items: sanitizedItems,
      discountValue: numericDiscount,
      setupTotal: totals.setupTotal,
      monthlyMrr: totals.monthlyMrr,
      deliveryDeadlineDays: deliveryDeadlineDays
        ? Math.max(1, parseInt(deliveryDeadlineDays, 10) || 7)
        : undefined,
      paymentTerms: paymentTerms.trim() || undefined,
      clausesText: clausesText.trim() || undefined,
      validUntil: validUntil || undefined,
      sentAt:
        initialProposal?.sentAt ||
        (status === 'enviada' ? nowIso : undefined),
      approvedAt:
        initialProposal?.approvedAt ||
        (status === 'aprovada' ? nowIso : undefined),
      signedAt:
        initialProposal?.signedAt ||
        (status === 'assinada' ? nowIso : undefined),
      notes: notes.trim() || undefined,
      history: initialProposal
        ? [
            {
              id: `hist-${Date.now()}`,
              date: nowIso,
              status,
              title: 'Documento editado',
              author: userName,
            },
            ...(initialProposal.history || []),
          ].slice(0, 200)
        : (initialDraft as ProposalContract).history,
      createdAt: initialProposal?.createdAt || nowIso,
      schemaVersion: 1,
      updatedAt: nowIso,
    };

    setIsSaving(true);
    try {
      await onSaveProposal(payload, isEditing ? 'edit' : 'create');
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao salvar documento.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      closeDisabled={isSaving}
      title={
        isEditing
          ? `Editar ${initialProposal?.code}`
          : 'Nova Proposta Comercial ou Contrato'
      }
      subtitle="Configure escopo, valores de implantação/recorrência e cláusulas para visualização e exportação em PDF."
      icon={<FileSignature className="w-5 h-5" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={isSaving}
            type="submit"
            form="proposal-editor-form"
          >
            {isEditing ? 'Salvar Alterações' : 'Criar Documento'}
          </Button>
        </>
      }
    >
      <form
        id="proposal-editor-form"
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Vinculo opcional com Cliente ou Lead e Modelo Independente */}
        <div
          className={`p-3.5 rounded-xl bg-[var(--kz-bg-subtle)]/70 border border-[var(--kz-border-subtle)] grid grid-cols-1 ${
            !isEditing && proposalModelTemplates.length > 0
              ? 'md:grid-cols-3'
              : 'md:grid-cols-2'
          } gap-3`}
        >
          {!isEditing && proposalModelTemplates.length > 0 && (
            <Select
              label="Modelo da Biblioteca (opcional)"
              value={selectedTemplateId}
              onChange={(e) => handleApplyModelTemplate(e.target.value)}
            >
              <option value="">Preencher manualmente</option>
              {proposalModelTemplates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.title}
                </option>
              ))}
            </Select>
          )}

          <Select
            label="Vincular Cliente Existente (opcional)"
            value={selectedClientId}
            onChange={(e) => handleApplyClientSource(e.target.value)}
          >
            <option value="">Sem vínculo direto de cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName} ({c.status})
              </option>
            ))}
          </Select>

          <Select
            label="Importar de Lead do CRM (opcional)"
            value={selectedLeadId}
            onChange={(e) => handleApplyLeadSource(e.target.value)}
          >
            <option value="">Sem vínculo de lead</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.companyName} — {l.displayPhone || l.phone}
              </option>
            ))}
          </Select>
        </div>

        {/* Identificação & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Select
            label="Tipo de Documento"
            value={kind}
            onChange={(e) => handleKindChange(e.target.value as DocumentKind)}
          >
            <option value="proposta">Proposta Comercial</option>
            <option value="contrato">Contrato</option>
          </Select>

          <Input
            label="Código"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono"
            required
          />

          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProposalStatus)}
          >
            {PROPOSAL_STATUS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Input
            label="Validade"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="font-mono"
          />
        </div>

        <Input
          label="Título do Documento *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Proposta Comercial — Clínica NutriVida"
          required
        />

        {/* Partes: Contratante e Emissor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-[var(--kz-bg-canvas)]/70 border border-[var(--kz-border-subtle)]">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--kz-text-primary)]">
              <Users className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
              <span>Dados da Contratante (Cliente)</span>
            </div>
            <Input
              label="Empresa / Contratante *"
              value={recipientCompany}
              onChange={(e) => setRecipientCompany(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-2.5">
              <Input
                label="Responsável"
                value={recipientContact}
                onChange={(e) => setRecipientContact(e.target.value)}
              />
              <Input
                label="CPF / CNPJ"
                value={recipientDocument}
                onChange={(e) => setRecipientDocument(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Input
                label="WhatsApp"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                className="font-mono"
              />
              <Input
                label="Cidade / UF"
                value={recipientCity}
                onChange={(e) => setRecipientCity(e.target.value)}
              />
            </div>
            <Input
              label="E-mail do Cliente"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--kz-text-primary)]">
              <Layers className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
              <span>Emissor & Condições Gerais</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Input
                label="Emissor / Contratada *"
                value={issuerName}
                onChange={(e) => setIssuerName(e.target.value)}
                required
              />
              <Input
                label="CNPJ / CPF Emissor"
                value={issuerDocument}
                onChange={(e) => setIssuerDocument(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Input
                label="Prazo de Entrega (dias)"
                type="number"
                min={1}
                value={deliveryDeadlineDays}
                onChange={(e) => setDeliveryDeadlineDays(e.target.value)}
                className="font-mono"
              />
              <Input
                label="Desconto no Setup (R$)"
                type="number"
                min={0}
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="font-mono"
              />
            </div>
            <Input
              label="Condições de Pagamento"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="Ex: 50% na aprovação e 50% na entrega final"
            />
            <Textarea
              label="Resumo Executivo"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
        </div>

        {/* Itens do Escopo */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-[var(--kz-text-primary)]">
                Itens de Escopo e Investimento
              </h4>
              <p className="text-[11px] text-[var(--kz-text-muted)]">
                Os totais de Implantação (Setup + Pontuais) e Recorrência (Mensal) são calculados automaticamente.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleAddLineItem}
            >
              Adicionar Item
            </Button>
          </div>

          <div className="space-y-2.5">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/60 border border-[var(--kz-border-subtle)] space-y-2.5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-5">
                    <Input
                      label={`Item ${idx + 1} *`}
                      value={item.title}
                      onChange={(e) =>
                        handleUpdateItem(item.id, { title: e.target.value })
                      }
                      placeholder="Ex: Desenvolvimento de Landing Page"
                      required
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Select
                      label="Cobrança"
                      value={item.billingType}
                      onChange={(e) =>
                        handleUpdateItem(item.id, {
                          billingType: e.target.value as ProposalLineItem['billingType'],
                        })
                      }
                    >
                      <option value="setup">Setup (Implantação)</option>
                      <option value="mensal">Mensal (Recorrência)</option>
                      <option value="pontual">Pontual (Adicional)</option>
                    </Select>
                  </div>
                  <div className="sm:col-span-1">
                    <Input
                      label="Qtd"
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        handleUpdateItem(item.id, {
                          quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                        })
                      }
                      className="font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      label="Valor Unit. (R$)"
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        handleUpdateItem(item.id, {
                          unitPrice: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="font-mono"
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={items.length <= 1}
                      onClick={() => handleRemoveItem(item.id)}
                      title="Remover item"
                      className="text-[var(--kz-danger-text)]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <Input
                  value={item.description || ''}
                  onChange={(e) =>
                    handleUpdateItem(item.id, { description: e.target.value })
                  }
                  placeholder="Detalhamento técnico ou entregáveis incluídos neste item (opcional)..."
                />
              </div>
            ))}
          </div>

          {/* Totals bar */}
          <div className="p-3.5 rounded-xl bg-[var(--kz-accent-soft)]/45 border border-[var(--kz-accent-border)] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-5 font-mono tabular-nums">
              <div>
                <span className="text-[var(--kz-text-muted)] font-sans">Setup bruto: </span>
                <span className="text-[var(--kz-text-secondary)]">
                  R$ {computedTotals.grossSetup.toLocaleString('pt-BR')}
                </span>
              </div>
              <div>
                <span className="text-[var(--kz-text-muted)] font-sans">Setup líquido: </span>
                <span className="font-bold text-[var(--kz-text-primary)]">
                  R$ {computedTotals.setupTotal.toLocaleString('pt-BR')}
                </span>
              </div>
              <div>
                <span className="text-[var(--kz-text-muted)] font-sans">MRR mensal: </span>
                <span className="font-bold text-[var(--kz-success-text)]">
                  R$ {computedTotals.monthlyMrr.toLocaleString('pt-BR')}/mês
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cláusulas Contratuais */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="kz-label flex items-center gap-1.5">
              <ScrollText className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
              <span>Cláusulas e Condições (exibidas no PDF e Contrato)</span>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setClausesText(DEFAULT_CONTRACT_CLAUSES)}
            >
              Inserir Cláusulas Padrão Kaizen
            </Button>
          </div>
          <Textarea
            rows={5}
            value={clausesText}
            onChange={(e) => setClausesText(e.target.value)}
            placeholder="Cláusulas de objeto, prazo, propriedade intelectual, pagamento e rescisão..."
          />
        </div>

        <Textarea
          label="Observações Internas (não aparecem no PDF)"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Negociações internas, descontos condicionais, lembretes de follow-up..."
        />
      </form>
    </Modal>
  );
};
