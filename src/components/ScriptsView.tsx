import React, { useState, useRef, useEffect } from 'react';
import { NicheCampaign, Lead, ScriptDefinition, ScriptStageBlock, ScriptSubStep, ScriptObjection } from '../types/crm';
import {
  interpolateScript,
  buildWhatsAppLink,
  formatDisplayPhone
} from '../utils/phone';
import { getActiveFirebaseIdToken } from '../services/authService';
import { ConfirmDialog } from './ui';
import {
  FileText,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  Edit3,
  Save,
  RotateCcw,
  Zap,
  Plus,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Layers,
  Clock,
  Send,
  Trash2,
  X,
  Sparkles,
  ArrowRight,
  Info,
  CheckCircle2,
  HelpCircle,
  Target,
  PhoneCall,
  Wand2,
  Tag,
  AlertCircle,
  Search,
  User,
  Mic,
  MessageSquare
} from 'lucide-react';
import {
  DEFAULT_SCRIPTS,
  SCRIPT_1_MOCKUP,
  SCRIPT_2_VALIDACAO_PROPOSTA,
  SCRIPT_2_DIAGNOSTICO_GOOGLE,
  SCRIPT_3_COLD_CALL,
  SCRIPT_NUTRICIONISTA,
  SCRIPT_NUTRICIONISTA_MENSAGENS
} from '../utils/initialData';

interface ScriptsViewProps {
  niche: NicheCampaign;
  leads: Lead[];
  userName: string;
  targetLeadId?: string | null;
  onUpdateNicheScripts: (updatedScripts: Record<string, ScriptDefinition>) => void;
  onFastWhatsAppContacted: (lead: Lead) => void;
}

export const ScriptsView: React.FC<ScriptsViewProps> = ({
  niche,
  leads,
  userName,
  targetLeadId,
  onUpdateNicheScripts,
  onFastWhatsAppContacted,
}) => {
  const scriptKeys = Object.keys(niche.scripts);
  const [selectedScriptId, setSelectedScriptId] = useState<string>(() => {
    if (niche.scripts.script_mensagem) return 'script_mensagem';
    if (niche.scripts.script_ligacao) return 'script_ligacao';
    return scriptKeys[0] || 'script_mensagem';
  });

  // Custom simulator variables adapting automatically to the active niche
  const [simCompany, setSimCompany] = useState(() => {
    const seg = (niche.segment || niche.name).toLowerCase();
    if (seg.includes('estétic') || seg.includes('automot')) return 'M4 Estética Automotiva';
    if (seg.includes('dent') || seg.includes('odonto')) return 'Clínica Sorriso Dental';
    if (seg.includes('nutri')) return 'Consultório de Nutrição';
    return 'Clínica Exemplo';
  });
  const [simContact, setSimContact] = useState(() => {
    const seg = (niche.segment || niche.name).toLowerCase();
    if (seg.includes('estétic') || seg.includes('automot')) return 'Carlos';
    if (seg.includes('dent') || seg.includes('odonto')) return 'Dr. Felipe';
    if (seg.includes('nutri')) return 'Camila';
    return 'Dr. Roberto';
  });
  const [simCity, setSimCity] = useState(niche.city || 'Arapiraca - AL');
  const [simMockup, setSimMockup] = useState(() => {
    const seg = (niche.segment || niche.name).toLowerCase();
    if (seg.includes('estétic') || seg.includes('automot')) return 'https://previa-estetica.framer.website';
    if (seg.includes('dent') || seg.includes('odonto')) return 'https://previa-odonto.framer.website';
    if (seg.includes('nutri')) return 'https://previa-nutri.framer.website';
    return 'https://previa-digital.framer.website';
  });
  const [simPhone, setSimPhone] = useState('11999998888');
  const [simPosicao, setSimPosicao] = useState('6ª');
  const [simHorario1, setSimHorario1] = useState('quinta às 14h');
  const [simHorario2, setSimHorario2] = useState('sexta às 10h');
  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    targetLeadId || leads[0]?.id || 'custom'
  );
  const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const leadDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (targetLeadId) {
      setSelectedLeadId(targetLeadId);
    }
  }, [targetLeadId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (leadDropdownRef.current && !leadDropdownRef.current.contains(e.target as Node)) {
        setIsLeadDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSimulatorLeads = leads.filter((l) => {
    if (!leadSearchQuery.trim()) return true;
    const q = leadSearchQuery.toLowerCase();
    const matchContact = l.contactName?.toLowerCase().includes(q);
    const matchCompany = l.companyName.toLowerCase().includes(q);
    const matchPhone = l.phone.includes(q);
    const matchCity = l.city?.toLowerCase().includes(q);
    return Boolean(matchContact || matchCompany || matchPhone || matchCity);
  });

  // Currently focused step in the script
  const [activeStageId, setActiveStageId] = useState<string>('etapa-1');
  const [activeStepId, setActiveStepId] = useState<string>('etapa-1-msg-1');
  const [activeObjectionId, setActiveObjectionId] = useState<string | null>(null);

  // Active script
  const activeScript: ScriptDefinition =
    niche.scripts[selectedScriptId] ||
    niche.scripts.script_mensagem ||
    niche.scripts.script_ligacao ||
    DEFAULT_SCRIPTS.script_mensagem;

  // Set of open stage tab IDs
  const [openStageIds, setOpenStageIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const defaultScript =
      niche.scripts[selectedScriptId] ||
      niche.scripts.script_mensagem ||
      niche.scripts.script_ligacao ||
      DEFAULT_SCRIPTS.script_mensagem;
    (defaultScript.stages || []).forEach((st) => {
      initial[st.id] = true;
    });
    return initial;
  });

  // Objections section accordion and individual objection toggles
  const [isObjectionsSectionOpen, setIsObjectionsSectionOpen] = useState<boolean>(true);
  const [openObjectionIds, setOpenObjectionIds] = useState<Record<string, boolean>>({});

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // INLINE EDITING STATE FOR STEPS
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCondition, setEditCondition] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editTip, setEditTip] = useState('');

  // INLINE EDITING STATE FOR OBJECTIONS
  const [editingObjectionId, setEditingObjectionId] = useState<string | null>(null);
  const [editObjTitle, setEditObjTitle] = useState('');
  const [editObjResponse, setEditObjResponse] = useState('');

  // AI IMPROVEMENT STATE
  const [isImprovingWithAi, setIsImprovingWithAi] = useState(false);
  const [aiSuccessFeedback, setAiSuccessFeedback] = useState<string | null>(null);
  const [aiErrorFeedback, setAiErrorFeedback] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const currentLead = leads.find((l) => l.id === selectedLeadId);

  // Toggle a stage tab (click opens, click again closes)
  const handleToggleStage = (stageId: string) => {
    setOpenStageIds((prev) => ({
      ...prev,
      [stageId]: !prev[stageId],
    }));
  };

  const handleOpenAllStages = () => {
    const allOpen: Record<string, boolean> = {};
    (activeScript.stages || []).forEach((st) => {
      allOpen[st.id] = true;
    });
    setOpenStageIds(allOpen);
  };

  const handleCloseAllStages = () => {
    const allClosed: Record<string, boolean> = {};
    (activeScript.stages || []).forEach((st) => {
      allClosed[st.id] = false;
    });
    setOpenStageIds(allClosed);
  };

  // Toggle an objection tab
  const handleToggleObjection = (objId: string) => {
    setOpenObjectionIds((prev) => ({
      ...prev,
      [objId]: !(prev[objId] ?? true),
    }));
  };

  const handleOpenAllObjections = () => {
    const allOpen: Record<string, boolean> = {};
    (activeScript.objections || []).forEach((o) => {
      allOpen[o.id] = true;
    });
    setOpenObjectionIds(allOpen);
  };

  const handleCloseAllObjections = () => {
    const allClosed: Record<string, boolean> = {};
    (activeScript.objections || []).forEach((o) => {
      allClosed[o.id] = false;
    });
    setOpenObjectionIds(allClosed);
  };

  // Handle switching scripts
  const handleSelectScript = (sId: string) => {
    setSelectedScriptId(sId);
    setActiveObjectionId(null);
    setEditingStepId(null);
    setEditingObjectionId(null);

    const target = niche.scripts[sId];
    if (target?.stages?.[0]) {
      setActiveStageId(target.stages[0].id);
      if (target.stages[0].steps?.[0]) {
        setActiveStepId(target.stages[0].steps[0].id);
      }
    }
    const initialStages: Record<string, boolean> = {};
    (target?.stages || []).forEach((st) => {
      initialStages[st.id] = true;
    });
    setOpenStageIds(initialStages);
  };

  // Automatically switch script and simulator values when the active niche changes
  useEffect(() => {
    const keys = Object.keys(niche.scripts || {});
    if (keys.length > 0) {
      let targetId = keys[0];
      if (selectedScriptId && niche.scripts[selectedScriptId]) {
        targetId = selectedScriptId;
      } else if (niche.scripts.script_mensagem) {
        targetId = 'script_mensagem';
      }
      handleSelectScript(targetId);
    }
    if (niche.city) {
      setSimCity(niche.city);
    }
    const seg = (niche.segment || niche.name).toLowerCase();
    if (seg.includes('estétic') || seg.includes('automot')) {
      setSimContact('Carlos');
      setSimCompany('M4 Estética Automotiva');
      setSimMockup('https://previa-estetica.framer.website');
    } else if (seg.includes('dent') || seg.includes('odonto')) {
      setSimContact('Dr. Felipe');
      setSimCompany('Clínica Sorriso Dental');
      setSimMockup('https://previa-odonto.framer.website');
    } else if (seg.includes('nutri')) {
      setSimContact('Camila');
      setSimCompany('Consultório de Nutrição');
      setSimMockup('https://previa-nutri.framer.website');
    } else {
      setSimContact('Responsável');
      setSimCompany('Empresa Exemplo');
      setSimMockup('https://previa-digital.framer.website');
    }
  }, [niche.id]);

  // Variables resolution
  const isNutriActive =
    niche.name.toLowerCase().includes('nutri') ||
    niche.segment.toLowerCase().includes('nutri');

  const defaultContatoFallback = isNutriActive ? 'Camila' : 'Responsável';

  const vars = {
    empresa: currentLead ? currentLead.companyName : (simCompany || 'M4 Estética Automotiva'),
    contato: currentLead
      ? (currentLead.contactName?.trim() || defaultContatoFallback)
      : (simContact?.trim() || defaultContatoFallback),
    nicho: niche.segment,
    cidade: currentLead ? (currentLead.city || niche.city) : simCity,
    linkMockup: currentLead ? (currentLead.mockupUrl || simMockup) : simMockup,
    notaGoogle: currentLead ? currentLead.googleRating : 4.9,
    seuNome: userName,
    posicaoGoogle: simPosicao,
    horario1: simHorario1,
    categoria: currentLead?.category,
    horario2: simHorario2,
  };

  const targetPhone = currentLead ? currentLead.phone : simPhone;

  // Find active step object or active objection
  let currentActiveStep: ScriptSubStep | undefined;
  if (!activeObjectionId) {
    for (const st of activeScript.stages || []) {
      const found = st.steps.find((s) => s.id === activeStepId);
      if (found) {
        currentActiveStep = found;
        break;
      }
    }
    if (!currentActiveStep && activeScript.stages?.[0]?.steps?.[0]) {
      currentActiveStep = activeScript.stages[0].steps[0];
    }
  }

  const activeObjection = activeScript.objections?.find((o) => o.id === activeObjectionId);

  const currentRawMessage = activeObjection
    ? activeObjection.response
    : currentActiveStep
    ? currentActiveStep.message
    : activeScript.template;

  const previewMessage = interpolateScript(currentRawMessage, vars);

  const handleCopyText = (rawText: string, id: string) => {
    const interpolated = interpolateScript(rawText, vars);
    navigator.clipboard.writeText(interpolated);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getWhatsAppHref = (stepMessage?: string) => {
    const msgToSend = stepMessage ? interpolateScript(stepMessage, vars) : previewMessage;
    return buildWhatsAppLink(targetPhone, msgToSend);
  };

  const handleTrackWhatsAppSend = () => {
    if (currentLead) {
      onFastWhatsAppContacted(currentLead);
    }
  };

  // ==========================================
  // INLINE EDITING LOGIC FOR MESSAGE STEPS
  // ==========================================
  const handleStartEditStep = (stageId: string, step: ScriptSubStep) => {
    setEditingStageId(stageId);
    setEditingStepId(step.id);
    setEditTitle(step.title);
    setEditCondition(step.condition || '');
    setEditMessage(step.message);
    setEditTip(step.tip || '');
    setEditingObjectionId(null);
    setAiSuccessFeedback(null);
    setAiErrorFeedback(null);
  };

  const handleCancelEditStep = () => {
    setEditingStepId(null);
    setEditingStageId(null);
    setAiSuccessFeedback(null);
    setAiErrorFeedback(null);
  };

  const handleSaveStep = (stageId: string, stepId: string) => {
    const currentStages = activeScript.stages || [];
    const updatedStages = currentStages.map((st) => {
      if (st.id !== stageId) return st;
      return {
        ...st,
        steps: st.steps.map((sp) => {
          if (sp.id !== stepId) return sp;
          return {
            ...sp,
            title: editTitle.trim() || sp.title,
            condition: editCondition.trim() || undefined,
            message: editMessage.trim() || sp.message,
            tip: editTip.trim() || undefined,
          };
        }),
      };
    });

    const updatedScript: ScriptDefinition = {
      ...activeScript,
      stages: updatedStages,
    };

    onUpdateNicheScripts({
      ...niche.scripts,
      [selectedScriptId]: updatedScript,
    });

    setEditingStepId(null);
    setEditingStageId(null);
    setAiSuccessFeedback(null);
  };

  const handleAddStepToStage = (stageId: string) => {
    const currentStages = activeScript.stages || [];
    const newStepId = `step-custom-${Date.now()}`;
    const newStep: ScriptSubStep = {
      id: newStepId,
      title: 'Nova Mensagem / Passo',
      condition: 'Momento ideal de envio',
      message: 'Olá {contato}, tudo bem? Aqui é o {seuNome} da {nicho}.',
      tip: 'Seja natural, consulte e termine com pergunta curta.',
    };

    const updatedStages = currentStages.map((st) => {
      if (st.id !== stageId) return st;
      return {
        ...st,
        steps: [...st.steps, newStep],
      };
    });

    const updatedScript: ScriptDefinition = {
      ...activeScript,
      stages: updatedStages,
    };

    onUpdateNicheScripts({
      ...niche.scripts,
      [selectedScriptId]: updatedScript,
    });

    // Automatically open in edit mode
    handleStartEditStep(stageId, newStep);
  };

  const executeDeleteStep = (stageId: string, stepId: string) => {
    const currentStages = activeScript.stages || [];
    const updatedStages = currentStages.map((st) => {
      if (st.id !== stageId) return st;
      return {
        ...st,
        steps: st.steps.filter((sp) => sp.id !== stepId),
      };
    });

    const updatedScript: ScriptDefinition = {
      ...activeScript,
      stages: updatedStages,
    };

    onUpdateNicheScripts({
      ...niche.scripts,
      [selectedScriptId]: updatedScript,
    });

    if (editingStepId === stepId) {
      setEditingStepId(null);
      setEditingStageId(null);
    }
  };

  const handleDeleteStep = (stageId: string, stepId: string) => {
    setPendingConfirm({
      title: 'Excluir Mensagem do Roteiro',
      description: 'Tem certeza que deseja excluir esta mensagem do roteiro?',
      confirmLabel: 'Excluir Mensagem',
      onConfirm: () => executeDeleteStep(stageId, stepId),
    });
  };

  // ==========================================
  // INLINE EDITING LOGIC FOR OBJECTIONS
  // ==========================================
  const handleStartEditObjection = (obj: { id: string; title: string; response: string }) => {
    setEditingObjectionId(obj.id);
    setEditObjTitle(obj.title);
    setEditObjResponse(obj.response);
    setEditingStepId(null);
    setEditingStageId(null);
    setAiSuccessFeedback(null);
    setAiErrorFeedback(null);
  };

  const handleCancelEditObjection = () => {
    setEditingObjectionId(null);
    setAiSuccessFeedback(null);
    setAiErrorFeedback(null);
  };

  const handleSaveObjection = (objId: string) => {
    const currentObjs = activeScript.objections || [];
    const updatedObjs = currentObjs.map((o) => {
      if (o.id !== objId) return o;
      return {
        ...o,
        title: editObjTitle.trim() || o.title,
        response: editObjResponse.trim() || o.response,
      };
    });

    const updatedScript: ScriptDefinition = {
      ...activeScript,
      objections: updatedObjs,
    };

    onUpdateNicheScripts({
      ...niche.scripts,
      [selectedScriptId]: updatedScript,
    });

    setEditingObjectionId(null);
  };

  const handleAddObjection = () => {
    const currentObjs = activeScript.objections || [];
    const newId = `obj-custom-${Date.now()}`;
    const newObj: ScriptObjection = {
      id: newId,
      trigger: 'Quando o cliente apresentar esta dúvida ou barreira',
      title: 'Nova Objeção Comum',
      response: 'Entendo perfeitamente, {contato}. Justamente por isso preparamos...',
    };

    const updatedScript: ScriptDefinition = {
      ...activeScript,
      objections: [...currentObjs, newObj],
    };

    onUpdateNicheScripts({
      ...niche.scripts,
      [selectedScriptId]: updatedScript,
    });

    handleStartEditObjection(newObj);
  };

  const executeDeleteObjection = (objId: string) => {
    const currentObjs = activeScript.objections || [];
    const updatedScript: ScriptDefinition = {
      ...activeScript,
      objections: currentObjs.filter((o) => o.id !== objId),
    };

    onUpdateNicheScripts({
      ...niche.scripts,
      [selectedScriptId]: updatedScript,
    });

    if (editingObjectionId === objId) {
      setEditingObjectionId(null);
    }
  };

  const handleDeleteObjection = (objId: string) => {
    setPendingConfirm({
      title: 'Excluir Objeção do Roteiro',
      description: 'Deseja excluir esta resposta de objeção do roteiro?',
      confirmLabel: 'Excluir Objeção',
      onConfirm: () => executeDeleteObjection(objId),
    });
  };

  // ==========================================
  // GEMINI AI SCRIPT OPTIMIZATION
  // ==========================================
  const handleImproveWithAi = async (isObjection: boolean, blockTitle: string) => {
    const messageToImprove = isObjection ? editObjResponse : editMessage;
    if (!messageToImprove.trim()) {
      setAiErrorFeedback('Escreva algum texto antes de pedir para a IA melhorar.');
      return;
    }

    setIsImprovingWithAi(true);
    setAiErrorFeedback(null);
    setAiSuccessFeedback(null);

    try {
      const token = await getActiveFirebaseIdToken();
      if (!token) {
        throw new Error('Sessão expirada. Faça login novamente para usar a IA.');
      }

      const res = await fetch('/api/gemini/improve-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentMessage: messageToImprove,
          nicheName: niche.name,
          blockTitle: blockTitle,
          instruction:
            'Tornar a mensagem mais persuasiva, natural e conversacional para WhatsApp, aumentando a taxa de resposta e mantendo todas as variáveis {empresa}, {contato}, etc.',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao processar melhoria');
      }

      const data = await res.json();
      if (data.improvedMessage) {
        if (isObjection) {
          setEditObjResponse(data.improvedMessage);
        } else {
          setEditMessage(data.improvedMessage);
        }
        setAiSuccessFeedback('✨ Mensagem otimizada com sucesso com foco em conversão!');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível conectar à IA no momento.';
      setAiErrorFeedback(msg);
    } finally {
      setIsImprovingWithAi(false);
    }
  };

  // Reset to original factory template
  const executeResetToDefault = () => {
    const defaultRef =
      selectedScriptId === 'script1'
        ? SCRIPT_1_MOCKUP
        : selectedScriptId === 'script2'
        ? SCRIPT_2_VALIDACAO_PROPOSTA
        : selectedScriptId === 'script_nutri'
        ? SCRIPT_NUTRICIONISTA
        : selectedScriptId === 'script_nutri_mensagens'
        ? SCRIPT_NUTRICIONISTA_MENSAGENS
        : SCRIPT_3_COLD_CALL;

    onUpdateNicheScripts({
      ...niche.scripts,
      [selectedScriptId]: { ...defaultRef },
    });

    setEditingStepId(null);
    setEditingObjectionId(null);
  };

  const handleResetToDefault = () => {
    setPendingConfirm({
      title: 'Restaurar Roteiro Original',
      description: `Deseja restaurar o roteiro "${activeScript.title}" para a versão original de fábrica? Suas edições personalizadas neste script serão substituídas pelas padrões.`,
      confirmLabel: 'Restaurar Padrão',
      onConfirm: executeResetToDefault,
    });
  };

  // Helper chips to insert variable tags
  const insertVariableTag = (tag: string, isObjection: boolean) => {
    if (isObjection) {
      setEditObjResponse((prev) => prev + tag);
    } else {
      setEditMessage((prev) => prev + tag);
    }
  };

  const goldenRule = activeScript.goldenRule || {
    order: 'Contato → confiança → permissão → mockup → opinião → interesse → proposta → preço',
    primaryGoal:
      'O primeiro objetivo NÃO é vender o site. É fazer a pessoa pensar: "Esse cara realmente olhou nossa clínica e fez alguma coisa específica para a gente."',
    insight:
      'Depois do mockup, a conversa passa a ser sobre o que você criou — e não simplesmente sobre alguém tentando vender um site.',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Header */}
      <div className="border-b border-[var(--kz-border-subtle)] pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="kz-page-title">Roteiros & Scripts de Abordagem</h2>
          <p className="kz-subtitle mt-1">
            Scripts customizáveis e validados. Você pode <strong>editar os blocos</strong> diretamente, adicionar mensagens e otimizar com IA.
          </p>
        </div>

        {/* Lead Switcher & Reset Button */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--kz-text-secondary)] hover:text-[var(--kz-text-primary)] bg-[var(--kz-bg-subtle)] hover:bg-[var(--kz-bg-hover)] border border-[var(--kz-border-default)] rounded-lg transition-colors cursor-pointer"
            title="Restaurar roteiro original de fábrica"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Roteiro Original</span>
          </button>

          {/* Searchable Lead Selector with Real-time Person Name Search */}
          <div className="relative" ref={leadDropdownRef}>
            <div className="flex items-center gap-1.5 bg-[var(--kz-bg-surface)] p-1 rounded-lg border border-[var(--kz-border-default)] shadow-[var(--kz-shadow-xs)]">
              <span className="text-xs font-semibold text-[var(--kz-text-secondary)] pl-2 shrink-0">
                Simular com Lead:
              </span>

              <button
                type="button"
                onClick={() => setIsLeadDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 px-2.5 py-1 text-xs font-medium text-[var(--kz-text-primary)] bg-[var(--kz-bg-subtle)] hover:bg-[var(--kz-bg-hover)] rounded-md border border-[var(--kz-border-subtle)] transition-colors cursor-pointer max-w-[240px]"
                title="Clique para pesquisar pelo nome da pessoa ou clínica"
              >
                {currentLead ? (
                  <span className="truncate flex items-center gap-1.5 text-left">
                    <User className="w-3.5 h-3.5 text-[var(--kz-accent)] shrink-0" />
                    <span className="font-bold text-[var(--kz-text-primary)] truncate">
                      {currentLead.contactName || currentLead.companyName}
                    </span>
                    {currentLead.contactName && (
                      <span className="text-[var(--kz-text-muted)] font-normal truncate hidden sm:inline">
                        ({currentLead.companyName})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-[var(--kz-accent-text)] font-medium flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[var(--kz-accent)] shrink-0" />
                    <span>-- Simulação Livre --</span>
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-[var(--kz-text-subtle)] shrink-0 ml-auto" />
              </button>

              {currentLead && (
                <button
                  type="button"
                  onClick={() => setSelectedLeadId('custom')}
                  className="px-2 py-1 text-[11px] font-semibold text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)] hover:bg-[var(--kz-bg-hover)] rounded transition-colors cursor-pointer"
                  title="Voltar para simulação livre"
                >
                  ✕ Livre
                </button>
              )}
            </div>

            {/* Dropdown Popover with Search Bar */}
            {isLeadDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-80 sm:w-96 bg-[var(--kz-bg-surface)] rounded-xl shadow-[var(--kz-shadow-lg)] border border-[var(--kz-border-default)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                {/* Search Bar at the Top */}
                <div className="p-2.5 border-b border-[var(--kz-border-subtle)] bg-[var(--kz-bg-subtle)]">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[var(--kz-text-subtle)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={leadSearchQuery}
                      onChange={(e) => setLeadSearchQuery(e.target.value)}
                      placeholder="Pesquisar pelo nome da pessoa ou clínica..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent-border)] focus:border-[var(--kz-accent)] text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)]"
                    />
                    {leadSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setLeadSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--kz-text-subtle)] hover:text-[var(--kz-text-primary)] p-0.5 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[var(--kz-text-subtle)] font-mono mt-1.5 px-0.5">
                    <span>Busca por nome, clínica ou telefone</span>
                    <span>{filteredSimulatorLeads.length} leads</span>
                  </div>
                </div>

                {/* Option: Simulação Livre */}
                <div className="p-1 border-b border-[var(--kz-border-subtle)] bg-[var(--kz-accent-soft)]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLeadId('custom');
                      setIsLeadDropdownOpen(false);
                      setLeadSearchQuery('');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      selectedLeadId === 'custom'
                        ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)] font-bold'
                        : 'text-[var(--kz-accent-text)] hover:bg-[var(--kz-bg-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className={`w-3.5 h-3.5 ${selectedLeadId === 'custom' ? 'text-[var(--kz-accent-fg)]' : 'text-[var(--kz-accent)]'}`} />
                      <span>-- Simulação Livre (Manual) --</span>
                    </div>
                    {selectedLeadId === 'custom' && <Check className="w-4 h-4 text-[var(--kz-accent-fg)] shrink-0" />}
                  </button>
                </div>

                {/* Filtered Leads List */}
                <div className="max-h-64 overflow-y-auto p-1 divide-y divide-[var(--kz-border-subtle)]">
                  {filteredSimulatorLeads.length === 0 ? (
                    <div className="p-5 text-center text-xs text-[var(--kz-text-muted)]">
                      Nenhum lead encontrado com <strong className="text-[var(--kz-text-primary)]">"{leadSearchQuery}"</strong>.
                    </div>
                  ) : (
                    filteredSimulatorLeads.map((lead) => {
                      const isSelected = selectedLeadId === lead.id;
                      return (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => {
                            setSelectedLeadId(lead.id);
                            setIsLeadDropdownOpen(false);
                            setLeadSearchQuery('');
                          }}
                          className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] font-medium'
                              : 'hover:bg-[var(--kz-bg-hover)] text-[var(--kz-text-secondary)]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {lead.contactName ? (
                                <>
                                  <span className="font-bold text-[var(--kz-text-primary)]">
                                    {lead.contactName}
                                  </span>
                                  <span className="text-[var(--kz-text-subtle)] text-[11px]">·</span>
                                  <span className="text-[var(--kz-text-muted)] text-[11px] truncate">
                                    {lead.companyName}
                                  </span>
                                </>
                              ) : (
                                <span className="font-bold text-[var(--kz-text-primary)] truncate">
                                  {lead.companyName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--kz-text-muted)] font-mono">
                              <span>{lead.phone}</span>
                              {lead.city && <span>· {lead.city}</span>}
                            </div>
                          </div>

                          {isSelected && (
                            <Check className="w-4 h-4 text-[var(--kz-accent)] shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Lead Info Banner (when simulating with real lead) */}
      {currentLead && (
        <div className="p-3 bg-[var(--kz-success-bg)] border border-[var(--kz-success-border)] rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-[var(--kz-success-text)] shrink-0" />
            <span className="text-[var(--kz-text-primary)]">
              Simulando com dados reais de: <strong>{currentLead.contactName || currentLead.companyName}</strong> {currentLead.contactName ? `(${currentLead.companyName})` : ''}
            </span>
            {currentLead.phone && (
              <span className="text-[var(--kz-success-text)] font-mono text-[11px] bg-[var(--kz-bg-surface)] border border-[var(--kz-success-border)] px-1.5 py-0.5 rounded">
                WhatsApp: {currentLead.phone}
              </span>
            )}
            {currentLead.city && (
              <span className="text-[var(--kz-text-secondary)] text-[11px]">
                · {currentLead.city}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSelectedLeadId('custom')}
            className="text-xs text-[var(--kz-success-text)] hover:text-[var(--kz-text-primary)] font-semibold underline cursor-pointer"
          >
            Voltar para Simulação Livre
          </button>
        </div>
      )}

      {/* Simulator Inputs (when Custom is selected) */}
      {selectedLeadId === 'custom' && (
        <div className="p-3.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] rounded-xl space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[var(--kz-accent-text)] font-semibold flex-wrap gap-2">
            <span>Variáveis de Teste para o Roteiro:</span>
            <span className="text-[var(--kz-text-muted)] font-normal">
              Substitui automaticamente as tags &#123;empresa&#125;, &#123;contato&#125;, etc.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            <input
              type="text"
              value={simCompany}
              onChange={(e) => setSimCompany(e.target.value)}
              placeholder="Empresa"
              className="text-xs px-2.5 py-1.5 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--kz-accent)] focus:border-[var(--kz-accent)]"
              title="Nome da Empresa {empresa}"
            />
            <input
              type="text"
              value={simContact}
              onChange={(e) => setSimContact(e.target.value)}
              placeholder="Contato"
              className="text-xs px-2.5 py-1.5 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--kz-accent)] focus:border-[var(--kz-accent)]"
              title="Nome do Contato {contato}"
            />
            <input
              type="text"
              value={simCity}
              onChange={(e) => setSimCity(e.target.value)}
              placeholder="Cidade"
              className="text-xs px-2.5 py-1.5 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--kz-accent)] focus:border-[var(--kz-accent)]"
              title="Cidade {cidade}"
            />
            <input
              type="text"
              value={simPhone}
              onChange={(e) => setSimPhone(e.target.value)}
              placeholder="Telefone"
              className="text-xs px-2.5 py-1.5 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--kz-accent)] focus:border-[var(--kz-accent)]"
              title="Telefone WhatsApp"
            />
            <input
              type="text"
              value={simMockup}
              onChange={(e) => setSimMockup(e.target.value)}
              placeholder="Link do Mockup"
              className="text-xs px-2.5 py-1.5 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--kz-accent)] focus:border-[var(--kz-accent)] sm:col-span-2"
              title="Link da Prévia do Site {linkMockup}"
            />
          </div>
        </div>
      )}

      {/* Script Tab Switcher: Exatamente os 2 Scripts Oficiais */}
      <div className="flex items-center gap-2 p-1.5 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-subtle)] rounded-2xl flex-wrap">
        {scriptKeys.map((sId) => {
          const s = niche.scripts[sId];
          const isSelected = selectedScriptId === sId;
          const isLigacao = sId === 'script_ligacao' || s?.title?.toLowerCase().includes('ligação') || s?.category?.toLowerCase().includes('ligação');
          
          return (
            <button
              key={sId}
              type="button"
              onClick={() => handleSelectScript(sId)}
              className={`flex-1 min-w-[240px] py-3 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2.5 ${
                isSelected
                  ? isLigacao
                    ? 'bg-[var(--kz-bg-surface)] text-[var(--kz-text-primary)] shadow-[var(--kz-shadow-xs)] border border-[var(--kz-accent-border)] ring-1 ring-[var(--kz-accent-border)]'
                    : 'bg-[var(--kz-bg-surface)] text-[var(--kz-text-primary)] shadow-[var(--kz-shadow-xs)] border border-[var(--kz-success-border)] ring-1 ring-[var(--kz-success-border)]'
                  : 'text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)] hover:bg-[var(--kz-bg-hover)]'
              }`}
            >
              {isLigacao ? (
                <PhoneCall className={`w-4 h-4 ${isSelected ? 'text-[var(--kz-accent)]' : 'text-[var(--kz-text-subtle)]'}`} />
              ) : (
                <MessageCircle className={`w-4 h-4 ${isSelected ? 'text-[var(--kz-success-text)]' : 'text-[var(--kz-text-subtle)]'}`} />
              )}
              <span className="truncate">{s?.title || (isLigacao ? 'Script de Ligação' : 'Script de Mensagem')}</span>
              <span
                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                  isSelected
                    ? isLigacao
                      ? 'bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] border border-[var(--kz-accent-border)]'
                      : 'bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)]'
                    : 'bg-[var(--kz-bg-surface)] text-[var(--kz-text-subtle)] border border-[var(--kz-border-subtle)]'
                }`}
              >
                {s?.stages?.length || 6} passos
              </span>
            </button>
          );
        })}
      </div>

      {/* GOLDEN RULE / OBJETIVO DO SCRIPT BANNER */}
      <div className="bg-[var(--kz-bg-surface)] border border-[var(--kz-accent-border)] text-[var(--kz-text-primary)] rounded-2xl p-5 shadow-[var(--kz-shadow-xs)] space-y-3">
        <div className="flex items-center gap-2 text-[var(--kz-accent-text)] font-bold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-[var(--kz-accent)]" />
          <span>FLUXO ESTRATÉGICO DO SCRIPT</span>
        </div>

        {/* Dynamic Order Chain */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[var(--kz-text-secondary)]">
          {goldenRule.order.split('→').map((step, idx) => (
            <React.Fragment key={idx}>
              <span className="px-2.5 py-1 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-subtle)] rounded-md text-[var(--kz-text-primary)]">
                {step.trim()}
              </span>
              {idx < goldenRule.order.split('→').length - 1 && (
                <span className="text-[var(--kz-accent)]">→</span>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs text-[var(--kz-text-secondary)] border-t border-[var(--kz-border-subtle)]">
          <p className="leading-relaxed">
            <strong className="text-[var(--kz-text-primary)]">Objetivo da Abordagem:</strong> {goldenRule.primaryGoal}
          </p>
          <p className="leading-relaxed">
            <strong className="text-[var(--kz-text-primary)]">Estratégia de Conversão:</strong> {goldenRule.insight}
          </p>
        </div>
      </div>

      {/* Main Studio: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Detailed Steps & Objections with Inline Editing */}
        <div className="lg:col-span-7 space-y-5">
          {/* Header Controls for Stages: Open/Close all */}
          <div className="flex items-center justify-between bg-[var(--kz-bg-surface)] p-3.5 rounded-xl border border-[var(--kz-border-subtle)] shadow-[var(--kz-shadow-xs)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] text-[var(--kz-accent)] flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kz-text-primary)]">
                  Etapas & Mensagens do Script
                </h3>
                <span className="text-[11px] text-[var(--kz-text-muted)] font-medium">
                  {(activeScript.stages || []).filter((s) => !!openStageIds[s.id]).length} de {(activeScript.stages || []).length} etapas abertas
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenAllStages}
                className="px-3 py-1.5 text-xs font-bold text-[var(--kz-accent-text)] bg-[var(--kz-accent-soft)] hover:bg-[var(--kz-bg-hover)] border border-[var(--kz-accent-border)] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
                title="Abrir todas as etapas"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Abrir Todas</span>
              </button>
              <button
                type="button"
                onClick={handleCloseAllStages}
                className="px-3 py-1.5 text-xs font-bold text-[var(--kz-text-secondary)] bg-[var(--kz-bg-subtle)] hover:bg-[var(--kz-bg-hover)] border border-[var(--kz-border-default)] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
                title="Fechar todas as etapas"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Fechar Todas</span>
              </button>
            </div>
          </div>

          {/* Sequential Stages */}
          {(activeScript.stages || []).map((stage, sIdx) => {
            const isStageOpen = !!openStageIds[stage.id];

            return (
              <div
                key={stage.id}
                className={`bg-[var(--kz-bg-surface)] rounded-xl border transition-all overflow-hidden ${
                  isStageOpen
                    ? 'border-[var(--kz-accent-border)] shadow-[var(--kz-shadow-xs)]'
                    : 'border-[var(--kz-border-subtle)] hover:border-[var(--kz-border-default)]'
                }`}
              >
                {/* Stage Header */}
                <div
                  onClick={() => {
                    handleToggleStage(stage.id);
                    if (!isStageOpen) {
                      setActiveStageId(stage.id);
                      if (stage.steps?.[0]) {
                        setActiveStepId(stage.steps[0].id);
                        setActiveObjectionId(null);
                      }
                    }
                  }}
                  className={`p-4 flex items-center justify-between cursor-pointer border-b transition-colors select-none ${
                    isStageOpen
                      ? 'bg-[var(--kz-bg-subtle)] border-[var(--kz-border-subtle)] text-[var(--kz-text-primary)]'
                      : 'bg-[var(--kz-bg-surface)] border-transparent hover:bg-[var(--kz-bg-hover)] text-[var(--kz-text-secondary)]'
                  }`}
                  title={isStageOpen ? 'Clique para fechar esta etapa' : 'Clique para abrir esta etapa'}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center font-mono transition-colors ${
                        isStageOpen
                          ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)]'
                          : 'bg-[var(--kz-bg-subtle)] text-[var(--kz-text-muted)] border border-[var(--kz-border-default)]'
                      }`}
                    >
                      {sIdx + 1}
                    </span>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kz-text-primary)]">
                        {stage.stageTitle}
                      </h3>
                      {stage.description && (
                        <p className="text-[11px] text-[var(--kz-text-muted)] font-normal">
                          {stage.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-[var(--kz-text-muted)] bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-subtle)] px-2 py-0.5 rounded-md">
                      {stage.steps.length} {stage.steps.length === 1 ? 'bloco' : 'blocos'}
                    </span>
                    <span className={`p-1 rounded-md transition-colors ${isStageOpen ? 'text-[var(--kz-accent)]' : 'text-[var(--kz-text-subtle)]'}`}>
                      {isStageOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </div>
                </div>

                {/* Sub-steps in this stage */}
                {isStageOpen && (
                  <div className="p-4 space-y-4 divide-y divide-[var(--kz-border-subtle)]">
                    {stage.steps.map((step) => {
                      const isStepActive = !activeObjectionId && activeStepId === step.id;
                      const isEditingThisStep = editingStepId === step.id;
                      const interpolatedStepMsg = interpolateScript(step.message, vars);

                      // ==========================================
                      // MODE A: INLINE EDITING FORM FOR THIS BLOCK
                      // ==========================================
                      if (isEditingThisStep) {
                        return (
                          <div
                            key={step.id}
                            className="pt-4 first:pt-0 p-4 bg-[var(--kz-bg-subtle)] border-2 border-[var(--kz-accent)] rounded-xl space-y-3 animate-in fade-in duration-150"
                          >
                            <div className="flex items-center justify-between border-b border-[var(--kz-border-default)] pb-2">
                              <span className="text-xs font-bold text-[var(--kz-accent-text)] flex items-center gap-1.5">
                                <Edit3 className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                                <span>Editando Bloco da Etapa</span>
                              </span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleImproveWithAi(false, editTitle)}
                                  disabled={isImprovingWithAi}
                                  className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-[var(--kz-accent-text)] bg-[var(--kz-accent-soft)] hover:bg-[var(--kz-bg-hover)] border border-[var(--kz-accent-border)] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                  title="Melhorar mensagem automaticamente com IA"
                                >
                                  <Sparkles className="w-3 h-3 text-[var(--kz-accent)]" />
                                  <span>{isImprovingWithAi ? 'Melhorando...' : 'Melhorar com IA'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteStep(stage.id, step.id)}
                                  className="text-xs text-[var(--kz-danger-text)] hover:text-[var(--kz-text-primary)] p-1 hover:bg-[var(--kz-danger-bg)] rounded-lg transition-colors cursor-pointer"
                                  title="Excluir este bloco"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Feedback messages */}
                            {aiSuccessFeedback && (
                              <div className="p-2.5 bg-[var(--kz-success-bg)] border border-[var(--kz-success-border)] rounded-lg text-xs text-[var(--kz-success-text)] flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-[var(--kz-success-text)] shrink-0" />
                                <span>{aiSuccessFeedback}</span>
                              </div>
                            )}

                            {aiErrorFeedback && (
                              <div className="p-2.5 bg-[var(--kz-danger-bg)] border border-[var(--kz-danger-border)] rounded-lg text-xs text-[var(--kz-danger-text)] flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-[var(--kz-danger-text)] shrink-0" />
                                <span>{aiErrorFeedback}</span>
                              </div>
                            )}

                            {/* Title & Trigger inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">
                                  Título do Bloco / Passo
                                </label>
                                <input
                                  type="text"
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  placeholder="Ex: 1. Mensagem de Abertura"
                                  className="w-full text-xs px-2.5 py-1.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] rounded-lg text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent-border)] focus:border-[var(--kz-accent)] font-medium"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">
                                  Momento de Envio / Gatilho
                                </label>
                                <input
                                  type="text"
                                  value={editCondition}
                                  onChange={(e) => setEditCondition(e.target.value)}
                                  placeholder="Ex: Enviar às 10h da manhã"
                                  className="w-full text-xs px-2.5 py-1.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] rounded-lg text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent-border)] focus:border-[var(--kz-accent)]"
                                />
                              </div>
                            </div>

                            {/* Script Message Textarea */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-semibold text-[var(--kz-text-secondary)]">
                                  Texto do Script (Mensagem enviada no WhatsApp):
                                </label>
                                <span className="text-[10px] text-[var(--kz-text-muted)]">
                                  Clique nas tags abaixo para inserir no texto:
                                </span>
                              </div>

                              {/* Variable insertion tag chips */}
                              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                {[
                                  { label: '+ {empresa}', tag: '{empresa}' },
                                  { label: '+ {nicho}', tag: '{nicho}' },
                                  { label: '+ {servicosNicho}', tag: '{servicosNicho}' },
                                  { label: '+ {contato}', tag: '{contato}' },
                                  { label: '+ {cidade}', tag: '{cidade}' },
                                  { label: '+ {seuNome}', tag: '{seuNome}' },
                                  { label: '+ {linkMockup}', tag: '{linkMockup}' },
                                  { label: '+ {notaGoogle}', tag: '{notaGoogle}' },
                                ].map((item) => (
                                  <button
                                    key={item.tag}
                                    type="button"
                                    onClick={() => insertVariableTag(` ${item.tag} `, false)}
                                    className="px-2 py-0.5 text-[10px] font-mono bg-[var(--kz-bg-surface)] hover:bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] border border-[var(--kz-accent-border)] rounded-md transition-colors cursor-pointer"
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>

                              <textarea
                                rows={6}
                                value={editMessage}
                                onChange={(e) => setEditMessage(e.target.value)}
                                placeholder="Digite a mensagem do roteiro..."
                                className="w-full text-xs p-3 bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] rounded-lg font-sans text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent-border)] focus:border-[var(--kz-accent)] leading-relaxed"
                              />
                            </div>

                            {/* Tip / Strategic Advice */}
                            <div>
                              <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">
                                Dica Estratégica (Visível como lembrete para você):
                              </label>
                              <input
                                type="text"
                                value={editTip}
                                onChange={(e) => setEditTip(e.target.value)}
                                placeholder="Ex: Nunca mande áudio no primeiro contato."
                                className="w-full text-xs px-2.5 py-1.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] rounded-lg text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent-border)] focus:border-[var(--kz-accent)]"
                              />
                            </div>

                            {/* Action Buttons: Save & Cancel */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--kz-border-default)]">
                              <button
                                type="button"
                                onClick={handleCancelEditStep}
                                className="px-3 py-1.5 text-xs font-semibold text-[var(--kz-text-secondary)] hover:text-[var(--kz-text-primary)] bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] rounded-lg transition-colors cursor-pointer"
                              >
                                Cancelar
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSaveStep(stage.id, step.id)}
                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-[var(--kz-accent-fg)] bg-[var(--kz-accent)] hover:bg-[var(--kz-accent-hover)] active:bg-[var(--kz-accent-active)] rounded-lg transition-colors cursor-pointer shadow-[var(--kz-shadow-xs)]"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Salvar Alterações</span>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // ==========================================
                      // MODE B: VIEW BLOCK MODE (WITH EDIT BUTTON)
                      // ==========================================
                      return (
                        <div
                          key={step.id}
                          className={`pt-3.5 first:pt-0 rounded-xl transition-all ${
                            isStepActive ? 'p-3 bg-[var(--kz-accent-soft)] ring-1 ring-[var(--kz-accent-border)]' : ''
                          }`}
                        >
                          {/* Title, Condition & Buttons */}
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveStepId(step.id);
                                  setActiveObjectionId(null);
                                }}
                                className="text-xs font-bold text-[var(--kz-text-primary)] hover:text-[var(--kz-accent-text)] text-left transition-colors flex items-center gap-1.5 cursor-pointer flex-wrap"
                              >
                                {isStepActive && (
                                  <span className="w-2 h-2 rounded-full bg-[var(--kz-accent)] shrink-0" />
                                )}
                                <span>{step.title}</span>

                                {step.format === 'audio' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)] border border-[var(--kz-warning-border)] shrink-0">
                                    <Mic className="w-2.5 h-2.5 text-[var(--kz-warning-text)]" />
                                    Áudio
                                  </span>
                                )}
                                {step.format === 'texto' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)] shrink-0">
                                    <MessageSquare className="w-2.5 h-2.5 text-[var(--kz-success-text)]" />
                                    Texto
                                  </span>
                                )}
                              </button>

                              {step.condition && (
                                <span className="text-[10px] text-[var(--kz-text-muted)] italic block mt-0.5">
                                  Gatilho: {step.condition}
                                </span>
                              )}
                            </div>

                            {/* Buttons: Edit, Copy, WhatsApp */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditStep(stage.id, step)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[var(--kz-accent-text)] bg-[var(--kz-accent-soft)] hover:bg-[var(--kz-bg-hover)] border border-[var(--kz-accent-border)] rounded-lg transition-colors cursor-pointer"
                                title="Editar texto e detalhes deste bloco"
                              >
                                <Edit3 className="w-3 h-3 text-[var(--kz-accent)]" />
                                <span>Editar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyText(step.message, step.id)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[var(--kz-text-secondary)] bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] hover:bg-[var(--kz-bg-hover)] hover:text-[var(--kz-text-primary)] rounded-lg transition-colors cursor-pointer"
                                title="Copiar texto pronto"
                              >
                                {copiedId === step.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-[var(--kz-success-text)]" />
                                    <span className="text-[var(--kz-success-text)] font-semibold">Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-[var(--kz-text-subtle)]" />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>

                              {selectedScriptId === 'script_ligacao' && targetPhone && (
                                <a
                                  href={`tel:${targetPhone.replace(/\D/g, '')}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[var(--kz-accent-fg)] bg-[var(--kz-accent)] hover:bg-[var(--kz-accent-hover)] rounded-lg transition-colors cursor-pointer shadow-[var(--kz-shadow-xs)]"
                                  title="Discar / Ligar agora para este lead"
                                >
                                  <PhoneCall className="w-3 h-3" />
                                  <span>Ligar</span>
                                </a>
                              )}

                              <a
                                href={getWhatsAppHref(step.message)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => {
                                  setActiveStepId(step.id);
                                  setActiveObjectionId(null);
                                  handleTrackWhatsAppSend();
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[var(--kz-success-solid)] hover:brightness-110 rounded-lg transition-all cursor-pointer shadow-[var(--kz-shadow-xs)]"
                                title="Disparar no WhatsApp"
                              >
                                <MessageCircle className="w-3 h-3 fill-white/20" />
                                <span>WhatsApp</span>
                              </a>
                            </div>
                          </div>

                          {/* Message Box */}
                          <div
                            onClick={() => {
                              setActiveStepId(step.id);
                              setActiveObjectionId(null);
                            }}
                            className="p-3 bg-[var(--kz-bg-subtle)] rounded-lg border border-[var(--kz-border-subtle)] text-xs text-[var(--kz-text-primary)] font-sans whitespace-pre-wrap leading-relaxed cursor-pointer hover:border-[var(--kz-border-default)] transition-colors"
                            title="Clique para carregar no simulador ao lado"
                          >
                            {interpolatedStepMsg}
                          </div>

                          {/* Tip / Strategic context */}
                          {step.tip && (
                            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--kz-text-muted)]">
                              <Info className="w-3 h-3 text-[var(--kz-accent)] shrink-0" />
                              <span>{step.tip}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Button to Add a New Step in this Stage */}
                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={() => handleAddStepToStage(stage.id)}
                        className="w-full py-2 px-3 border border-dashed border-[var(--kz-border-default)] hover:border-[var(--kz-accent)] hover:bg-[var(--kz-accent-soft)] rounded-lg text-xs font-semibold text-[var(--kz-text-muted)] hover:text-[var(--kz-accent-text)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar Nova Mensagem nesta Etapa</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* QUEBRA DE OBJEÇÕES SECTION (WITH INLINE EDITING) */}
          {activeScript.objections && activeScript.objections.length > 0 && (
            <div className="bg-[var(--kz-bg-surface)] rounded-xl border border-[var(--kz-warning-border)] p-5 shadow-[var(--kz-shadow-xs)] space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--kz-border-subtle)] pb-3">
                <div
                  onClick={() => setIsObjectionsSectionOpen(!isObjectionsSectionOpen)}
                  className="flex items-center gap-2 cursor-pointer select-none"
                  title={isObjectionsSectionOpen ? 'Clique para recolher' : 'Clique para expandir'}
                >
                  <ShieldAlert className="w-4 h-4 text-[var(--kz-warning-text)]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--kz-text-primary)]">
                    Respostas para Objeções ({activeScript.objections.length})
                  </h3>
                  {isObjectionsSectionOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[var(--kz-warning-text)]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--kz-text-subtle)]" />
                  )}
                </div>

                {isObjectionsSectionOpen && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleAddObjection}
                      className="px-2.5 py-1 text-[11px] font-bold text-[var(--kz-warning-text)] bg-[var(--kz-warning-bg)] hover:bg-[var(--kz-bg-hover)] border border-[var(--kz-warning-border)] rounded-md transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Nova Objeção</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenAllObjections}
                      className="px-2.5 py-1 text-[11px] font-semibold text-[var(--kz-text-secondary)] bg-[var(--kz-bg-subtle)] hover:bg-[var(--kz-bg-hover)] border border-[var(--kz-border-default)] rounded-md transition-colors cursor-pointer"
                    >
                      Abrir Todas
                    </button>
                  </div>
                )}
              </div>

              {isObjectionsSectionOpen && (
                <div className="space-y-3">
                  {activeScript.objections.map((obj) => {
                    const isObjActive = activeObjectionId === obj.id;
                    const isEditingThisObj = editingObjectionId === obj.id;
                    const isObjOpen = openObjectionIds[obj.id] ?? true;
                    const interpolatedResponse = interpolateScript(obj.response, vars);

                    // ==========================================
                    // EDITING OBJECTION BLOCK
                    // ==========================================
                    if (isEditingThisObj) {
                      return (
                        <div
                          key={obj.id}
                          className="p-4 bg-[var(--kz-bg-subtle)] border-2 border-[var(--kz-warning-text)] rounded-xl space-y-3 animate-in fade-in duration-150"
                        >
                          <div className="flex items-center justify-between border-b border-[var(--kz-border-default)] pb-2">
                            <span className="text-xs font-bold text-[var(--kz-warning-text)] flex items-center gap-1.5">
                              <Edit3 className="w-3.5 h-3.5 text-[var(--kz-warning-text)]" />
                              <span>Editando Resposta de Objeção</span>
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleImproveWithAi(true, editObjTitle)}
                                disabled={isImprovingWithAi}
                                className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-[var(--kz-accent-text)] bg-[var(--kz-accent-soft)] hover:bg-[var(--kz-bg-hover)] border border-[var(--kz-accent-border)] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Sparkles className="w-3 h-3 text-[var(--kz-accent)]" />
                                <span>{isImprovingWithAi ? 'Melhorando...' : 'Melhorar com IA'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteObjection(obj.id)}
                                className="text-xs text-[var(--kz-danger-text)] hover:text-[var(--kz-text-primary)] p-1 hover:bg-[var(--kz-danger-bg)] rounded-lg transition-colors cursor-pointer"
                                title="Excluir objeção"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Title input */}
                          <div>
                            <label className="block text-[11px] font-semibold text-[var(--kz-text-secondary)] mb-1">
                              Título da Objeção do Cliente
                            </label>
                            <input
                              type="text"
                              value={editObjTitle}
                              onChange={(e) => setEditObjTitle(e.target.value)}
                              placeholder="Ex: 'Já temos alguém que cuida do site'"
                              className="w-full text-xs px-2.5 py-1.5 bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] rounded-lg text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--kz-warning-border)] focus:border-[var(--kz-warning-text)] font-medium"
                            />
                          </div>

                          {/* Response textarea */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-semibold text-[var(--kz-text-secondary)]">
                                Sua Resposta / Quebra de Objeção:
                              </label>
                              <div className="flex items-center gap-1">
                                {[
                                  { label: '+ {contato}', tag: '{contato}' },
                                  { label: '+ {empresa}', tag: '{empresa}' },
                                ].map((item) => (
                                  <button
                                    key={item.tag}
                                    type="button"
                                    onClick={() => insertVariableTag(` ${item.tag} `, true)}
                                    className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--kz-bg-surface)] hover:bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)] border border-[var(--kz-warning-border)] rounded transition-colors cursor-pointer"
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <textarea
                              rows={5}
                              value={editObjResponse}
                              onChange={(e) => setEditObjResponse(e.target.value)}
                              className="w-full text-xs p-3 bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] rounded-lg font-sans text-[var(--kz-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--kz-warning-border)] focus:border-[var(--kz-warning-text)] leading-relaxed"
                            />
                          </div>

                          {/* Save & Cancel */}
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--kz-border-default)]">
                            <button
                              type="button"
                              onClick={handleCancelEditObjection}
                              className="px-3 py-1.5 text-xs font-semibold text-[var(--kz-text-secondary)] hover:text-[var(--kz-text-primary)] bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] rounded-lg transition-colors cursor-pointer"
                            >
                              Cancelar
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSaveObjection(obj.id)}
                              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-[#0B0B0D] bg-[var(--kz-warning-solid)] hover:brightness-110 rounded-lg transition-all cursor-pointer shadow-[var(--kz-shadow-xs)]"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Salvar Resposta</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // ==========================================
                    // VIEW OBJECTION BLOCK
                    // ==========================================
                    return (
                      <div
                        key={obj.id}
                        className={`rounded-xl border transition-all overflow-hidden ${
                          isObjActive
                            ? 'bg-[var(--kz-warning-bg)] border-[var(--kz-warning-border)] ring-1 ring-[var(--kz-warning-border)]'
                            : 'bg-[var(--kz-bg-subtle)] border-[var(--kz-border-subtle)] hover:border-[var(--kz-border-default)]'
                        }`}
                      >
                        <div
                          onClick={() => handleToggleObjection(obj.id)}
                          className="p-3.5 flex items-center justify-between gap-2 cursor-pointer select-none"
                          title={isObjOpen ? 'Clique para fechar' : 'Clique para abrir'}
                        >
                          <span className="text-xs font-bold text-[var(--kz-text-primary)] hover:text-[var(--kz-warning-text)] flex items-center gap-1.5">
                            {isObjOpen ? (
                              <ChevronUp className="w-3.5 h-3.5 text-[var(--kz-warning-text)]" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-[var(--kz-text-subtle)]" />
                            )}
                            <span>{obj.title}</span>
                          </span>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleStartEditObjection(obj)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[var(--kz-warning-text)] bg-[var(--kz-warning-bg)] hover:bg-[var(--kz-bg-hover)] border border-[var(--kz-warning-border)] rounded-lg transition-colors cursor-pointer"
                              title="Editar resposta desta objeção"
                            >
                              <Edit3 className="w-3 h-3 text-[var(--kz-warning-text)]" />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyText(obj.response, obj.id)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[var(--kz-text-secondary)] bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] hover:bg-[var(--kz-bg-hover)] hover:text-[var(--kz-text-primary)] rounded-lg transition-colors cursor-pointer"
                            >
                              {copiedId === obj.id ? (
                                <>
                                  <Check className="w-3 h-3 text-[var(--kz-success-text)]" />
                                  <span className="text-[var(--kz-success-text)] font-semibold">Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-[var(--kz-text-subtle)]" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>

                            <a
                              href={getWhatsAppHref(obj.response)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                setActiveObjectionId(obj.id);
                                handleTrackWhatsAppSend();
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[var(--kz-success-solid)] hover:brightness-110 rounded-lg transition-all cursor-pointer"
                            >
                              <MessageCircle className="w-3 h-3 fill-white/20" />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        </div>

                        {isObjOpen && (
                          <div
                            onClick={() => setActiveObjectionId(obj.id)}
                            className="p-3.5 pt-0 text-xs text-[var(--kz-text-primary)] whitespace-pre-wrap leading-relaxed cursor-pointer"
                            title="Clique para carregar no simulador"
                          >
                            <div className="p-3 bg-[var(--kz-bg-surface)] rounded-lg border border-[var(--kz-border-subtle)] font-sans">
                              {interpolatedResponse}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Live Chat Simulator & Quick Send */}
        <div className="lg:col-span-5 sticky top-20 space-y-4">
          <div className="bg-[var(--kz-bg-surface)] rounded-xl border border-[var(--kz-border-subtle)] p-5 shadow-[var(--kz-shadow-xs)] space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-[var(--kz-border-subtle)] pb-3">
              <div>
                <span className="text-xs font-bold text-[var(--kz-text-primary)] flex items-center gap-1.5">
                  {(selectedScriptId === 'script_ligacao' || selectedScriptId === 'script3') ? (
                    <>
                      <PhoneCall className="w-4 h-4 text-[var(--kz-accent)]" />
                      <span>Roteiro de Fala / Ligação Telefônica</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-4 h-4 text-[var(--kz-success-text)]" />
                      <span>Visualização no WhatsApp</span>
                    </>
                  )}
                </span>
                <span className="text-[11px] text-[var(--kz-text-muted)] line-clamp-1">
                  {activeObjection ? activeObjection.title : currentActiveStep?.title || 'Mensagem Selecionada'}
                </span>
              </div>

              {(selectedScriptId === 'script_ligacao' || selectedScriptId === 'script3') ? (
                <a
                  href={`tel:${targetPhone.replace(/\D/g, '')}`}
                  className="text-[10px] font-mono text-[var(--kz-accent-text)] bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] hover:bg-[var(--kz-bg-hover)] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 transition-colors"
                >
                  <PhoneCall className="w-3 h-3" />
                  <span>Discar</span>
                </a>
              ) : (
                <span className="text-[10px] font-mono text-[var(--kz-success-text)] bg-[var(--kz-success-bg)] border border-[var(--kz-success-border)] px-2 py-0.5 rounded-full font-bold">
                  wa.me pronto
                </span>
              )}
            </div>

            {/* Script Display Canvas */}
            {(selectedScriptId === 'script_ligacao' || selectedScriptId === 'script3') ? (
              <div className="bg-[var(--kz-bg-canvas)] text-[var(--kz-text-primary)] rounded-2xl border border-[var(--kz-border-default)] overflow-hidden shadow-[var(--kz-shadow-xs)]">
                {/* Cold Call Telephony Header */}
                <div className="bg-[var(--kz-bg-subtle)] px-3.5 py-2.5 flex items-center justify-between text-xs border-b border-[var(--kz-border-subtle)]">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-7 h-7 rounded-full bg-[var(--kz-accent)] flex items-center justify-center font-bold text-xs text-[var(--kz-accent-fg)]">
                      <PhoneCall className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-semibold truncate text-[var(--kz-text-primary)]">{vars.empresa}</div>
                      <div className="text-[10px] text-[var(--kz-text-muted)] font-mono truncate">
                        {formatDisplayPhone(targetPhone)}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-[var(--kz-success-text)] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--kz-success-text)]" />
                    <span>Em Chamada</span>
                  </div>
                </div>

                {/* Cold Call Speech Canvas */}
                <div className="p-4 sm:p-5 min-h-[200px] max-h-[360px] overflow-y-auto space-y-3">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--kz-accent-text)] flex items-center gap-1.5">
                    <span>O que você deve falar:</span>
                  </div>

                  <div className="bg-[var(--kz-bg-subtle)] rounded-xl p-3.5 border border-[var(--kz-border-default)] text-xs text-[var(--kz-text-primary)] leading-relaxed font-sans whitespace-pre-wrap selection:bg-[var(--kz-accent)] selection:text-[var(--kz-accent-fg)]">
                    {previewMessage}
                  </div>

                  <div className="text-[11px] text-[var(--kz-text-muted)] italic">
                    💡 Fale pausadamente, com segurança e sem tom mecânico.
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#0B141A] rounded-2xl border border-[var(--kz-border-default)] overflow-hidden shadow-[var(--kz-shadow-xs)]">
                {/* WhatsApp Mockup Header */}
                <div className="bg-[#202C33] text-[#E9EDEF] px-3.5 py-2.5 flex items-center justify-between text-xs border-b border-white/10">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-7 h-7 rounded-full bg-[#005C4B] flex items-center justify-center font-bold text-xs text-white">
                      {vars.empresa.slice(0, 1) || 'C'}
                    </div>
                    <div className="truncate">
                      <div className="font-semibold truncate text-[#E9EDEF]">{vars.empresa}</div>
                      <div className="text-[10px] text-[#8696A0] font-mono truncate">
                        {formatDisplayPhone(targetPhone)}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#34D399] font-mono shrink-0">Online</div>
                </div>

                {/* Chat Canvas with authentic dark WhatsApp balloon */}
                <div className="p-4 sm:p-5 min-h-[220px] max-h-[360px] overflow-y-auto space-y-3">
                  <div className="text-center">
                    <span className="text-[10px] bg-[#182229] text-[#8696A0] border border-white/5 px-2.5 py-0.5 rounded-md font-mono">
                      HOJE
                    </span>
                  </div>

                  {/* Format Indicator (Audio vs Text) */}
                  {currentActiveStep?.format === 'audio' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)] rounded-xl text-xs font-semibold border border-[var(--kz-warning-border)]">
                      <Mic className="w-3.5 h-3.5 text-[var(--kz-warning-text)] shrink-0" />
                      <span>Gravar como Áudio no WhatsApp (Tom natural e profissional)</span>
                    </div>
                  )}
                  {currentActiveStep?.format === 'texto' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] rounded-xl text-xs font-semibold border border-[var(--kz-success-border)]">
                      <MessageSquare className="w-3.5 h-3.5 text-[var(--kz-success-text)] shrink-0" />
                      <span>Enviar como Mensagem de Texto</span>
                    </div>
                  )}

                  {/* Sent Bubble */}
                  <div className="max-w-[92%] ml-auto bg-[#005C4B] rounded-2xl rounded-tr-xs p-3.5 shadow-sm border border-[#00745F] text-xs text-[#E9EDEF] leading-relaxed font-sans whitespace-pre-wrap">
                    {previewMessage}

                    {previewMessage.includes(vars.linkMockup) && (
                      <div className="mt-2.5 p-2 bg-black/25 rounded-lg border border-white/10 text-[11px] flex items-center justify-between">
                        <div className="truncate">
                          <div className="font-bold text-[#E9EDEF] truncate">Prévia do Site da Clínica</div>
                          <div className="text-[10px] text-[#8696A0] font-mono truncate">
                            {vars.linkMockup}
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-[#53BDEB] shrink-0 ml-1" />
                      </div>
                    )}

                    <div className="text-right text-[10px] text-[#8696A0] mt-1.5 font-mono flex items-center justify-end gap-1">
                      <span>14:32</span>
                      <span className="text-[#53BDEB] font-bold">✓✓</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyText(currentRawMessage, 'preview-box')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-[var(--kz-text-secondary)] bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] hover:bg-[var(--kz-bg-hover)] hover:text-[var(--kz-text-primary)] rounded-lg transition-colors cursor-pointer"
                >
                  {copiedId === 'preview-box' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[var(--kz-success-text)]" />
                      <span className="text-[var(--kz-success-text)] font-bold">Texto Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[var(--kz-text-muted)]" />
                      <span>Copiar Roteiro</span>
                    </>
                  )}
                </button>

                {(selectedScriptId === 'script_ligacao' || selectedScriptId === 'script3') && targetPhone && (
                  <a
                    href={`tel:${targetPhone.replace(/\D/g, '')}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-[var(--kz-accent-fg)] bg-[var(--kz-accent)] hover:bg-[var(--kz-accent-hover)] rounded-lg shadow-[var(--kz-shadow-xs)] transition-colors cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Ligar Agora</span>
                  </a>
                )}

                <a
                  href={getWhatsAppHref()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleTrackWhatsAppSend}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-white bg-[var(--kz-success-solid)] hover:brightness-110 rounded-lg shadow-[var(--kz-shadow-xs)] transition-all cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-white/20" />
                  <span>{(selectedScriptId === 'script_ligacao' || selectedScriptId === 'script3') ? 'Mandar no WhatsApp' : 'Abrir no WhatsApp'}</span>
                </a>
              </div>

              <div className="p-3 bg-[var(--kz-bg-subtle)] rounded-lg border border-[var(--kz-border-subtle)] text-[11px] text-[var(--kz-text-muted)] space-y-1">
                <div className="font-semibold text-[var(--kz-text-secondary)]">Variáveis Ativas no Preview:</div>
                <div className="grid grid-cols-2 gap-1 font-mono text-[10px] text-[var(--kz-text-muted)]">
                  <div>
                    &#123;empresa&#125;: <strong className="text-[var(--kz-text-primary)] font-sans">{vars.empresa}</strong>
                  </div>
                  <div>
                    &#123;cidade&#125;: <strong className="text-[var(--kz-text-primary)] font-sans">{vars.cidade}</strong>
                  </div>
                  <div>
                    &#123;seuNome&#125;: <strong className="text-[var(--kz-text-primary)] font-sans">{vars.seuNome}</strong>
                  </div>
                  <div>
                    &#123;contato&#125;: <strong className="text-[var(--kz-text-primary)] font-sans">{vars.contato}</strong>
                  </div>
                  {selectedScriptId === 'script3' && (
                    <>
                      <div>
                        [Xª Posição]: <strong className="text-[var(--kz-warning-text)] font-sans">{vars.posicaoGoogle}</strong>
                      </div>
                      <div>
                        [Horários]: <strong className="text-[var(--kz-accent-text)] font-sans">Opção 1 e 2</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingConfirm)}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => {
          pendingConfirm?.onConfirm();
          setPendingConfirm(null);
        }}
        title={pendingConfirm?.title || 'Confirmar ação'}
        description={pendingConfirm?.description || ''}
        confirmLabel={pendingConfirm?.confirmLabel || 'Confirmar'}
        variant="danger"
      />
    </div>
  );
};
