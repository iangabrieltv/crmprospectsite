import React, { useMemo, useState } from 'react';
import { Lead, NicheCampaign } from '../types/crm';
import {
  Client,
  ClientStatus,
  CLIENT_STATUS_OPTIONS,
} from '../types/kaizen';
import {
  buildClientFromLead,
  findDuplicateClient,
  generateClientId,
  generateTimelineEventId,
} from '../services/clientService';
import { cleanPhoneForWhatsApp, formatDisplayPhone } from '../utils/phone';
import {
  Modal,
  Input,
  Select,
  Textarea,
  Button,
  Alert,
} from './ui';
import { Building2, Link2, AlertTriangle } from 'lucide-react';

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingClients: Client[];
  leads: Lead[];
  niches: NicheCampaign[];
  userName: string;
  initialClient?: Client | null;
  initialLead?: Lead | null;
  onSaveClient: (client: Client, mode: 'create' | 'edit') => Promise<void> | void;
  onOpenExistingClient?: (client: Client) => void;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({
  isOpen,
  onClose,
  existingClients,
  leads,
  niches,
  userName,
  initialClient,
  initialLead,
  onSaveClient,
  onOpenExistingClient,
}) => {
  const isEditing = Boolean(initialClient);

  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    initialClient?.originLeadId || initialLead?.id || ''
  );
  const [companyName, setCompanyName] = useState(
    initialClient?.companyName || initialLead?.companyName || ''
  );
  const [contactName, setContactName] = useState(
    initialClient?.contactName || initialLead?.contactName || ''
  );
  const [document, setDocument] = useState(initialClient?.document || '');
  const [email, setEmail] = useState(initialClient?.email || '');
  const [phone, setPhone] = useState(
    initialClient?.phone || initialLead?.phone || ''
  );
  const [city, setCity] = useState(
    initialClient?.city || initialLead?.city || ''
  );
  const [address, setAddress] = useState(
    initialClient?.address || initialLead?.address || ''
  );
  const [segment, setSegment] = useState(
    initialClient?.segment || initialLead?.category || ''
  );
  const [websiteUrl, setWebsiteUrl] = useState(
    initialClient?.websiteUrl || initialLead?.websiteUrl || initialLead?.mockupUrl || ''
  );
  const [domainName, setDomainName] = useState(initialClient?.domainName || '');
  const [hostingProvider, setHostingProvider] = useState(
    initialClient?.hostingProvider || ''
  );
  const [status, setStatus] = useState<ClientStatus>(
    initialClient?.status || 'ativo'
  );
  const [setupValue, setSetupValue] = useState<string>(
    initialClient?.setupValue !== undefined
      ? String(initialClient.setupValue)
      : initialLead?.creationValue !== undefined
      ? String(initialLead.creationValue)
      : ''
  );
  const [monthlyMrr, setMonthlyMrr] = useState<string>(
    initialClient?.monthlyMrr !== undefined
      ? String(initialClient.monthlyMrr)
      : initialLead?.monthlyMrr !== undefined
      ? String(initialLead.monthlyMrr)
      : ''
  );
  const [billingDay, setBillingDay] = useState<string>(
    initialClient?.billingDay !== undefined ? String(initialClient.billingDay) : '10'
  );
  const [contractStartDate, setContractStartDate] = useState(
    initialClient?.contractStartDate || new Date().toISOString().slice(0, 10)
  );
  const [contractRenewalDate, setContractRenewalDate] = useState(
    initialClient?.contractRenewalDate || ''
  );
  const [serviceScope, setServiceScope] = useState(
    initialClient?.serviceScope || ''
  );
  const [socialManagementEnabled, setSocialManagementEnabled] = useState<boolean>(
    Boolean(initialClient?.socialManagementEnabled)
  );
  const [notes, setNotes] = useState(initialClient?.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableLeadsToLink = useMemo(() => {
    const linkedIds = new Set(
      existingClients
        .filter((c) => c.id !== initialClient?.id)
        .map((c) => c.originLeadId)
        .filter(Boolean)
    );
    return leads
      .filter((l) => !linkedIds.has(l.id) || l.id === selectedLeadId)
      .sort((a, b) => {
        if (a.stage === 'fechado' && b.stage !== 'fechado') return -1;
        if (a.stage !== 'fechado' && b.stage === 'fechado') return 1;
        return a.companyName.localeCompare(b.companyName, 'pt-BR');
      });
  }, [leads, existingClients, initialClient?.id, selectedLeadId]);

  const duplicateMatch = useMemo(() => {
    if (!companyName.trim() && !phone.trim() && !selectedLeadId) return null;
    return findDuplicateClient(existingClients, {
      originLeadId: selectedLeadId || undefined,
      phone,
      companyName,
      excludeClientId: initialClient?.id,
    });
  }, [existingClients, selectedLeadId, phone, companyName, initialClient?.id]);

  const handleSelectLeadSource = (leadId: string) => {
    setSelectedLeadId(leadId);
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    const niche = niches.find((n) => n.id === lead.nicheId);
    setCompanyName(lead.companyName || '');
    setContactName(lead.contactName || '');
    setPhone(lead.phone || '');
    setCity(lead.city || niche?.city || '');
    setAddress(lead.address || '');
    setSegment(lead.category || niche?.segment || '');
    setWebsiteUrl(lead.websiteUrl || lead.mockupUrl || '');
    if (lead.creationValue !== undefined) setSetupValue(String(lead.creationValue));
    if (lead.monthlyMrr !== undefined) setMonthlyMrr(String(lead.monthlyMrr));
    if (!serviceScope && niche?.segment) {
      setServiceScope(`Projeto & Gestão — ${niche.segment}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!companyName.trim()) {
      setErrorMsg('Informe o nome da empresa ou cliente.');
      return;
    }

    if (
      !isEditing &&
      duplicateMatch &&
      (duplicateMatch.reason === 'originLeadId' || duplicateMatch.reason === 'phone')
    ) {
      setErrorMsg(
        duplicateMatch.reason === 'originLeadId'
          ? `Este lead do CRM já possui ficha de cliente (${duplicateMatch.existingClient.companyName}). Abra a ficha existente para evitar duplicidade.`
          : `Já existe um cliente cadastrado com este WhatsApp/telefone (${duplicateMatch.existingClient.companyName}).`
      );
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const cleanPhone = cleanPhoneForWhatsApp(phone);
      const displayPhone = cleanPhone ? formatDisplayPhone(cleanPhone) : phone.trim();
      const parsedSetup = setupValue !== '' ? Number(setupValue) : undefined;
      const parsedMrr = monthlyMrr !== '' ? Number(monthlyMrr) : undefined;
      const parsedBillingDay =
        billingDay !== '' ? Math.min(31, Math.max(1, Number(billingDay) || 10)) : undefined;

      if (isEditing && initialClient) {
        const statusChanged = initialClient.status !== status;
        const timeline = [...(initialClient.timeline || [])];
        if (statusChanged) {
          const nextLabel =
            CLIENT_STATUS_OPTIONS.find((s) => s.id === status)?.label || status;
          timeline.unshift({
            id: generateTimelineEventId('st'),
            date: nowIso,
            type: 'status_alterado',
            title: `Status alterado para ${nextLabel}`,
            author: userName,
          });
        }

        const updatedClient: Client = {
          ...initialClient,
          originLeadId: selectedLeadId || initialClient.originLeadId,
          companyName: companyName.trim(),
          contactName: contactName.trim() || undefined,
          document: document.trim() || undefined,
          email: email.trim() || undefined,
          phone: cleanPhone,
          displayPhone,
          city: city.trim() || undefined,
          address: address.trim() || undefined,
          segment: segment.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          domainName: domainName.trim() || undefined,
          hostingProvider: hostingProvider.trim() || undefined,
          status,
          setupValue: parsedSetup,
          monthlyMrr: parsedMrr,
          billingDay: parsedBillingDay,
          contractStartDate: contractStartDate || undefined,
          contractRenewalDate: contractRenewalDate || undefined,
          serviceScope: serviceScope.trim() || undefined,
          socialManagementEnabled: socialManagementEnabled
            ? true
            : initialClient.socialManagementEnabled !== undefined
            ? false
            : undefined,
          notes: notes.trim() || undefined,
          timeline: timeline.slice(0, 200),
          schemaVersion: initialClient.schemaVersion ?? 1,
          updatedAt: nowIso,
        };
        await onSaveClient(updatedClient, 'edit');
      } else {
        const linkedLead = selectedLeadId
          ? leads.find((l) => l.id === selectedLeadId)
          : undefined;
        const linkedNiche = linkedLead
          ? niches.find((n) => n.id === linkedLead.nicheId)
          : undefined;

        let newClient: Client;
        if (linkedLead) {
          newClient = {
            ...buildClientFromLead(linkedLead, linkedNiche, userName, {
              status,
              serviceScope: serviceScope.trim() || undefined,
              setupValue: parsedSetup,
              monthlyMrr: parsedMrr,
              contractStartDate: contractStartDate || undefined,
              notes: notes.trim() || undefined,
            }),
            companyName: companyName.trim(),
            contactName: contactName.trim() || undefined,
            document: document.trim() || undefined,
            email: email.trim() || undefined,
            phone: cleanPhone,
            displayPhone,
            city: city.trim() || undefined,
            address: address.trim() || undefined,
            segment: segment.trim() || undefined,
            websiteUrl: websiteUrl.trim() || undefined,
            domainName: domainName.trim() || undefined,
            hostingProvider: hostingProvider.trim() || undefined,
            billingDay: parsedBillingDay,
            contractRenewalDate: contractRenewalDate || undefined,
            socialManagementEnabled: socialManagementEnabled ? true : undefined,
          };
        } else {
          newClient = {
            id: generateClientId(),
            companyName: companyName.trim(),
            contactName: contactName.trim() || undefined,
            document: document.trim() || undefined,
            email: email.trim() || undefined,
            phone: cleanPhone,
            displayPhone,
            city: city.trim() || undefined,
            address: address.trim() || undefined,
            segment: segment.trim() || undefined,
            websiteUrl: websiteUrl.trim() || undefined,
            domainName: domainName.trim() || undefined,
            hostingProvider: hostingProvider.trim() || undefined,
            status,
            setupValue: parsedSetup,
            monthlyMrr: parsedMrr,
            billingDay: parsedBillingDay,
            contractStartDate: contractStartDate || undefined,
            contractRenewalDate: contractRenewalDate || undefined,
            serviceScope: serviceScope.trim() || undefined,
            socialManagementEnabled: socialManagementEnabled ? true : undefined,
            notes: notes.trim() || undefined,
            timeline: [
              {
                id: generateTimelineEventId('cli'),
                date: nowIso,
                type: 'criacao',
                title: 'Cliente cadastrado manualmente no Kaizen',
                author: userName,
              },
            ],
            createdAt: nowIso,
            schemaVersion: 1,
            updatedAt: nowIso,
          };
        }

        await onSaveClient(newClient, 'create');
      }

      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao salvar ficha do cliente.'
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
      title={isEditing ? `Editar Cliente — ${initialClient?.companyName}` : 'Novo Cliente'}
      subtitle={
        isEditing
          ? 'Atualize dados contratuais, infraestrutura e status operacional.'
          : 'Cadastre um novo cliente ou importe dados e histórico direto de um lead do CRM.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="client-form"
            variant="primary"
            loading={isSaving}
          >
            {isEditing ? 'Salvar Alterações' : 'Cadastrar Cliente'}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}

        {!isEditing && duplicateMatch && (
          <Alert
            variant="warning"
            title="Possível cliente já cadastrado"
            action={
              onOpenExistingClient ? (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onOpenExistingClient(duplicateMatch.existingClient);
                  }}
                >
                  Abrir ficha existente
                </Button>
              ) : undefined
            }
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Encontramos <strong>{duplicateMatch.existingClient.companyName}</strong> com{' '}
                {duplicateMatch.reason === 'originLeadId'
                  ? 'o mesmo lead de origem'
                  : duplicateMatch.reason === 'phone'
                  ? 'o mesmo telefone/WhatsApp'
                  : 'nome empresarial equivalente'}
                . Evite duplicar fichas.
              </span>
            </div>
          </Alert>
        )}

        {/* Origem CRM (apenas na criação ou exibição se vinculado) */}
        {!isEditing && availableLeadsToLink.length > 0 && (
          <div className="p-3.5 rounded-xl bg-[var(--kz-bg-subtle)]/70 border border-[var(--kz-border-subtle)] space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--kz-text-primary)]">
              <Link2 className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
              <span>Importar de um Lead do CRM (Opcional — preserva todo o histórico)</span>
            </div>
            <Select
              value={selectedLeadId}
              onChange={(e) => handleSelectLeadSource(e.target.value)}
            >
              <option value="">Cadastro direto sem vínculo de lead</option>
              {availableLeadsToLink.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.stage === 'fechado' ? '[Fechado] ' : ''}
                  {l.companyName} {l.city ? `· ${l.city}` : ''}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dados Cadastrais */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--kz-text-muted)] border-b border-[var(--kz-border-subtle)] pb-1.5">
              <Building2 className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
              <span>Identificação & Contato</span>
            </div>

            <Input
              label="Empresa / Nome Comercial *"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Clínica NutriVida"
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Responsável / Decisor"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ex: Dra. Camila"
              />
              <Input
                label="CPF / CNPJ"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="WhatsApp / Telefone *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11988887777"
                className="font-mono"
                required
              />
              <Input
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@empresa.com.br"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Segmento / Especialidade"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="Ex: Odontologia, Advocacia"
              />
              <Input
                label="Cidade / UF"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: São Paulo - SP"
              />
            </div>

            <Input
              label="Endereço"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, bairro"
            />
          </div>

          {/* Contrato, Financeiro & Infraestrutura */}
          <div className="space-y-3.5">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--kz-text-muted)] border-b border-[var(--kz-border-subtle)] pb-1.5">
              Contrato, Recorrência & Infraestrutura
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Status do Cliente *"
                value={status}
                onChange={(e) => setStatus(e.target.value as ClientStatus)}
              >
                {CLIENT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </Select>

              <Input
                label="Dia de Cobrança (1 a 31)"
                type="number"
                min={1}
                max={31}
                value={billingDay}
                onChange={(e) => setBillingDay(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Valor de Implantação / Setup (R$)"
                type="number"
                min={0}
                step="0.01"
                value={setupValue}
                onChange={(e) => setSetupValue(e.target.value)}
                placeholder="997"
                className="font-mono"
              />
              <Input
                label="Mensalidade / MRR (R$)"
                type="number"
                min={0}
                step="0.01"
                value={monthlyMrr}
                onChange={(e) => setMonthlyMrr(e.target.value)}
                placeholder="197"
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Início da Vigência"
                type="date"
                value={contractStartDate}
                onChange={(e) => setContractStartDate(e.target.value)}
                className="font-mono"
              />
              <Input
                label="Renovação Prevista"
                type="date"
                value={contractRenewalDate}
                onChange={(e) => setContractRenewalDate(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Domínio Principal"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
                placeholder="clinicanutrivida.com.br"
                className="font-mono"
              />
              <Input
                label="Hospedagem / Servidor"
                value={hostingProvider}
                onChange={(e) => setHostingProvider(e.target.value)}
                placeholder="Vercel / Hostinger / Cloudflare"
              />
            </div>

            <Input
              label="URL do Site / Projeto Publicado"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
              className="font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Textarea
            label="Escopo Contratado"
            rows={3}
            value={serviceScope}
            onChange={(e) => setServiceScope(e.target.value)}
            placeholder="Descreva entregas contratadas, SLA de alterações e serviços inclusos..."
          />
          <Textarea
            label="Observações Operacionais"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Acessos pendentes, preferências do cliente ou observações administrativas..."
          />
        </div>

        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--kz-bg-subtle)]/70 border border-[var(--kz-border-subtle)] cursor-pointer hover:border-[var(--kz-border-default)] transition-colors">
          <input
            type="checkbox"
            checked={socialManagementEnabled}
            onChange={(e) => setSocialManagementEnabled(e.target.checked)}
            className="mt-0.5 rounded border-[var(--kz-border-strong)] bg-[var(--kz-bg-elevated)] text-[var(--kz-accent)] focus:ring-[var(--kz-accent)]"
          />
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-[var(--kz-text-primary)] block">
              Cliente contratou gestão de Redes Sociais
            </span>
            <span className="text-[11px] text-[var(--kz-text-muted)] block">
              Libera o cadastro de canais (Instagram, Facebook, TikTok, LinkedIn) e calendário editorial no módulo Redes Sociais. Clientes sem este escopo não recebem gestão social automática.
            </span>
          </div>
        </label>
      </form>
    </Modal>
  );
};
