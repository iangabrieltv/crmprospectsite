import React, { useState } from 'react';
import {
  Lead,
  FunnelStageId,
  FUNNEL_STAGES,
  NicheCampaign,
  ScriptId,
  LeadNote,
  normalizeStageId
} from '../types/crm';
import { Client } from '../types/kaizen';
import {
  cleanPhoneForWhatsApp,
  formatDisplayPhone,
  buildWhatsAppLink,
  getContactGreetingMessage,
  getStageWhatsAppMessage,
  interpolateScript
} from '../utils/phone';
import { DEFAULT_SCRIPTS } from '../utils/initialData';
import { getActiveFirebaseIdToken } from '../services/authService';
import { ConfirmDialog } from './ui';
import {
  X,
  MessageCircle,
  ExternalLink,
  Star,
  Sparkles,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Copy,
  Check,
  DollarSign,
  AlertCircle,
  MapPin,
  Building2,
  Phone,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Layers,
  ShieldAlert,
  PhoneCall,
  UserCheck,
  FileSignature
} from 'lucide-react';

interface LeadModalProps {
  lead: Lead;
  niche: NicheCampaign;
  userName: string;
  linkedClient?: Client | null;
  linkedProposalsCount?: number;
  onClose: () => void;
  onUpdateLead: (updated: Lead) => void;
  onDeleteLead: (leadId: string) => void;
  onFastWhatsAppContacted: (lead: Lead) => void;
  onOpenScriptForLead?: (lead: Lead) => void;
  onConvertLeadToClient?: (lead: Lead) => void;
  onOpenClient?: (client: Client) => void;
  onCreateProposalForLead?: (lead: Lead) => void;
}

export const LeadModal: React.FC<LeadModalProps> = ({
  lead,
  niche,
  userName,
  linkedClient = null,
  linkedProposalsCount = 0,
  onClose,
  onUpdateLead,
  onDeleteLead,
  onFastWhatsAppContacted,
  onOpenScriptForLead,
  onConvertLeadToClient,
  onOpenClient,
  onCreateProposalForLead,
}) => {
  // Form state
  const [companyName, setCompanyName] = useState(lead.companyName);
  const [contactName, setContactName] = useState(lead.contactName || '');
  const [phone, setPhone] = useState(lead.phone);
  const [category, setCategory] = useState(lead.category || '');
  const [city, setCity] = useState(lead.city || niche.city);
  const [address, setAddress] = useState(lead.address || '');
  const [googleRating, setGoogleRating] = useState<string>(
    lead.googleRating !== undefined ? String(lead.googleRating) : ''
  );
  const [googleMapsUrl, setGoogleMapsUrl] = useState(lead.googleMapsUrl || '');
  const [websiteUrl, setWebsiteUrl] = useState(lead.websiteUrl || '');
  const [mockupUrl, setMockupUrl] = useState(lead.mockupUrl || '');
  const [stage, setStage] = useState<FunnelStageId>(() => normalizeStageId(lead.stage));
  const [scriptUsed, setScriptUsed] = useState<ScriptId>(lead.scriptUsed);
  const [creationValue, setCreationValue] = useState<string>(
    lead.creationValue !== undefined ? String(lead.creationValue) : ''
  );
  const [monthlyMrr, setMonthlyMrr] = useState<string>(
    lead.monthlyMrr !== undefined ? String(lead.monthlyMrr) : ''
  );
  const [objection, setObjection] = useState(lead.objection || '');
  const [notes, setNotes] = useState<LeadNote[]>(lead.notes || []);
  const [newNoteText, setNewNoteText] = useState('');

  // Meeting schedule state
  const [meetingDate, setMeetingDate] = useState(lead.meetingDate || '');
  const [meetingTime, setMeetingTime] = useState(lead.meetingTime || '');
  const [meetingNotes, setMeetingNotes] = useState(lead.meetingNotes || '');
  const [meetingLink, setMeetingLink] = useState(lead.meetingLink || '');
  const [meetingStatus, setMeetingStatus] = useState<'agendada' | 'realizada' | 'remarcada' | 'cancelada'>(lead.meetingStatus || 'agendada');
  
  // Callback (Ligar mais tarde / Entrar em contato outra hora) state
  const [hasCallback, setHasCallback] = useState(Boolean(lead.callbackDate));
  const [callbackDate, setCallbackDate] = useState(lead.callbackDate || '');
  const [callbackTime, setCallbackTime] = useState(lead.callbackTime || '15:00');
  const [callbackNotes, setCallbackNotes] = useState(lead.callbackNotes || '');
  const [callbackStatus, setCallbackStatus] = useState<'pendente' | 'realizado' | 'cancelado'>(lead.callbackStatus || 'pendente');
  const [aiPitch, setAiPitch] = useState(lead.aiPitch || '');
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  const [pitchError, setPitchError] = useState<string | null>(null);

  // Copy & delete confirm state
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Script calculation
  const defaultNicheScriptKey = Object.keys(niche.scripts)[0] || 'script_mensagem';
  const activeScriptKey =
    scriptUsed && scriptUsed !== 'none' && niche.scripts[scriptUsed]
      ? scriptUsed
      : defaultNicheScriptKey;
  const currentScriptDef =
    niche.scripts[activeScriptKey] ||
    Object.values(niche.scripts)[0] ||
    DEFAULT_SCRIPTS.script_mensagem;

  const leadVars = {
    empresa: companyName || lead.companyName,
    contato:
      contactName?.trim() ||
      lead.contactName?.trim() ||
      (niche.name.toLowerCase().includes('nutri') || niche.segment.toLowerCase().includes('nutri')
        ? 'Camila'
        : 'Doutor(a)'),
    nicho: niche.segment,
    cidade: city || lead.city || niche.city,
    linkMockup: mockupUrl || lead.mockupUrl,
    notaGoogle: googleRating ? Number(googleRating) : undefined,
    seuNome: userName,
    posicaoGoogle: '6ª',
    horario1: 'quinta às 14h',
    horario2: 'sexta às 10h',
  };

  const [activeMessageChoice, setActiveMessageChoice] = useState<'opening' | 'pc' | 'fu1'>(() => {
    const norm = normalizeStageId(lead.stage);
    if (norm === 'primeiro_contato') return 'pc';
    if (norm === 'follow_up_1') return 'fu1';
    return 'opening';
  });

  // Direct WhatsApp greeting using "Nome da Empresa / Profissional *" (companyName)
  const businessOrProName = (companyName?.trim() || lead.companyName?.trim() || '').trim();

  const getSelectedTemplate = () => {
    switch (activeMessageChoice) {
      case 'opening':
        return getStageWhatsAppMessage(businessOrProName, 'leads_sem_contato');
      case 'pc':
        return getStageWhatsAppMessage(businessOrProName, 'primeiro_contato');
      case 'fu1':
        return getStageWhatsAppMessage(businessOrProName, 'follow_up_1');
      default:
        return getStageWhatsAppMessage(businessOrProName, 'leads_sem_contato');
    }
  };

  const currentMessage = aiPitch ? aiPitch : getSelectedTemplate();

  const waLink = buildWhatsAppLink(phone, currentMessage);

  // Script stages accordion in LeadModal
  const [openLeadStageIds, setOpenLeadStageIds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    (currentScriptDef?.stages || []).forEach((st, idx) => {
      init[st.id] = idx === 0;
    });
    return init;
  });

  const [openLeadObjections, setOpenLeadObjections] = useState<boolean>(false);
  const [copiedStepId, setCopiedStepId] = useState<string | null>(null);

  const handleToggleLeadStage = (stageId: string) => {
    setOpenLeadStageIds((prev) => ({
      ...prev,
      [stageId]: !prev[stageId],
    }));
  };

  const handleOpenAllLeadStages = () => {
    const allOpen: Record<string, boolean> = {};
    (currentScriptDef?.stages || []).forEach((st) => {
      allOpen[st.id] = true;
    });
    setOpenLeadStageIds(allOpen);
  };

  const handleCloseAllLeadStages = () => {
    const allClosed: Record<string, boolean> = {};
    (currentScriptDef?.stages || []).forEach((st) => {
      allClosed[st.id] = false;
    });
    setOpenLeadStageIds(allClosed);
  };

  const handleTrackLeadStep = () => {
    onFastWhatsAppContacted(lead);
  };

  const handleCopyLeadStep = (stepMessage: string, stepId: string) => {
    const interpolated = interpolateScript(stepMessage, leadVars);
    navigator.clipboard.writeText(interpolated);
    setCopiedStepId(stepId);
    setTimeout(() => setCopiedStepId(null), 1500);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanNumber = cleanPhoneForWhatsApp(phone);
    const updated: Lead = {
      ...lead,
      companyName: companyName.trim() || lead.companyName,
      contactName: contactName.trim() || undefined,
      phone: cleanNumber,
      displayPhone: formatDisplayPhone(cleanNumber),
      category: category.trim() || undefined,
      city: city.trim() || niche.city,
      address: address.trim() || undefined,
      googleRating: googleRating ? parseFloat(googleRating) : undefined,
      googleMapsUrl: googleMapsUrl.trim() || undefined,
      websiteUrl: websiteUrl.trim() || undefined,
      mockupUrl: mockupUrl.trim() || undefined,
      stage,
      scriptUsed,
      creationValue: creationValue ? parseFloat(creationValue) : undefined,
      monthlyMrr: monthlyMrr ? parseFloat(monthlyMrr) : undefined,
      objection: objection.trim() || undefined,
      meetingDate: meetingDate || undefined,
      meetingTime: meetingTime || undefined,
      meetingNotes: meetingNotes.trim() || undefined,
      meetingLink: meetingLink.trim() || undefined,
      meetingStatus,
      callbackDate: hasCallback && callbackDate ? callbackDate : undefined,
      callbackTime: hasCallback && callbackTime ? callbackTime : undefined,
      callbackNotes: hasCallback && callbackNotes.trim() ? callbackNotes.trim() : undefined,
      callbackStatus: hasCallback ? callbackStatus : undefined,
      notes:
        hasCallback && callbackDate && callbackDate !== lead.callbackDate
          ? [
              {
                id: 'note-callback-' + Date.now(),
                date:
                  new Date().toLocaleDateString('pt-BR') +
                  ' ' +
                  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                text: `⏰ Agendado retorno (pediu para ligar mais tarde): ${new Date(callbackDate + 'T00:00:00').toLocaleDateString('pt-BR')}${callbackTime ? ` às ${callbackTime}` : ''}.${callbackNotes ? ` Motivo: "${callbackNotes}"` : ''}`,
                author: userName,
              },
              ...notes,
            ]
          : notes,
      aiPitch: aiPitch.trim() || undefined,
    };
    onUpdateLead(updated);
    onClose();
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    const newNote: LeadNote = {
      id: 'note-' + Date.now(),
      date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      text: newNoteText.trim(),
      author: userName,
    };
    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    setNewNoteText('');
  };

  const handleGenerateAiPitch = async () => {
    setIsGeneratingPitch(true);
    setPitchError(null);
    try {
      const token = await getActiveFirebaseIdToken();
      if (!token) {
        throw new Error('Sessão expirada. Faça login novamente para usar a IA.');
      }

      const res = await fetch('/api/gemini/generate-pitch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyName,
          niche: niche.segment,
          city,
          googleRating,
          objection,
          scriptType: currentScriptDef.title,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha no servidor Gemini');
      }

      const data = await res.json();
      if (data.pitch) {
        setAiPitch(data.pitch);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao consultar IA';
      setPitchError(`${msg} (modelo padrão sugerido abaixo).`);
      const fallbackPitch = `Olá equipe da ${companyName}! Aqui é o ${userName}. Notamos que vocês têm um atendimento elogiado em ${city} com ${googleRating || 'ótimas'} estrelas, mas os clientes que buscam no celular não encontram um site moderno com agendamento direto. Criamos um modelo pronto de alta conversão sem custo inicial para vocês avaliarem. Faz sentido te enviar em 1 minuto?`;
      setAiPitch(fallbackPitch);
    } finally {
      setIsGeneratingPitch(false);
    }
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(currentMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTrackWhatsApp = () => {
    onFastWhatsAppContacted({
      ...lead,
      companyName,
      phone: cleanPhoneForWhatsApp(phone),
      stage,
      scriptUsed,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--kz-bg-overlay)] backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[var(--kz-bg-surface)] sm:rounded-2xl shadow-[var(--kz-shadow-lg)] max-w-3xl w-full border-0 sm:border border-[var(--kz-border-default)] overflow-hidden my-auto h-full sm:h-auto max-h-[100dvh] sm:max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[var(--kz-border-subtle)] flex items-center justify-between bg-[var(--kz-bg-canvas)]/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] text-[var(--kz-accent-text)] flex items-center justify-center font-bold text-sm">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--kz-text-primary)] leading-tight">
                {companyName || 'Detalhes do Lead'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-[var(--kz-text-muted)] mt-0.5 flex-wrap">
                <span>{niche.name}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{formatDisplayPhone(phone)}</span>
                {googleMapsUrl && (
                  <>
                    <span aria-hidden="true">·</span>
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--kz-info-text)] hover:underline flex items-center gap-1 font-medium"
                      title="Abrir no Google Meu Negócio"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Google Maps / GMB</span>
                    </a>
                  </>
                )}
                {websiteUrl && (
                  <>
                    <span aria-hidden="true">·</span>
                    <a
                      href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--kz-success-text)] hover:underline flex items-center gap-1 font-medium"
                      title="Abrir site atual"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Site</span>
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-[var(--kz-text-subtle)] hover:text-[var(--kz-danger-text)] hover:bg-[var(--kz-danger-bg)] rounded-lg transition-colors cursor-pointer"
              title="Excluir Lead"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[var(--kz-text-subtle)] hover:text-[var(--kz-text-primary)] hover:bg-[var(--kz-bg-subtle)] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body with 2-Column Responsive Layout */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {(onConvertLeadToClient || onCreateProposalForLead || linkedClient) && (
            <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/75 border border-[var(--kz-border-subtle)] flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-xs">
                <UserCheck className="w-4 h-4 text-[var(--kz-accent)] shrink-0" />
                {linkedClient ? (
                  <span className="text-[var(--kz-text-secondary)]">
                    Cliente vinculado no Kaizen:{' '}
                    <strong className="text-[var(--kz-text-primary)]">
                      {linkedClient.companyName}
                    </strong>
                    {linkedProposalsCount > 0 && (
                      <span className="text-[var(--kz-text-muted)] ml-1.5 font-mono">
                        ({linkedProposalsCount} doc{linkedProposalsCount > 1 ? 's' : ''})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-[var(--kz-text-muted)]">
                    Converta este lead em Cliente (preservando todo o histórico) ou gere uma Proposta Comercial.
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {onCreateProposalForLead && (
                  <button
                    type="button"
                    onClick={() => {
                      onCreateProposalForLead(lead);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--kz-bg-surface)] text-[var(--kz-text-primary)] border border-[var(--kz-border-default)] hover:bg-[var(--kz-bg-muted)] transition-colors cursor-pointer"
                  >
                    <FileSignature className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                    <span>
                      {linkedProposalsCount > 0
                        ? `Nova Proposta (${linkedProposalsCount})`
                        : 'Criar Proposta'}
                    </span>
                  </button>
                )}

                {linkedClient && onOpenClient ? (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenClient(linkedClient);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)] hover:bg-emerald-500/20 transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Ver Ficha do Cliente</span>
                  </button>
                ) : onConvertLeadToClient ? (
                  <button
                    type="button"
                    onClick={() => {
                      onConvertLeadToClient(lead);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[var(--kz-accent)] text-[var(--kz-accent-fg)] hover:bg-[var(--kz-accent-hover)] transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Converter em Cliente</span>
                  </button>
                ) : null}
              </div>
            </div>
          )}

          <form id="lead-edit-form" onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Left Column: Business & Contact Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kz-text-muted)] border-b border-[var(--kz-border-subtle)] pb-1">
                Informações da Empresa
              </h3>

              <div>
                <label className="block text-xs font-medium text-[var(--kz-text-secondary)] mb-1">
                  Nome da Empresa / Profissional *
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--kz-text-secondary)] mb-1">
                    Nome do Tomador / Contato
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ex: Dra. Camila ou Dr. Marcos"
                    className="w-full text-xs px-3 py-2 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--kz-text-secondary)] mb-1">
                    Categoria / Especialidade
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex: Nutricionista, Clínica"
                    className="w-full text-xs px-3 py-2 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--kz-text-secondary)] mb-1">
                    WhatsApp (com DDD) *
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="11988887777"
                    className="w-full text-xs px-3 py-2 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] font-mono text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--kz-text-secondary)] mb-1">
                    Nota Google (1 a 5)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={googleRating}
                      onChange={(e) => setGoogleRating(e.target.value)}
                      placeholder="4.8"
                      className="w-full text-xs px-3 py-2 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] font-mono text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)]"
                    />
                    <Star className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-400 fill-amber-400" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--kz-text-secondary)] mb-1">
                  Cidade / Estado de Prospecção
                </label>
                <input
                  type="text"
                  list="leadmodal-cities-list"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] text-[var(--kz-text-primary)]"
                />
                <datalist id="leadmodal-cities-list">
                  {Array.from(new Set([niche.city, ...(niche.targetCities || [])].filter(Boolean))).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--kz-text-secondary)] mb-1">
                  Endereço / Bairro
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Av. Paulista, 1000 - Bela Vista"
                  className="w-full text-xs px-3 py-2 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--kz-text-secondary)] mb-1">
                  Link da Demonstração / Mockup de Site
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={mockupUrl}
                    onChange={(e) => setMockupUrl(e.target.value)}
                    placeholder="https://sua-demo.framer.website"
                    className="flex-1 text-xs px-3 py-2 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] font-mono text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)]"
                  />
                  {mockupUrl && (
                    <a
                      href={mockupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-2 bg-[var(--kz-bg-subtle)] hover:bg-[var(--kz-bg-muted)] border border-[var(--kz-border-default)] text-[var(--kz-text-secondary)] rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                      title="Testar link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Google Meu Negócio / Maps Link */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[var(--kz-text-secondary)] flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[var(--kz-info-text)]" />
                    <span>Link do Google Meu Negócio / Maps</span>
                  </label>
                  {!googleMapsUrl && companyName && (
                    <button
                      type="button"
                      onClick={() =>
                        setGoogleMapsUrl(
                          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${companyName} ${city || niche.city}`
                          )}`
                        )
                      }
                      className="text-[10px] text-[var(--kz-accent-text)] hover:underline cursor-pointer"
                    >
                      Gerar busca no Maps
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={googleMapsUrl}
                    onChange={(e) => setGoogleMapsUrl(e.target.value)}
                    placeholder="https://maps.google.com/... ou g.page/..."
                    className="flex-1 text-xs px-3 py-2 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] font-mono text-[var(--kz-info-text)] placeholder:text-[var(--kz-text-subtle)]"
                  />
                  {googleMapsUrl && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-2 bg-[var(--kz-info-bg)] hover:bg-sky-500/20 border border-[var(--kz-info-border)] text-[var(--kz-info-text)] rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                      title="Abrir no Google Meu Negócio"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Website / Social Link */}
              <div>
                <label className="block text-xs font-medium text-[var(--kz-text-secondary)] mb-1">
                  Site Atual / Rede Social (se houver)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://empresa.com.br ou instagram..."
                    className="flex-1 text-xs px-3 py-2 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] font-mono text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)]"
                  />
                  {websiteUrl && (
                    <a
                      href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-2 bg-[var(--kz-bg-subtle)] hover:bg-[var(--kz-bg-muted)] border border-[var(--kz-border-default)] text-[var(--kz-text-secondary)] rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                      title="Abrir site"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Pipeline Stage & Financials */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kz-text-muted)] border-b border-[var(--kz-border-subtle)] pb-1">
                Etapa do Funil & Vendas
              </h3>

              <div>
                <label className="block text-xs font-medium text-[var(--kz-text-secondary)] mb-1">
                  Etapa Atual no Funil Sequencial *
                </label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as FunnelStageId)}
                  className="w-full text-xs px-3 py-2 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] text-[var(--kz-text-primary)] font-semibold cursor-pointer"
                >
                  {FUNNEL_STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.shortName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--kz-text-secondary)] mb-1">
                  Script de Vendas Associado
                </label>
                <select
                  value={scriptUsed}
                  onChange={(e) => setScriptUsed(e.target.value as ScriptId)}
                  className="w-full text-xs px-3 py-2 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] text-[var(--kz-text-primary)] cursor-pointer"
                >
                  {Object.values(niche.scripts).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                  <option value="none">Sem script associado</option>
                </select>
              </div>

              {/* Financials: Setup + MRR */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-[var(--kz-bg-subtle)]/70 rounded-xl border border-[var(--kz-border-subtle)]">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">
                    Valor de Criação (Setup)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--kz-text-subtle)] font-mono">
                      R$
                    </span>
                    <input
                      type="number"
                      value={creationValue}
                      onChange={(e) => setCreationValue(e.target.value)}
                      placeholder="800"
                      className="w-full text-xs pl-8 pr-2 py-1.5 bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] font-mono tabular-nums text-[var(--kz-text-primary)] font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--kz-success-text)] mb-1">
                    Recorrência (MRR/mês)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--kz-success-text)] font-mono">
                      R$
                    </span>
                    <input
                      type="number"
                      value={monthlyMrr}
                      onChange={(e) => setMonthlyMrr(e.target.value)}
                      placeholder="99"
                      className="w-full text-xs pl-8 pr-2 py-1.5 bg-[var(--kz-bg-canvas)] border border-[var(--kz-success-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/35 font-mono tabular-nums text-[var(--kz-success-text)] font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Meeting Schedule Box (Active when stage is reuniao_marcada) */}
              {stage === 'reuniao_marcada' && (
                <div className="p-3.5 bg-[var(--kz-success-bg)] border border-[var(--kz-success-border)] rounded-xl space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[var(--kz-success-border)]">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--kz-success-text)]">
                      <Calendar className="w-4 h-4" />
                      <span>Agendamento da Reunião (Pipeline)</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-[var(--kz-success-text)] font-semibold">
                      {meetingDate ? 'Agendada' : 'Aguardando Data/Hora'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">
                        Data da Reunião
                      </label>
                      <input
                        type="date"
                        value={meetingDate}
                        onChange={(e) => setMeetingDate(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-success-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/35 font-mono text-[var(--kz-text-primary)] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">
                        Horário da Reunião
                      </label>
                      <input
                        type="time"
                        value={meetingTime}
                        onChange={(e) => setMeetingTime(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-success-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/35 font-mono text-[var(--kz-text-primary)] font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">
                      Link da Videochamada (Google Meet / WhatsApp)
                    </label>
                    <input
                      type="text"
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                      placeholder="https://meet.google.com/xyz ou WhatsApp Video"
                      className="w-full text-xs px-2.5 py-1.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-success-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/35 font-mono text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-[var(--kz-text-secondary)]">
                        Observações da Reunião (Estudo de Caso & Perfil)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const template = `• PERFIL DO CLIENTE & NEGÓCIO:\n- Responsável: ${contactName || 'Responsável'}\n- Negócio: ${companyName}\n- Situação atual: sem site próprio / perfil no Google Maps\n\n• ESTUDO DE CASO & OPORTUNIDADE:\n- Demonstrar protótipo responsivo no celular\n- Proposta: R$ 697 (ancoragem R$ 997) + R$ 200/mês\n- Prazo: entrega em até 72h`;
                          setMeetingNotes((prev) => (prev ? `${prev}\n\n${template}` : template));
                        }}
                        className="text-[10px] text-[var(--kz-success-text)] hover:underline font-semibold cursor-pointer"
                      >
                        + Inserir Template
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={meetingNotes}
                      onChange={(e) => setMeetingNotes(e.target.value)}
                      placeholder="Anote o perfil do cliente, pontos do estudo de caso, dúvidas da ligação e o que apresentar..."
                      className="w-full text-xs p-2.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-success-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/35 text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* Ligar Mais Tarde / Retorno Agendado (quando pede para falar outra hora) */}
              <div className="p-3.5 bg-[var(--kz-warning-bg)] border border-[var(--kz-warning-border)] rounded-xl space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-[var(--kz-warning-border)]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--kz-warning-text)]">
                    <PhoneCall className="w-4 h-4 shrink-0" />
                    <span>Ligar Mais Tarde / Entrar em Contato Outra Hora</span>
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--kz-warning-text)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasCallback}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setHasCallback(checked);
                        if (checked && !callbackDate) {
                          setCallbackDate(new Date().toISOString().split('T')[0]);
                        }
                      }}
                      className="rounded accent-[#C6A15B] w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Ativar Retorno</span>
                  </label>
                </div>

                {hasCallback ? (
                  <div className="space-y-2.5 animate-in fade-in duration-150">
                    {/* Quick shortcuts */}
                    <div className="flex flex-wrap items-center gap-1 text-[10px]">
                      <span className="text-[var(--kz-warning-text)] font-medium mr-1">Atalhos rápidos:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                          const now = new Date();
                          const futureHour = (now.getHours() + 1) % 24;
                          setCallbackDate(today);
                          setCallbackTime(`${String(futureHour).padStart(2, '0')}:00`);
                        }}
                        className="px-2 py-0.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-warning-border)] hover:bg-amber-500/20 rounded text-[var(--kz-warning-text)] font-semibold cursor-pointer"
                      >
                        Hoje +1h
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCallbackDate(new Date().toISOString().split('T')[0]);
                          setCallbackTime('15:00');
                        }}
                        className="px-2 py-0.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-warning-border)] hover:bg-amber-500/20 rounded text-[var(--kz-warning-text)] font-semibold cursor-pointer"
                      >
                        Hoje às 15:00
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCallbackDate(new Date().toISOString().split('T')[0]);
                          setCallbackTime('17:00');
                        }}
                        className="px-2 py-0.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-warning-border)] hover:bg-amber-500/20 rounded text-[var(--kz-warning-text)] font-semibold cursor-pointer"
                      >
                        Hoje às 17:00
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          setCallbackDate(tomorrow.toISOString().split('T')[0]);
                          setCallbackTime('09:30');
                        }}
                        className="px-2 py-0.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-warning-border)] hover:bg-amber-500/20 rounded text-[var(--kz-warning-text)] font-semibold cursor-pointer"
                      >
                        Amanhã 09:30
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">
                          Data do Retorno *
                        </label>
                        <input
                          type="date"
                          value={callbackDate}
                          onChange={(e) => setCallbackDate(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-warning-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/35 font-mono text-[var(--kz-text-primary)] font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">
                          Horário Previsto *
                        </label>
                        <input
                          type="time"
                          value={callbackTime}
                          onChange={(e) => setCallbackTime(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-warning-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/35 font-mono text-[var(--kz-text-primary)] font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">
                        O que foi combinado / Motivo
                      </label>
                      <input
                        type="text"
                        value={callbackNotes}
                        onChange={(e) => setCallbackNotes(e.target.value)}
                        placeholder="Ex: Está em atendimento, secretária pediu retorno às 15:30"
                        className="w-full text-xs px-2.5 py-1.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-warning-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/35 text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)]"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-semibold text-[var(--kz-text-secondary)]">Status:</label>
                        <select
                          value={callbackStatus}
                          onChange={(e) => setCallbackStatus(e.target.value as any)}
                          className="text-xs px-2 py-1 bg-[var(--kz-bg-surface)] border border-[var(--kz-warning-border)] rounded-lg text-[var(--kz-warning-text)] font-semibold cursor-pointer"
                        >
                          <option value="pendente">⏳ Pendente</option>
                          <option value="realizado">✅ Realizado (Já liguei)</option>
                          <option value="cancelado">❌ Cancelado</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setHasCallback(false);
                          setCallbackDate('');
                          setCallbackNotes('');
                        }}
                        className="text-[10px] text-[var(--kz-danger-text)] hover:underline font-semibold cursor-pointer"
                      >
                        Remover retorno
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--kz-text-secondary)]">
                    O cliente estava ocupado ou pediu para falar mais tarde? Marque <strong className="text-[var(--kz-warning-text)]">Ativar Retorno</strong> para a Agenda te avisar no horário exato!
                  </p>
                )}
              </div>

              {/* Objection Box (Active if stage is nao_interessado) */}
              <div>
                <label className="block text-xs font-medium text-[var(--kz-text-secondary)] mb-1">
                  Objeção / Motivo (se Não Interessado)
                </label>
                <input
                  type="text"
                  value={objection}
                  onChange={(e) => setObjection(e.target.value)}
                  placeholder="Ex: Já tem parente que faz, achou caro, etc."
                  className="w-full text-xs px-3 py-2 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)]"
                />
              </div>

              {/* Last interaction details */}
              <div className="text-[11px] text-[var(--kz-text-muted)] flex items-center justify-between pt-1">
                <span>Criado em: {new Date(lead.createdAt).toLocaleDateString('pt-BR')}</span>
                {lead.lastContactDate && (
                  <span>Último contato: {new Date(lead.lastContactDate).toLocaleDateString('pt-BR')}</span>
                )}
              </div>
            </div>
          </form>

          {/* Quick WhatsApp & AI Pitch Section */}
          <div className="border border-[var(--kz-border-subtle)] rounded-xl p-4 bg-[var(--kz-bg-subtle)]/50 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-[var(--kz-success-text)]" />
                <span className="text-xs font-bold text-[var(--kz-text-primary)]">
                  Mensagem Pronta para Disparo (WhatsApp)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleGenerateAiPitch}
                  disabled={isGeneratingPitch}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-violet-300 bg-violet-500/15 border border-violet-500/30 hover:bg-violet-500/25 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  title="Gerar pitch personalizado com IA"
                >
                  <Sparkles className="w-3 h-3 text-violet-400" />
                  <span>{isGeneratingPitch ? 'Gerando com IA...' : 'Personalizar com IA'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[var(--kz-text-secondary)] bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] hover:bg-[var(--kz-bg-muted)] rounded-lg transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-[var(--kz-success-text)]" /> : <Copy className="w-3 h-3 text-[var(--kz-text-muted)]" />}
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {pitchError && (
              <div className="text-[11px] text-[var(--kz-warning-text)] bg-[var(--kz-warning-bg)] border border-[var(--kz-warning-border)] px-3 py-1.5 rounded-lg">
                {pitchError}
              </div>
            )}

            {/* Quick Follow-up Chooser Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setAiPitch('');
                  setActiveMessageChoice('opening');
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer border ${
                  activeMessageChoice === 'opening' && !aiPitch
                    ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)] border-[var(--kz-accent)] shadow-[var(--kz-shadow-xs)]'
                    : 'bg-[var(--kz-bg-surface)] text-[var(--kz-text-secondary)] border-[var(--kz-border-default)] hover:bg-[var(--kz-bg-muted)]'
                }`}
                title="Mensagem inicial de abertura com saudação por horário"
              >
                1. Abertura (Bom dia)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiPitch('');
                  setActiveMessageChoice('pc');
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer border ${
                  activeMessageChoice === 'pc' && !aiPitch
                    ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)] border-[var(--kz-accent)] shadow-[var(--kz-shadow-xs)]'
                    : 'bg-[var(--kz-bg-surface)] text-[var(--kz-text-secondary)] border-[var(--kz-border-default)] hover:bg-[var(--kz-bg-muted)]'
                }`}
                title="1º Contato: Passando novamente por aqui"
              >
                2. 1º Contato (Passando novamente 😊)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiPitch('');
                  setActiveMessageChoice('fu1');
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer border ${
                  activeMessageChoice === 'fu1' && !aiPitch
                    ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)] border-[var(--kz-accent)] shadow-[var(--kz-shadow-xs)]'
                    : 'bg-[var(--kz-bg-surface)] text-[var(--kz-text-secondary)] border-[var(--kz-border-default)] hover:bg-[var(--kz-bg-muted)]'
                }`}
                title="Follow-up 1: Retomada com foco em rotina de atendimentos e Google"
              >
                3. Follow-up 1 (Rotina corrida)
              </button>
            </div>

            {/* Message Box */}
            <div className="bg-[var(--kz-bg-canvas)] rounded-lg border border-[var(--kz-border-default)] p-3 text-xs text-[var(--kz-text-primary)] font-sans whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
              {currentMessage}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-[var(--kz-text-muted)]">
                Variáveis substituídas automaticamente para este lead.
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {onOpenScriptForLead && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenScriptForLead(lead);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--kz-accent-text)] bg-[var(--kz-accent-soft)] hover:bg-[var(--kz-accent)]/20 rounded-lg border border-[var(--kz-accent-border)] transition-colors cursor-pointer"
                    title="Abrir no Simulador de Scripts com as variáveis deste lead preenchidas"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Ver no Script</span>
                  </button>
                )}
                {(scriptUsed === 'script_ligacao' || scriptUsed === 'script3') && phone && (
                  <a
                    href={`tel:${phone.replace(/\D/g, '')}`}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[var(--kz-info-solid)] hover:bg-sky-500 rounded-lg shadow-[var(--kz-shadow-xs)] transition-colors cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Ligar Agora</span>
                  </a>
                )}
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleTrackWhatsApp}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[var(--kz-success-solid)] hover:bg-emerald-500 rounded-lg shadow-[var(--kz-shadow-xs)] transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 fill-white/20" />
                  <span>Abrir no WhatsApp</span>
                </a>
              </div>
            </div>
          </div>

          {/* Full Script Stages & Messages Accordion */}
          {currentScriptDef?.stages && currentScriptDef.stages.length > 0 && (
            <div className="border border-[var(--kz-accent-border)] rounded-xl p-4 bg-[var(--kz-accent-soft)]/30 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Layers className="w-4 h-4 text-[var(--kz-accent)]" />
                  <span className="text-xs font-bold text-[var(--kz-text-primary)]">
                    Mensagens do Script — {currentScriptDef.title}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--kz-text-muted)] bg-[var(--kz-bg-surface)] px-2 py-0.5 rounded-full border border-[var(--kz-border-subtle)]">
                    {currentScriptDef.stages.filter((s) => !!openLeadStageIds[s.id]).length} de {currentScriptDef.stages.length} abertas
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleOpenAllLeadStages}
                    className="px-2.5 py-1 text-[11px] font-bold text-[var(--kz-accent-text)] bg-[var(--kz-bg-surface)] hover:bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    title="Abrir todas as abas"
                  >
                    <ChevronDown className="w-3 h-3" />
                    <span>Abrir Todas</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseAllLeadStages}
                    className="px-2.5 py-1 text-[11px] font-bold text-[var(--kz-text-secondary)] bg-[var(--kz-bg-surface)] hover:bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    title="Fechar todas as abas"
                  >
                    <ChevronUp className="w-3 h-3" />
                    <span>Fechar Todas</span>
                  </button>
                </div>
              </div>

              {/* Accordion List */}
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {currentScriptDef.stages.map((stage, sIdx) => {
                  const isStageOpen = !!openLeadStageIds[stage.id];
                  return (
                    <div
                      key={stage.id}
                      className={`bg-[var(--kz-bg-surface)] rounded-lg border transition-all overflow-hidden ${
                        isStageOpen ? 'border-[var(--kz-accent-border)] shadow-[var(--kz-shadow-xs)]' : 'border-[var(--kz-border-subtle)] hover:border-[var(--kz-border-default)]'
                      }`}
                    >
                      {/* Stage Tab Header: click to toggle open/close */}
                      <div
                        onClick={() => handleToggleLeadStage(stage.id)}
                        className={`p-2.5 flex items-center justify-between cursor-pointer border-b transition-colors select-none ${
                          isStageOpen ? 'bg-[var(--kz-accent-soft)] border-[var(--kz-accent-border)]' : 'bg-[var(--kz-bg-surface)] border-transparent hover:bg-[var(--kz-bg-subtle)]'
                        }`}
                        title={isStageOpen ? 'Clique para fechar esta aba' : 'Clique para abrir esta aba'}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full text-[10px] font-bold font-mono flex items-center justify-center ${
                              isStageOpen ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)]' : 'bg-[var(--kz-bg-muted)] text-[var(--kz-text-secondary)]'
                            }`}
                          >
                            {sIdx + 1}
                          </span>
                          <span className="text-xs font-bold text-[var(--kz-text-primary)]">
                            {stage.stageTitle}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-[var(--kz-text-subtle)]">
                            {stage.steps.length} {stage.steps.length === 1 ? 'msg' : 'msgs'}
                          </span>
                          {isStageOpen ? (
                            <ChevronUp className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[var(--kz-text-subtle)]" />
                          )}
                        </div>
                      </div>

                      {/* Stage Messages */}
                      {isStageOpen && (
                        <div className="p-3 space-y-3 bg-[var(--kz-bg-subtle)]/40 divide-y divide-[var(--kz-border-subtle)]">
                          {stage.steps.map((step) => {
                            const interpolatedStep = interpolateScript(step.message, leadVars);
                            return (
                              <div key={step.id} className="pt-2.5 first:pt-0 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold text-[var(--kz-text-secondary)]">
                                    {step.title}
                                    {step.condition && (
                                      <span className="font-normal text-[var(--kz-text-muted)] italic ml-1">
                                        ({step.condition})
                                      </span>
                                    )}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyLeadStep(step.message, step.id)}
                                      className="px-2 py-0.5 text-[10px] font-medium text-[var(--kz-text-secondary)] bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] hover:bg-[var(--kz-bg-muted)] rounded flex items-center gap-1 cursor-pointer"
                                      title="Copiar texto"
                                    >
                                      {copiedStepId === step.id ? (
                                        <>
                                          <Check className="w-2.5 h-2.5 text-[var(--kz-success-text)]" />
                                          <span className="text-[var(--kz-success-text)] font-semibold">Copiado</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-2.5 h-2.5 text-[var(--kz-text-muted)]" />
                                          <span>Copiar</span>
                                        </>
                                      )}
                                    </button>

                                    <a
                                      href={buildWhatsAppLink(phone, interpolatedStep)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={handleTrackLeadStep}
                                      className="px-2 py-0.5 text-[10px] font-semibold text-white bg-[var(--kz-success-solid)] hover:bg-emerald-500 rounded flex items-center gap-1 cursor-pointer"
                                      title="Enviar esta mensagem no WhatsApp"
                                    >
                                      <MessageCircle className="w-2.5 h-2.5 fill-white/20" />
                                      <span>WhatsApp</span>
                                    </a>
                                  </div>
                                </div>

                                <div className="p-2.5 bg-[var(--kz-bg-canvas)] rounded border border-[var(--kz-border-subtle)] text-xs text-[var(--kz-text-primary)] whitespace-pre-wrap leading-relaxed">
                                  {interpolatedStep}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes & Activity Log */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kz-text-muted)] border-b border-[var(--kz-border-subtle)] pb-1">
              Histórico de Interações & Reuniões
            </h3>

            {/* Add note input */}
            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Adicionar anotação (ex: Ligou interessado, reunião agendada p/ quinta às 15h)..."
                className="flex-1 text-xs px-3 py-2 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]/35 focus:border-[var(--kz-accent)] text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)]"
              />
              <button
                type="submit"
                className="px-3 py-2 text-xs font-semibold text-[var(--kz-text-primary)] bg-[var(--kz-bg-muted)] hover:bg-[#2B2B34] border border-[var(--kz-border-default)] rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Salvar Nota</span>
              </button>
            </form>

            {/* Note items */}
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {notes.length === 0 ? (
                <p className="text-xs text-[var(--kz-text-subtle)] italic py-2">
                  Nenhuma anotação registrada ainda.
                </p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-2.5 rounded-lg bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-subtle)] text-xs flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[var(--kz-text-muted)] font-mono">
                      <span>{note.date}</span>
                      {note.author && <span className="font-sans font-medium text-[var(--kz-text-secondary)]">{note.author}</span>}
                    </div>
                    <p className="text-[var(--kz-text-primary)] text-xs">{note.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-[var(--kz-border-subtle)] flex items-center justify-between sm:justify-end gap-2 bg-[var(--kz-bg-canvas)]/70 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 sm:py-2 text-xs font-semibold text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)] rounded-lg transition-colors cursor-pointer min-h-[40px] sm:min-h-0"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleSave()}
            className="px-5 py-2.5 sm:py-2 text-xs font-bold text-[var(--kz-accent-fg)] bg-[var(--kz-accent)] hover:bg-[var(--kz-accent-hover)] rounded-lg transition-colors cursor-pointer shadow-[var(--kz-shadow-xs)] min-h-[40px] sm:min-h-0"
          >
            Salvar Alterações
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          onDeleteLead(lead.id);
          setShowDeleteConfirm(false);
          onClose();
        }}
        title="Excluir Lead do CRM"
        description={
          <span>
            Deseja remover permanentemente <strong>{lead.companyName}</strong> do CRM e do Cloud
            Firestore?
          </span>
        }
        confirmLabel="Excluir Lead"
        variant="danger"
      />
    </div>
  );
};
