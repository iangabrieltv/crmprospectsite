import React, { useState, useRef, useEffect } from 'react';
import { NicheCampaign, Lead, ScriptDefinition, ScriptStageBlock, ScriptSubStep, ScriptObjection } from '../types/crm';
import {
  interpolateScript,
  buildWhatsAppLink,
  formatDisplayPhone
} from '../utils/phone';
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
  const isNutriInitial =
    niche.name.toLowerCase().includes('nutri') ||
    niche.segment.toLowerCase().includes('nutri');
  const [selectedScriptId, setSelectedScriptId] = useState<string>(() => {
    if (isNutriInitial && niche.scripts.script_nutri) return 'script_nutri';
    if (niche.scripts.script2) return 'script2';
    return scriptKeys[0] || 'script1';
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
    niche.scripts.script1 ||
    SCRIPT_1_MOCKUP;

  // Set of open stage tab IDs
  const [openStageIds, setOpenStageIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const defaultScript = niche.scripts[selectedScriptId] || niche.scripts.script1 || SCRIPT_1_MOCKUP;
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
      const isNutri =
        niche.name.toLowerCase().includes('nutri') ||
        niche.segment.toLowerCase().includes('nutri');

      let targetId = keys[0];
      if (isNutri && niche.scripts.script_nutri) {
        targetId = 'script_nutri';
      } else if (niche.scripts[selectedScriptId]) {
        targetId = selectedScriptId;
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

  const handleSendViaWhatsApp = (stepMessage?: string) => {
    const msgToSend = stepMessage ? interpolateScript(stepMessage, vars) : previewMessage;

    if (currentLead) {
      onFastWhatsAppContacted(currentLead);
    }
    const link = buildWhatsAppLink(targetPhone, msgToSend);
    window.open(link, '_blank', 'noopener,noreferrer');
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

  const handleDeleteStep = (stageId: string, stepId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta mensagem do roteiro?')) return;
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

  const handleDeleteObjection = (objId: string) => {
    if (!window.confirm('Excluir esta resposta de objeção do roteiro?')) return;
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
      const res = await fetch('/api/gemini/improve-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentMessage: messageToImprove,
          nicheName: niche.name,
          blockTitle: blockTitle,
          instruction:
            'Tornar a mensagem mais persuasiva, natural e conversacional para WhatsApp, aumentando a taxa de resposta e mantendo todas as variáveis {empresa}, {contato}, etc.',
        }),
      });

      if (!res.ok) throw new Error('Falha ao processar melhoria');

      const data = await res.json();
      if (data.improvedMessage) {
        if (isObjection) {
          setEditObjResponse(data.improvedMessage);
        } else {
          setEditMessage(data.improvedMessage);
        }
        setAiSuccessFeedback('✨ Mensagem otimizada com sucesso com foco em conversão!');
      }
    } catch (err: any) {
      console.error(err);
      setAiErrorFeedback('Não foi possível conectar à IA no momento. Tente novamente.');
    } finally {
      setIsImprovingWithAi(false);
    }
  };

  // Reset to original factory template
  const handleResetToDefault = () => {
    if (
      !window.confirm(
        `Deseja restaurar o roteiro "${activeScript.title}" para a versão original de fábrica? Suas edições personalizadas neste script serão substituídas pelas padrões.`
      )
    ) {
      return;
    }

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
      <div className="border-b border-slate-200/80 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>💬 Roteiros & Scripts de Abordagem</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Scripts customizáveis e validados. Você pode <strong>editar os blocos</strong> diretamente, adicionar mensagens e otimizar com IA.
          </p>
        </div>

        {/* Lead Switcher & Reset Button */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Restaurar roteiro original de fábrica"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Roteiro Original</span>
          </button>

          {/* Searchable Lead Selector with Real-time Person Name Search */}
          <div className="relative" ref={leadDropdownRef}>
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-700 pl-2 shrink-0">
                Simular com Lead:
              </span>

              <button
                type="button"
                onClick={() => setIsLeadDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 px-2.5 py-1 text-xs font-medium text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors cursor-pointer max-w-[240px]"
                title="Clique para pesquisar pelo nome da pessoa ou clínica"
              >
                {currentLead ? (
                  <span className="truncate flex items-center gap-1.5 text-left">
                    <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-bold text-slate-900 truncate">
                      {currentLead.contactName || currentLead.companyName}
                    </span>
                    {currentLead.contactName && (
                      <span className="text-slate-500 font-normal truncate hidden sm:inline">
                        ({currentLead.companyName})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-blue-700 font-medium flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>-- Simulação Livre --</span>
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto" />
              </button>

              {currentLead && (
                <button
                  type="button"
                  onClick={() => setSelectedLeadId('custom')}
                  className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                  title="Voltar para simulação livre"
                >
                  ✕ Livre
                </button>
              )}
            </div>

            {/* Dropdown Popover with Search Bar */}
            {isLeadDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                {/* Search Bar at the Top */}
                <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={leadSearchQuery}
                      onChange={(e) => setLeadSearchQuery(e.target.value)}
                      placeholder="Pesquisar pelo nome da pessoa ou clínica..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400 shadow-2xs"
                    />
                    {leadSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setLeadSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1.5 px-0.5">
                    <span>Busca por nome, clínica ou telefone</span>
                    <span>{filteredSimulatorLeads.length} leads</span>
                  </div>
                </div>

                {/* Option: Simulação Livre */}
                <div className="p-1 border-b border-slate-100 bg-blue-50/20">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLeadId('custom');
                      setIsLeadDropdownOpen(false);
                      setLeadSearchQuery('');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      selectedLeadId === 'custom'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-blue-900 hover:bg-blue-100/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className={`w-3.5 h-3.5 ${selectedLeadId === 'custom' ? 'text-white' : 'text-amber-500'}`} />
                      <span>-- Simulação Livre (Manual) --</span>
                    </div>
                    {selectedLeadId === 'custom' && <Check className="w-4 h-4 text-white shrink-0" />}
                  </button>
                </div>

                {/* Filtered Leads List */}
                <div className="max-h-64 overflow-y-auto p-1 divide-y divide-slate-100">
                  {filteredSimulatorLeads.length === 0 ? (
                    <div className="p-5 text-center text-xs text-slate-500">
                      Nenhum lead encontrado com <strong>"{leadSearchQuery}"</strong>.
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
                              ? 'bg-blue-50 text-blue-900 font-medium'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {lead.contactName ? (
                                <>
                                  <span className="font-bold text-slate-900">
                                    {lead.contactName}
                                  </span>
                                  <span className="text-slate-400 text-[11px]">·</span>
                                  <span className="text-slate-600 text-[11px] truncate">
                                    {lead.companyName}
                                  </span>
                                </>
                              ) : (
                                <span className="font-bold text-slate-900 truncate">
                                  {lead.companyName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                              <span>{lead.phone}</span>
                              {lead.city && <span>· {lead.city}</span>}
                            </div>
                          </div>

                          {isSelected && (
                            <Check className="w-4 h-4 text-blue-600 shrink-0" />
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
        <div className="p-3 bg-emerald-50/70 border border-emerald-200/90 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-emerald-950">
              Simulando com dados reais de: <strong>{currentLead.contactName || currentLead.companyName}</strong> {currentLead.contactName ? `(${currentLead.companyName})` : ''}
            </span>
            {currentLead.phone && (
              <span className="text-emerald-800 font-mono text-[11px] bg-emerald-100/70 px-1.5 py-0.5 rounded">
                WhatsApp: {currentLead.phone}
              </span>
            )}
            {currentLead.city && (
              <span className="text-emerald-700 text-[11px]">
                · {currentLead.city}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSelectedLeadId('custom')}
            className="text-xs text-emerald-800 hover:text-emerald-950 font-semibold underline cursor-pointer"
          >
            Voltar para Simulação Livre
          </button>
        </div>
      )}

      {/* Simulator Inputs (when Custom is selected) */}
      {selectedLeadId === 'custom' && (
        <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-[11px] text-blue-900 font-semibold">
            <span>Variáveis de Teste para o Roteiro:</span>
            <span className="text-blue-600 font-normal">
              Substitui automaticamente as tags &#123;empresa&#125;, &#123;contato&#125;, etc.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            <input
              type="text"
              value={simCompany}
              onChange={(e) => setSimCompany(e.target.value)}
              placeholder="Empresa"
              className="text-xs px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Nome da Empresa {empresa}"
            />
            <input
              type="text"
              value={simContact}
              onChange={(e) => setSimContact(e.target.value)}
              placeholder="Contato"
              className="text-xs px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Nome do Contato {contato}"
            />
            <input
              type="text"
              value={simCity}
              onChange={(e) => setSimCity(e.target.value)}
              placeholder="Cidade"
              className="text-xs px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Cidade {cidade}"
            />
            <input
              type="text"
              value={simPhone}
              onChange={(e) => setSimPhone(e.target.value)}
              placeholder="Telefone"
              className="text-xs px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Telefone WhatsApp"
            />
            <input
              type="text"
              value={simMockup}
              onChange={(e) => setSimMockup(e.target.value)}
              placeholder="Link do Mockup"
              className="text-xs px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:col-span-2"
              title="Link da Prévia do Site {linkMockup}"
            />
          </div>
        </div>
      )}

      {/* Script Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl flex-wrap">
        {scriptKeys.map((sId) => {
          const s = niche.scripts[sId];
          const isSelected = selectedScriptId === sId;
          const isAudio = sId === 'script_nutri' || s?.title?.toLowerCase().includes('áudio');
          const isMsg = sId === 'script_nutri_mensagens' || s?.title?.toLowerCase().includes('mensagem');
          return (
            <button
              key={sId}
              type="button"
              onClick={() => handleSelectScript(sId)}
              className={`flex-1 min-w-[220px] py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                isSelected
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200 ring-2 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {isAudio && <Mic className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
              {isMsg && <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isSelected ? 'bg-blue-600' : 'bg-slate-400'
                }`}
              />
              <span className="truncate">{s?.title || sId}</span>
            </button>
          );
        })}
      </div>

      {/* GOLDEN RULE / OBJETIVO DO SCRIPT BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>FLUXO ESTRATÉGICO DO SCRIPT</span>
        </div>

        {/* Dynamic Order Chain */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-white/90">
          {goldenRule.order.split('→').map((step, idx) => (
            <React.Fragment key={idx}>
              <span className="px-2.5 py-1 bg-white/10 rounded-md">
                {step.trim()}
              </span>
              {idx < goldenRule.order.split('→').length - 1 && (
                <span className="text-slate-400">→</span>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs text-blue-100 border-t border-white/15">
          <p className="leading-relaxed">
            <strong>Objetivo da Abordagem:</strong> {goldenRule.primaryGoal}
          </p>
          <p className="leading-relaxed">
            <strong>Estratégia de Conversão:</strong> {goldenRule.insight}
          </p>
        </div>
      </div>

      {/* Main Studio: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Detailed Steps & Objections with Inline Editing */}
        <div className="lg:col-span-7 space-y-5">
          {/* Header Controls for Stages: Open/Close all */}
          <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Etapas & Mensagens do Script
                </h3>
                <span className="text-[11px] text-slate-500 font-medium">
                  {(activeScript.stages || []).filter((s) => !!openStageIds[s.id]).length} de {(activeScript.stages || []).length} etapas abertas
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenAllStages}
                className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-2xs"
                title="Abrir todas as etapas"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Abrir Todas</span>
              </button>
              <button
                type="button"
                onClick={handleCloseAllStages}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
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
                className={`bg-white rounded-xl border transition-all overflow-hidden ${
                  isStageOpen
                    ? 'border-blue-200 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300'
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
                      ? 'bg-blue-50/40 border-blue-100 text-slate-900'
                      : 'bg-white border-transparent hover:bg-slate-50 text-slate-700'
                  }`}
                  title={isStageOpen ? 'Clique para fechar esta etapa' : 'Clique para abrir esta etapa'}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center font-mono transition-colors ${
                        isStageOpen
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {sIdx + 1}
                    </span>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        {stage.stageTitle}
                      </h3>
                      {stage.description && (
                        <p className="text-[11px] text-slate-500 font-normal">
                          {stage.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100/90 px-2 py-0.5 rounded-md">
                      {stage.steps.length} {stage.steps.length === 1 ? 'bloco' : 'blocos'}
                    </span>
                    <span className={`p-1 rounded-md transition-colors ${isStageOpen ? 'text-blue-600' : 'text-slate-400'}`}>
                      {isStageOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </div>
                </div>

                {/* Sub-steps in this stage */}
                {isStageOpen && (
                  <div className="p-4 space-y-4 divide-y divide-slate-100">
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
                            className="pt-4 first:pt-0 p-4 bg-blue-50/70 border-2 border-blue-400 rounded-xl space-y-3 animate-in fade-in duration-150"
                          >
                            <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
                              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                <span>Editando Bloco da Etapa</span>
                              </span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleImproveWithAi(false, editTitle)}
                                  disabled={isImprovingWithAi}
                                  className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-purple-700 bg-purple-100/80 hover:bg-purple-200/80 border border-purple-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                  title="Melhorar mensagem automaticamente com IA"
                                >
                                  <Sparkles className="w-3 h-3 text-purple-600" />
                                  <span>{isImprovingWithAi ? 'Melhorando...' : 'Melhorar com IA'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteStep(stage.id, step.id)}
                                  className="text-xs text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-100/60 rounded-lg transition-colors cursor-pointer"
                                  title="Excluir este bloco"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Feedback messages */}
                            {aiSuccessFeedback && (
                              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>{aiSuccessFeedback}</span>
                              </div>
                            )}

                            {aiErrorFeedback && (
                              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>{aiErrorFeedback}</span>
                              </div>
                            )}

                            {/* Title & Trigger inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  Título do Bloco / Passo
                                </label>
                                <input
                                  type="text"
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  placeholder="Ex: 1. Mensagem de Abertura"
                                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  Momento de Envio / Gatilho
                                </label>
                                <input
                                  type="text"
                                  value={editCondition}
                                  onChange={(e) => setEditCondition(e.target.value)}
                                  placeholder="Ex: Enviar às 10h da manhã"
                                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            {/* Script Message Textarea */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-semibold text-slate-700">
                                  Texto do Script (Mensagem enviada no WhatsApp):
                                </label>
                                <span className="text-[10px] text-slate-500">
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
                                    className="px-2 py-0.5 text-[10px] font-mono bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md transition-colors cursor-pointer"
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
                                className="w-full text-xs p-3 bg-white border border-slate-300 rounded-lg font-sans text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                              />
                            </div>

                            {/* Tip / Strategic Advice */}
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Dica Estratégica (Visível como lembrete para você):
                              </label>
                              <input
                                type="text"
                                value={editTip}
                                onChange={(e) => setEditTip(e.target.value)}
                                placeholder="Ex: Nunca mande áudio no primeiro contato."
                                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            {/* Action Buttons: Save & Cancel */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-200">
                              <button
                                type="button"
                                onClick={handleCancelEditStep}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
                              >
                                Cancelar
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSaveStep(stage.id, step.id)}
                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors cursor-pointer shadow-xs"
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
                            isStepActive ? 'p-3 bg-blue-50/40 ring-1 ring-blue-300' : ''
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
                                className="text-xs font-bold text-slate-900 hover:text-blue-600 text-left transition-colors flex items-center gap-1.5 cursor-pointer flex-wrap"
                              >
                                {isStepActive && (
                                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                                )}
                                <span>{step.title}</span>

                                {step.format === 'audio' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                                    <Mic className="w-2.5 h-2.5 text-amber-700" />
                                    Áudio
                                  </span>
                                )}
                                {step.format === 'texto' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                                    <MessageSquare className="w-2.5 h-2.5 text-emerald-700" />
                                    Texto
                                  </span>
                                )}
                              </button>

                              {step.condition && (
                                <span className="text-[10px] text-slate-500 italic block mt-0.5">
                                  Gatilho: {step.condition}
                                </span>
                              )}
                            </div>

                            {/* Buttons: Edit, Copy, WhatsApp */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditStep(stage.id, step)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors cursor-pointer"
                                title="Editar texto e detalhes deste bloco"
                              >
                                <Edit3 className="w-3 h-3 text-blue-600" />
                                <span>Editar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyText(step.message, step.id)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                title="Copiar texto pronto"
                              >
                                {copiedId === step.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-700 font-semibold">Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-400" />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveStepId(step.id);
                                  setActiveObjectionId(null);
                                  handleSendViaWhatsApp(step.message);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                title="Disparar no WhatsApp"
                              >
                                <MessageCircle className="w-3 h-3 fill-white/20" />
                                <span>WhatsApp</span>
                              </button>
                            </div>
                          </div>

                          {/* Message Box */}
                          <div
                            onClick={() => {
                              setActiveStepId(step.id);
                              setActiveObjectionId(null);
                            }}
                            className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs text-slate-800 font-sans whitespace-pre-wrap leading-relaxed cursor-pointer hover:border-slate-300 transition-colors"
                            title="Clique para carregar no simulador ao lado"
                          >
                            {interpolatedStepMsg}
                          </div>

                          {/* Tip / Strategic context */}
                          {step.tip && (
                            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                              <Info className="w-3 h-3 text-blue-500 shrink-0" />
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
                        className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 rounded-lg text-xs font-semibold text-slate-600 hover:text-blue-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
            <div className="bg-white rounded-xl border border-amber-200/80 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                <div
                  onClick={() => setIsObjectionsSectionOpen(!isObjectionsSectionOpen)}
                  className="flex items-center gap-2 cursor-pointer select-none"
                  title={isObjectionsSectionOpen ? 'Clique para recolher' : 'Clique para expandir'}
                >
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Respostas para Objeções ({activeScript.objections.length})
                  </h3>
                  {isObjectionsSectionOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>

                {isObjectionsSectionOpen && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleAddObjection}
                      className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-100/80 hover:bg-amber-200 border border-amber-300 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Nova Objeção</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenAllObjections}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors cursor-pointer"
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
                          className="p-4 bg-amber-50/80 border-2 border-amber-400 rounded-xl space-y-3 animate-in fade-in duration-150"
                        >
                          <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                            <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                              <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                              <span>Editando Resposta de Objeção</span>
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleImproveWithAi(true, editObjTitle)}
                                disabled={isImprovingWithAi}
                                className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Sparkles className="w-3 h-3 text-purple-600" />
                                <span>{isImprovingWithAi ? 'Melhorando...' : 'Melhorar com IA'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteObjection(obj.id)}
                                className="text-xs text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                                title="Excluir objeção"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Title input */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Título da Objeção do Cliente
                            </label>
                            <input
                              type="text"
                              value={editObjTitle}
                              onChange={(e) => setEditObjTitle(e.target.value)}
                              placeholder="Ex: 'Já temos alguém que cuida do site'"
                              className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                            />
                          </div>

                          {/* Response textarea */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-semibold text-slate-700">
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
                                    className="px-1.5 py-0.5 text-[10px] font-mono bg-white hover:bg-amber-100 text-amber-800 border border-amber-200 rounded transition-colors cursor-pointer"
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
                              className="w-full text-xs p-3 bg-white border border-slate-300 rounded-lg font-sans text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                            />
                          </div>

                          {/* Save & Cancel */}
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                            <button
                              type="button"
                              onClick={handleCancelEditObjection}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
                            >
                              Cancelar
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSaveObjection(obj.id)}
                              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-lg transition-colors cursor-pointer shadow-xs"
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
                            ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300'
                            : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div
                          onClick={() => handleToggleObjection(obj.id)}
                          className="p-3.5 flex items-center justify-between gap-2 cursor-pointer select-none"
                          title={isObjOpen ? 'Clique para fechar' : 'Clique para abrir'}
                        >
                          <span className="text-xs font-bold text-slate-900 hover:text-amber-800 flex items-center gap-1.5">
                            {isObjOpen ? (
                              <ChevronUp className="w-3.5 h-3.5 text-amber-600" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <span>{obj.title}</span>
                          </span>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleStartEditObjection(obj)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                              title="Editar resposta desta objeção"
                            >
                              <Edit3 className="w-3 h-3 text-amber-700" />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyText(obj.response, obj.id)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                            >
                              {copiedId === obj.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700 font-semibold">Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-slate-400" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveObjectionId(obj.id);
                                handleSendViaWhatsApp(obj.response);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
                            >
                              <MessageCircle className="w-3 h-3 fill-white/20" />
                              <span>WhatsApp</span>
                            </button>
                          </div>
                        </div>

                        {isObjOpen && (
                          <div
                            onClick={() => setActiveObjectionId(obj.id)}
                            className="p-3.5 pt-0 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed cursor-pointer"
                            title="Clique para carregar no simulador"
                          >
                            <div className="p-3 bg-white rounded-lg border border-amber-200/60 font-sans">
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
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  {selectedScriptId === 'script3' ? (
                    <>
                      <PhoneCall className="w-4 h-4 text-blue-600" />
                      <span>Roteiro de Fala / Ligação</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      <span>Visualização no WhatsApp</span>
                    </>
                  )}
                </span>
                <span className="text-[11px] text-slate-500 line-clamp-1">
                  {activeObjection ? activeObjection.title : currentActiveStep?.title || 'Mensagem Selecionada'}
                </span>
              </div>

              {selectedScriptId === 'script3' ? (
                <a
                  href={`tel:${targetPhone.replace(/\D/g, '')}`}
                  className="text-[10px] font-mono text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 transition-colors"
                >
                  <PhoneCall className="w-3 h-3" />
                  <span>Discar</span>
                </a>
              ) : (
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                  wa.me pronto
                </span>
              )}
            </div>

            {/* Script Display Canvas */}
            {selectedScriptId === 'script3' ? (
              <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 overflow-hidden shadow-xs">
                {/* Cold Call Telephony Header */}
                <div className="bg-slate-800 px-3.5 py-2.5 flex items-center justify-between text-xs border-b border-slate-700/80">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs text-white">
                      <PhoneCall className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-semibold truncate">{vars.empresa}</div>
                      <div className="text-[10px] text-slate-300 font-mono truncate">
                        {formatDisplayPhone(targetPhone)}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Em Chamada</span>
                  </div>
                </div>

                {/* Cold Call Speech Canvas */}
                <div className="p-4 sm:p-5 min-h-[200px] max-h-[360px] overflow-y-auto space-y-3">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-blue-400 flex items-center gap-1.5">
                    <span>O que você deve falar:</span>
                  </div>

                  <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700 text-xs text-slate-100 leading-relaxed font-sans whitespace-pre-wrap selection:bg-blue-600">
                    {previewMessage}
                  </div>

                  <div className="text-[11px] text-slate-400 italic">
                    💡 Fale pausadamente, com segurança e sem tom mecânico.
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#EFEAE2] rounded-2xl border border-[#DAD3C8] overflow-hidden shadow-xs">
                {/* WhatsApp Mockup Header */}
                <div className="bg-[#075E54] text-white px-3.5 py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-xs text-white">
                      {vars.empresa.slice(0, 1) || 'C'}
                    </div>
                    <div className="truncate">
                      <div className="font-semibold truncate">{vars.empresa}</div>
                      <div className="text-[10px] text-emerald-100/80 font-mono truncate">
                        {formatDisplayPhone(targetPhone)}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-200 font-mono shrink-0">Online</div>
                </div>

                {/* Chat Canvas with authentic balloon */}
                <div className="p-4 sm:p-5 min-h-[220px] max-h-[360px] overflow-y-auto space-y-3">
                  <div className="text-center">
                    <span className="text-[10px] bg-white/80 text-slate-500 px-2 py-0.5 rounded-md font-mono">
                      HOJE
                    </span>
                  </div>

                  {/* Format Indicator (Audio vs Text) */}
                  {currentActiveStep?.format === 'audio' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-900 rounded-xl text-xs font-semibold border border-amber-200">
                      <Mic className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>Gravar como Áudio no WhatsApp (Tom natural e profissional)</span>
                    </div>
                  )}
                  {currentActiveStep?.format === 'texto' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-900 rounded-xl text-xs font-semibold border border-emerald-200">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>Enviar como Mensagem de Texto</span>
                    </div>
                  )}

                  {/* Sent Bubble */}
                  <div className="max-w-[92%] ml-auto bg-[#E7FFDB] rounded-2xl rounded-tr-xs p-3.5 shadow-2xs border border-[#CCE8C0] text-xs text-slate-900 leading-relaxed font-sans whitespace-pre-wrap">
                    {previewMessage}

                    {previewMessage.includes(vars.linkMockup) && (
                      <div className="mt-2.5 p-2 bg-white/85 rounded-lg border border-emerald-200/80 text-[11px] flex items-center justify-between">
                        <div className="truncate">
                          <div className="font-bold text-slate-900 truncate">Prévia do Site da Clínica</div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">
                            {vars.linkMockup}
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />
                      </div>
                    )}

                    <div className="text-right text-[10px] text-emerald-700/80 mt-1.5 font-mono flex items-center justify-end gap-1">
                      <span>14:32</span>
                      <span className="text-emerald-600 font-bold">✓✓</span>
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
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedId === 'preview-box' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Texto Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copiar Roteiro</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSendViaWhatsApp()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-white/20" />
                  <span>{selectedScriptId === 'script3' ? 'Mandar no WhatsApp' : 'Abrir no WhatsApp'}</span>
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">Variáveis Ativas no Preview:</div>
                <div className="grid grid-cols-2 gap-1 font-mono text-[10px] text-slate-500">
                  <div>
                    &#123;empresa&#125;: <strong className="text-slate-800 font-sans">{vars.empresa}</strong>
                  </div>
                  <div>
                    &#123;cidade&#125;: <strong className="text-slate-800 font-sans">{vars.cidade}</strong>
                  </div>
                  <div>
                    &#123;seuNome&#125;: <strong className="text-slate-800 font-sans">{vars.seuNome}</strong>
                  </div>
                  <div>
                    &#123;contato&#125;: <strong className="text-slate-800 font-sans">{vars.contato}</strong>
                  </div>
                  {selectedScriptId === 'script3' && (
                    <>
                      <div>
                        [Xª Posição]: <strong className="text-amber-700 font-sans">{vars.posicaoGoogle}</strong>
                      </div>
                      <div>
                        [Horários]: <strong className="text-blue-700 font-sans">Opção 1 e 2</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
