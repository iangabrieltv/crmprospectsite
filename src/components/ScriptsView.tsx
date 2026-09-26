import React, { useState } from 'react';
import { NicheCampaign, Lead, ScriptDefinition, ScriptStageBlock, ScriptSubStep } from '../types/crm';
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
  PhoneCall
} from 'lucide-react';
import { DEFAULT_SCRIPTS, SCRIPT_1_MOCKUP, SCRIPT_2_DIAGNOSTICO_GOOGLE, SCRIPT_3_COLD_CALL } from '../utils/initialData';

interface ScriptsViewProps {
  niche: NicheCampaign;
  leads: Lead[];
  userName: string;
  onUpdateNicheScripts: (updatedScripts: Record<string, ScriptDefinition>) => void;
  onFastWhatsAppContacted: (lead: Lead) => void;
}

export const ScriptsView: React.FC<ScriptsViewProps> = ({
  niche,
  leads,
  userName,
  onUpdateNicheScripts,
  onFastWhatsAppContacted,
}) => {
  const scriptKeys = Object.keys(niche.scripts);
  const [selectedScriptId, setSelectedScriptId] = useState<string>(
    scriptKeys[0] || 'script1'
  );
  
  // Custom simulator variables when leads list is clean
  const [simCompany, setSimCompany] = useState('Clínica Exemplo');
  const [simContact, setSimContact] = useState('Dr. Roberto');
  const [simCity, setSimCity] = useState(niche.city || 'São Paulo - SP');
  const [simMockup, setSimMockup] = useState('https://previa-clinica.framer.website');
  const [simPhone, setSimPhone] = useState('11999998888');
  const [simPosicao, setSimPosicao] = useState('6ª');
  const [simHorario1, setSimHorario1] = useState('quinta às 14h');
  const [simHorario2, setSimHorario2] = useState('sexta às 10h');
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || 'custom');

  // Currently focused step in the script
  const [activeStageId, setActiveStageId] = useState<string>('etapa-1');
  const [activeStepId, setActiveStepId] = useState<string>('etapa-1-msg-1');
  const [activeObjectionId, setActiveObjectionId] = useState<string | null>(null);

  // Active script
  const activeScript: ScriptDefinition =
    niche.scripts[selectedScriptId] ||
    niche.scripts.script1 ||
    SCRIPT_1_MOCKUP;

  // Set of open stage tab IDs - allows each tab to toggle open/close independently, or all open/all closed!
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

  const currentLead = leads.find((l) => l.id === selectedLeadId);

  // Toggle a stage tab (click opens, click again closes)
  const handleToggleStage = (stageId: string) => {
    setOpenStageIds((prev) => ({
      ...prev,
      [stageId]: !prev[stageId],
    }));
  };

  // Open all stage tabs
  const handleOpenAllStages = () => {
    const allOpen: Record<string, boolean> = {};
    (activeScript.stages || []).forEach((st) => {
      allOpen[st.id] = true;
    });
    setOpenStageIds(allOpen);
  };

  // Close all stage tabs
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
    const target = niche.scripts[sId];
    if (target?.stages?.[0]) {
      setActiveStageId(target.stages[0].id);
      if (target.stages[0].steps?.[0]) {
        setActiveStepId(target.stages[0].steps[0].id);
      }
    }
    // Set all stages of the newly selected script to open by default
    const initialStages: Record<string, boolean> = {};
    (target?.stages || []).forEach((st) => {
      initialStages[st.id] = true;
    });
    setOpenStageIds(initialStages);
  };

  // Variables resolution
  const vars = {
    empresa: currentLead ? currentLead.companyName : simCompany,
    contato: currentLead ? (currentLead.contactName || 'Doutor(a)') : simContact,
    nicho: niche.segment,
    cidade: currentLead ? currentLead.city : simCity,
    linkMockup: currentLead ? (currentLead.mockupUrl || simMockup) : simMockup,
    notaGoogle: currentLead ? currentLead.googleRating : 4.9,
    seuNome: userName,
    posicaoGoogle: simPosicao,
    horario1: simHorario1,
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
    // Fallback to first step if not found
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

  const waLink = buildWhatsAppLink(targetPhone, previewMessage);

  const handleCopyText = (rawText: string, id: string) => {
    const interpolated = interpolateScript(rawText, vars);
    navigator.clipboard.writeText(interpolated);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendViaWhatsApp = (stepMessage?: string) => {
    const msgToSend = stepMessage
      ? interpolateScript(stepMessage, vars)
      : previewMessage;
    
    if (currentLead) {
      onFastWhatsAppContacted(currentLead);
    }
    const link = buildWhatsAppLink(targetPhone, msgToSend);
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const goldenRule = activeScript.goldenRule || {
    order: 'Contato → confiança → permissão → mockup → opinião → interesse → proposta → preço',
    primaryGoal: 'O primeiro objetivo NÃO é vender o site. É fazer a pessoa pensar: "Esse cara realmente olhou nossa clínica e fez alguma coisa específica para a gente."',
    insight: 'Depois do mockup, a conversa passa a ser sobre o que você criou — e não simplesmente sobre alguém tentando vender um site.',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      
      {/* Top Header */}
      <div className="border-b border-slate-200/80 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{niche.emoji}</span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {activeScript.title}
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
              {activeScript.category || 'Roteiro de Vendas'}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {activeScript.subtitle}
          </p>
        </div>

        {/* Live Simulator Target Controls */}
        <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium flex items-center gap-1 text-[11px]">
            <Target className="w-3.5 h-3.5 text-blue-600" />
            <span>Simulando para:</span>
          </span>

          {leads.length > 0 ? (
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="text-xs px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="custom">Variáveis de Demonstração</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.companyName} ({formatDisplayPhone(l.phone)})
                </option>
              ))}
            </select>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={simCompany}
                onChange={(e) => setSimCompany(e.target.value)}
                placeholder="Nome da Clínica"
                className="w-36 text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-md font-semibold text-slate-800"
                title="Nome da Clínica"
              />
              <input
                type="text"
                value={simContact}
                onChange={(e) => setSimContact(e.target.value)}
                placeholder="Contato (ex: Dr. Roberto)"
                className="w-32 text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-slate-700"
                title="Nome do Contato"
              />
              <input
                type="text"
                value={simCity}
                onChange={(e) => setSimCity(e.target.value)}
                placeholder="Cidade"
                className="w-28 text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-slate-700"
                title="Cidade da Clínica"
              />
              {selectedScriptId === 'script3' && (
                <input
                  type="text"
                  value={simPosicao}
                  onChange={(e) => setSimPosicao(e.target.value)}
                  placeholder="Posição (ex: 6ª)"
                  className="w-24 text-xs px-2 py-1 bg-amber-50 border border-amber-200 rounded-md text-amber-800 font-semibold"
                  title="Posição nas buscas do Google [Xª]"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Script Tab Switcher (Fast 1-Click Toggle between Script 1 and Script 2) */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl">
        {scriptKeys.map((sId) => {
          const s = niche.scripts[sId];
          const isSelected = selectedScriptId === sId;
          return (
            <button
              key={sId}
              type="button"
              onClick={() => handleSelectScript(sId)}
              className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                isSelected
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200 ring-2 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
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
        
        {/* Left Column (7 cols): Detailed Steps & Objections */}
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
                  {(activeScript.stages || []).filter((s) => !!openStageIds[s.id]).length} de {(activeScript.stages || []).length} abas abertas
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenAllStages}
                className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-2xs"
                title="Abrir todas as abas"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Abrir Todas</span>
              </button>
              <button
                type="button"
                onClick={handleCloseAllStages}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
                title="Fechar todas as abas"
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
                {/* Stage Header - Click to open, click again to close! */}
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
                  title={isStageOpen ? 'Clique para fechar esta aba' : 'Clique para abrir esta aba'}
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
                      {stage.steps.length} {stage.steps.length === 1 ? 'mensagem' : 'mensagens'}
                    </span>
                    <span className={`p-1 rounded-md transition-colors ${isStageOpen ? 'text-blue-600' : 'text-slate-400'}`}>
                      {isStageOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </div>
                </div>

                {/* Sub-steps in this stage */}
                {isStageOpen && (
                  <div className="p-4 space-y-3.5 divide-y divide-slate-100">
                    {stage.steps.map((step) => {
                      const isStepActive = !activeObjectionId && activeStepId === step.id;
                      const interpolatedStepMsg = interpolateScript(step.message, vars);

                      return (
                        <div
                          key={step.id}
                          className={`pt-3.5 first:pt-0 rounded-xl transition-all ${
                            isStepActive ? 'p-3 bg-blue-50/40 ring-1 ring-blue-300' : ''
                          }`}
                        >
                          {/* Title & Condition */}
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveStepId(step.id);
                                  setActiveObjectionId(null);
                                }}
                                className="text-xs font-bold text-slate-900 hover:text-blue-600 text-left transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                {isStepActive && (
                                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                                )}
                                <span>{step.title}</span>
                              </button>

                              {step.condition && (
                                <span className="text-[10px] text-slate-500 italic block mt-0.5">
                                  Gatilho: {step.condition}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
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
                            className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs text-slate-800 font-sans whitespace-pre-wrap leading-relaxed cursor-pointer hover:border-slate-300"
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
                  </div>
                )}
              </div>
            );
          })}

          {/* QUEBRA DE OBJEÇÕES SECTION */}
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
                    Respostas Rápidas para Objeções ({activeScript.objections.length})
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
                      onClick={handleOpenAllObjections}
                      className="px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 rounded-md transition-colors cursor-pointer"
                    >
                      Abrir Todas
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseAllObjections}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      Fechar Todas
                    </button>
                  </div>
                )}
              </div>

              {isObjectionsSectionOpen && (
                <div className="space-y-3">
                  {activeScript.objections.map((obj) => {
                    const isObjActive = activeObjectionId === obj.id;
                    const isObjOpen = openObjectionIds[obj.id] ?? true;
                    const interpolatedResponse = interpolateScript(obj.response, vars);

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

            {/* Script Display Canvas (WhatsApp balloon or Cold Call Telephony card) */}
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
                  <div className="text-[10px] text-emerald-200 font-mono shrink-0">
                    Online
                  </div>
                </div>

                {/* Chat Canvas with authentic balloon */}
                <div className="p-4 sm:p-5 min-h-[220px] max-h-[360px] overflow-y-auto space-y-3">
                  <div className="text-center">
                    <span className="text-[10px] bg-white/80 text-slate-500 px-2 py-0.5 rounded-md font-mono">
                      HOJE
                    </span>
                  </div>

                  {/* Sent Bubble */}
                  <div className="max-w-[92%] ml-auto bg-[#E7FFDB] rounded-2xl rounded-tr-xs p-3.5 shadow-2xs border border-[#CCE8C0] text-xs text-slate-900 leading-relaxed font-sans whitespace-pre-wrap">
                    {previewMessage}

                    {previewMessage.includes(vars.linkMockup) && (
                      <div className="mt-2.5 p-2 bg-white/85 rounded-lg border border-emerald-200/80 text-[11px] flex items-center justify-between">
                        <div className="truncate">
                          <div className="font-bold text-slate-900 truncate">Prévia do Site da Clínica</div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">{vars.linkMockup}</div>
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
                <div className="font-semibold text-slate-800">Variáveis Ativas:</div>
                <div className="grid grid-cols-2 gap-1 font-mono text-[10px] text-slate-500">
                  <div>&#123;Empresa&#125;: <strong className="text-slate-800 font-sans">{vars.empresa}</strong></div>
                  <div>&#123;Cidade&#125;: <strong className="text-slate-800 font-sans">{vars.cidade}</strong></div>
                  <div>&#123;SeuNome&#125;: <strong className="text-slate-800 font-sans">{vars.seuNome}</strong></div>
                  <div>&#123;NomeContato&#125;: <strong className="text-slate-800 font-sans">{vars.contato}</strong></div>
                  {selectedScriptId === 'script3' && (
                    <>
                      <div>[Xª Posição]: <strong className="text-amber-700 font-sans">{vars.posicaoGoogle}</strong></div>
                      <div>[Horários]: <strong className="text-blue-700 font-sans">Opção 1 e 2</strong></div>
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
