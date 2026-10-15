import React, { useState } from 'react';
import {
  Lead,
  FunnelStageId,
  FUNNEL_STAGES,
  NicheCampaign,
  ScriptId,
  LeadNote
} from '../types/crm';
import {
  cleanPhoneForWhatsApp,
  formatDisplayPhone,
  buildWhatsAppLink,
  interpolateScript
} from '../utils/phone';
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
  ShieldAlert
} from 'lucide-react';

interface LeadModalProps {
  lead: Lead;
  niche: NicheCampaign;
  userName: string;
  onClose: () => void;
  onUpdateLead: (updated: Lead) => void;
  onDeleteLead: (leadId: string) => void;
  onFastWhatsAppContacted: (lead: Lead) => void;
  onOpenScriptForLead?: (lead: Lead) => void;
}

export const LeadModal: React.FC<LeadModalProps> = ({
  lead,
  niche,
  userName,
  onClose,
  onUpdateLead,
  onDeleteLead,
  onFastWhatsAppContacted,
  onOpenScriptForLead,
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
  const [stage, setStage] = useState<FunnelStageId>(lead.stage);
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
  
  // AI Pitch state
  const [aiPitch, setAiPitch] = useState(lead.aiPitch || '');
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  const [pitchError, setPitchError] = useState<string | null>(null);

  // Copy state
  const [copied, setCopied] = useState(false);

  // Script calculation
  const defaultNicheScriptKey = Object.keys(niche.scripts)[0] || 'script1';
  const activeScriptKey =
    scriptUsed && scriptUsed !== 'none' && niche.scripts[scriptUsed]
      ? scriptUsed
      : defaultNicheScriptKey;
  const currentScriptDef =
    niche.scripts[activeScriptKey] ||
    Object.values(niche.scripts)[0] ||
    niche.scripts.script1;

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

  const [activeMessageChoice, setActiveMessageChoice] = useState<'opening' | 'fu1' | 'fu2' | 'fu3'>('opening');

  const getSelectedTemplate = () => {
    switch (activeMessageChoice) {
      case 'fu1':
        return currentScriptDef?.followUp1 || currentScriptDef?.template || '';
      case 'fu2':
        return currentScriptDef?.followUp2 || currentScriptDef?.template || '';
      case 'fu3':
        return currentScriptDef?.followUp3 || currentScriptDef?.followUp2 || currentScriptDef?.template || '';
      default:
        return currentScriptDef?.template || '';
    }
  };

  const currentMessage = aiPitch
    ? aiPitch
    : interpolateScript(getSelectedTemplate(), leadVars);

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

  const handleSendLeadStep = (stepMessage: string) => {
    onFastWhatsAppContacted(lead);
    const interpolated = interpolateScript(stepMessage, leadVars);
    const link = buildWhatsAppLink(phone, interpolated);
    window.open(link, '_blank', 'noopener,noreferrer');
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
      notes,
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
      const res = await fetch('/api/gemini/generate-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error('Falha no servidor Gemini');
      }

      const data = await res.json();
      if (data.pitch) {
        setAiPitch(data.pitch);
      }
    } catch (err: any) {
      console.warn('AI Pitch fallback triggered:', err);
      // Fallback generator
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

  const handleTriggerWhatsApp = () => {
    onFastWhatsAppContacted({
      ...lead,
      companyName,
      phone: cleanPhoneForWhatsApp(phone),
      stage,
      scriptUsed,
    });
    window.open(waLink, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-sm">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {companyName || 'Detalhes do Lead'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
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
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium hover:underline"
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
                      className="text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-medium hover:underline"
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
              onClick={() => {
                if (confirm(`Deseja remover "${lead.companyName}" do CRM?`)) {
                  onDeleteLead(lead.id);
                  onClose();
                }
              }}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Excluir Lead"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body with 2-Column Responsive Layout */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          <form id="lead-edit-form" onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Left Column: Business & Contact Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
                Informações da Empresa
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nome da Empresa / Profissional *
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nome do Tomador / Contato
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ex: Dra. Camila ou Dr. Marcos"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Categoria / Especialidade
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex: Nutricionista, Clínica"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    WhatsApp (com DDD) *
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="11988887777"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
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
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
                    />
                    <Star className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-400 fill-amber-400" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cidade / Estado de Prospecção
                </label>
                <input
                  type="text"
                  list="leadmodal-cities-list"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
                <datalist id="leadmodal-cities-list">
                  {Array.from(new Set([niche.city, ...(niche.targetCities || [])].filter(Boolean))).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Endereço / Bairro
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Av. Paulista, 1000 - Bela Vista"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Link da Demonstração / Mockup de Site
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={mockupUrl}
                    onChange={(e) => setMockupUrl(e.target.value)}
                    placeholder="https://sua-demo.framer.website"
                    className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
                  />
                  {mockupUrl && (
                    <a
                      href={mockupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer"
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
                  <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-blue-600" />
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
                      className="text-[10px] text-blue-600 hover:underline cursor-pointer"
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
                    className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-blue-600"
                  />
                  {googleMapsUrl && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                      title="Abrir no Google Meu Negócio"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Website / Social Link */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Site Atual / Rede Social (se houver)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://empresa.com.br ou instagram..."
                    className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
                  />
                  {websiteUrl && (
                    <a
                      href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer"
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
                Etapa do Funil & Vendas
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Etapa Atual no Funil Sequencial *
                </label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as FunnelStageId)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-semibold"
                >
                  {FUNNEL_STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.shortName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Script de Vendas Associado
                </label>
                <select
                  value={scriptUsed}
                  onChange={(e) => setScriptUsed(e.target.value as ScriptId)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
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
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Valor de Criação (Setup)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                      R$
                    </span>
                    <input
                      type="number"
                      value={creationValue}
                      onChange={(e) => setCreationValue(e.target.value)}
                      placeholder="800"
                      className="w-full text-xs pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tabular-nums text-slate-900 font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-emerald-800 mb-1">
                    Recorrência (MRR/mês)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-emerald-600 font-mono">
                      R$
                    </span>
                    <input
                      type="number"
                      value={monthlyMrr}
                      onChange={(e) => setMonthlyMrr(e.target.value)}
                      placeholder="99"
                      className="w-full text-xs pl-8 pr-2 py-1.5 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono tabular-nums text-emerald-900 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Meeting Schedule Box (Active when stage is reuniao_marcada) */}
              {stage === 'reuniao_marcada' && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/90 rounded-xl space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/60">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span>Agendamento da Reunião (Pipeline)</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                      {meetingDate ? 'Agendada' : 'Aguardando Data/Hora'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                        Data da Reunião
                      </label>
                      <input
                        type="date"
                        value={meetingDate}
                        onChange={(e) => setMeetingDate(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-slate-900 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                        Horário da Reunião
                      </label>
                      <input
                        type="time"
                        value={meetingTime}
                        onChange={(e) => setMeetingTime(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-slate-900 font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                      Link da Videochamada (Google Meet / WhatsApp)
                    </label>
                    <input
                      type="text"
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                      placeholder="https://meet.google.com/xyz ou WhatsApp Video"
                      className="w-full text-xs px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-emerald-950">
                        Observações da Reunião (Estudo de Caso & Perfil)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const template = `• PERFIL DO CLIENTE & NEGÓCIO:\n- Responsável: ${contactName || 'Responsável'}\n- Negócio: ${companyName}\n- Situação atual: sem site próprio / perfil no Google Maps\n\n• ESTUDO DE CASO & OPORTUNIDADE:\n- Demonstrar protótipo responsivo no celular\n- Proposta: R$ 697 (ancoragem R$ 997) + R$ 200/mês\n- Prazo: entrega em até 72h`;
                          setMeetingNotes((prev) => (prev ? `${prev}\n\n${template}` : template));
                        }}
                        className="text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer"
                      >
                        + Inserir Template
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={meetingNotes}
                      onChange={(e) => setMeetingNotes(e.target.value)}
                      placeholder="Anote o perfil do cliente, pontos do estudo de caso, dúvidas da ligação e o que apresentar..."
                      className="w-full text-xs p-2.5 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* Objection Box (Active if stage is nao_interessado) */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Objeção / Motivo (se Não Interessado)
                </label>
                <input
                  type="text"
                  value={objection}
                  onChange={(e) => setObjection(e.target.value)}
                  placeholder="Ex: Já tem parente que faz, achou caro, etc."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              {/* Last interaction details */}
              <div className="text-[11px] text-slate-600 flex items-center justify-between pt-1">
                <span>Criado em: {new Date(lead.createdAt).toLocaleDateString('pt-BR')}</span>
                {lead.lastContactDate && (
                  <span>Último contato: {new Date(lead.lastContactDate).toLocaleDateString('pt-BR')}</span>
                )}
              </div>
            </div>
          </form>

          {/* Quick WhatsApp & AI Pitch Section */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">
                  Mensagem Pronta para Disparo (WhatsApp)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleGenerateAiPitch}
                  disabled={isGeneratingPitch}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  title="Gerar pitch personalizado com IA"
                >
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  <span>{isGeneratingPitch ? 'Gerando com IA...' : 'Personalizar com IA'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

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
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                1. Abertura
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiPitch('');
                  setActiveMessageChoice('fu1');
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer border ${
                  activeMessageChoice === 'fu1' && !aiPitch
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Mandar à tarde após enviar o mockup"
              >
                Follow-up 1 (À tarde)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiPitch('');
                  setActiveMessageChoice('fu2');
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer border ${
                  activeMessageChoice === 'fu2' && !aiPitch
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Mandar após 24h sem resposta"
              >
                Follow-up 2 (24h)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiPitch('');
                  setActiveMessageChoice('fu3');
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer border ${
                  activeMessageChoice === 'fu3' && !aiPitch
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Mandar após 48h sem resposta (mais direto)"
              >
                Follow-up 3 (48h)
              </button>
            </div>

            {/* Message Box */}
            <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs text-slate-800 font-sans whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
              {currentMessage}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-600">
                Variáveis substituídas automaticamente para este lead.
              </span>
              <div className="flex items-center gap-2">
                {onOpenScriptForLead && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenScriptForLead(lead);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                    title="Abrir no Simulador de Scripts com as variáveis deste lead preenchidas"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Ver no Script</span>
                  </button>
                )}
                {scriptUsed === 'script3' && phone && (
                  <a
                    href={`tel:${phone.replace(/\D/g, '')}`}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Ligar Agora</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleTriggerWhatsApp}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 fill-white/20" />
                  <span>Abrir no WhatsApp</span>
                </button>
              </div>
            </div>
          </div>

          {/* Full Script Stages & Messages Accordion */}
          {currentScriptDef?.stages && currentScriptDef.stages.length > 0 && (
            <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-900">
                    Mensagens do Script — {currentScriptDef.title}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                    {currentScriptDef.stages.filter((s) => !!openLeadStageIds[s.id]).length} de {currentScriptDef.stages.length} abertas
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleOpenAllLeadStages}
                    className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    title="Abrir todas as abas"
                  >
                    <ChevronDown className="w-3 h-3" />
                    <span>Abrir Todas</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseAllLeadStages}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
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
                      className={`bg-white rounded-lg border transition-all overflow-hidden ${
                        isStageOpen ? 'border-blue-300 shadow-2xs' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Stage Tab Header: click to toggle open/close */}
                      <div
                        onClick={() => handleToggleLeadStage(stage.id)}
                        className={`p-2.5 flex items-center justify-between cursor-pointer border-b transition-colors select-none ${
                          isStageOpen ? 'bg-blue-50/50 border-blue-100' : 'bg-white border-transparent hover:bg-slate-50'
                        }`}
                        title={isStageOpen ? 'Clique para fechar esta aba' : 'Clique para abrir esta aba'}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full text-[10px] font-bold font-mono flex items-center justify-center ${
                              isStageOpen ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {sIdx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            {stage.stageTitle}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-slate-400">
                            {stage.steps.length} {stage.steps.length === 1 ? 'msg' : 'msgs'}
                          </span>
                          {isStageOpen ? (
                            <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Stage Messages */}
                      {isStageOpen && (
                        <div className="p-3 space-y-3 bg-slate-50/40 divide-y divide-slate-100">
                          {stage.steps.map((step) => {
                            const interpolatedStep = interpolateScript(step.message, leadVars);
                            return (
                              <div key={step.id} className="pt-2.5 first:pt-0 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold text-slate-800">
                                    {step.title}
                                    {step.condition && (
                                      <span className="font-normal text-slate-500 italic ml-1">
                                        ({step.condition})
                                      </span>
                                    )}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyLeadStep(step.message, step.id)}
                                      className="px-2 py-0.5 text-[10px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded flex items-center gap-1 cursor-pointer"
                                      title="Copiar texto"
                                    >
                                      {copiedStepId === step.id ? (
                                        <>
                                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                                          <span className="text-emerald-700 font-semibold">Copiado</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-2.5 h-2.5 text-slate-400" />
                                          <span>Copiar</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleSendLeadStep(step.message)}
                                      className="px-2 py-0.5 text-[10px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded flex items-center gap-1 cursor-pointer"
                                      title="Enviar esta mensagem no WhatsApp"
                                    >
                                      <MessageCircle className="w-2.5 h-2.5 fill-white/20" />
                                      <span>WhatsApp</span>
                                    </button>
                                  </div>
                                </div>

                                <div className="p-2.5 bg-white rounded border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
              Histórico de Interações & Reuniões
            </h3>

            {/* Add note input */}
            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Adicionar anotação (ex: Ligou interessado, reunião agendada p/ quinta às 15h)..."
                className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
              <button
                type="submit"
                className="px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Salvar Nota</span>
              </button>
            </form>

            {/* Note items */}
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {notes.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  Nenhuma anotação registrada ainda.
                </p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono">
                      <span>{note.date}</span>
                      {note.author && <span className="font-sans font-medium text-slate-600">{note.author}</span>}
                    </div>
                    <p className="text-slate-800 text-xs">{note.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleSave()}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};
