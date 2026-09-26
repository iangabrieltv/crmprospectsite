import React, { useState } from 'react';
import {
  Lead,
  FunnelStageId,
  FUNNEL_STAGES,
  NicheCampaign,
  ScriptId
} from '../types/crm';
import { LeadCard } from './LeadCard';
import { isInactiveOver48h } from '../utils/phone';
import {
  Search,
  Filter,
  Clock,
  Plus,
  ArrowRight,
  TrendingUp,
  DollarSign
} from 'lucide-react';

interface KanbanViewProps {
  niche: NicheCampaign;
  leads: Lead[];
  userName: string;
  onMoveStage: (leadId: string, targetStage: FunnelStageId) => void;
  onOpenLeadModal: (lead: Lead) => void;
  onOpenNewLeadModal: (defaultStage?: FunnelStageId) => void;
  onFastWhatsAppContacted: (lead: Lead) => void;
  onSwitchToImporter?: () => void;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  niche,
  leads,
  userName,
  onMoveStage,
  onOpenLeadModal,
  onOpenNewLeadModal,
  onFastWhatsAppContacted,
  onSwitchToImporter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [scriptFilter, setScriptFilter] = useState<'all' | ScriptId>('all');
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<FunnelStageId | null>(null);
  const [mobileSelectedStage, setMobileSelectedStage] = useState<FunnelStageId>('nao_iniciada');

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchCompany = lead.companyName.toLowerCase().includes(q);
      const matchPhone = lead.phone.includes(q);
      const matchContact = lead.contactName?.toLowerCase().includes(q);
      const matchCity = lead.city?.toLowerCase().includes(q);
      if (!matchCompany && !matchPhone && !matchContact && !matchCity) return false;
    }

    // Script filter
    if (scriptFilter !== 'all' && lead.scriptUsed !== scriptFilter) {
      return false;
    }

    // Inactivity filter
    if (onlyInactive && !isInactiveOver48h(lead.lastContactDate, lead.createdAt)) {
      return false;
    }

    return true;
  });

  // Calculate totals for summary bar
  const totalLeads = leads.length;
  const closedLeads = leads.filter((l) => l.stage === 'fechado');
  const closedRevenue = closedLeads.reduce((acc, l) => acc + (l.creationValue || 0), 0);
  const totalMrr = closedLeads.reduce((acc, l) => acc + (l.monthlyMrr || 0), 0);
  const interestedLeads = leads.filter((l) => l.stage === 'interessado').length;
  const inFollowupLeads = leads.filter((l) => l.stage === 'follow_up_1' || l.stage === 'follow_up_2').length;
  const inactiveCount = leads.filter((l) => isInactiveOver48h(l.lastContactDate, l.createdAt)).length;

  const handleDragOver = (e: React.DragEvent, stageId: FunnelStageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== stageId) {
      setDragOverColumn(stageId);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, stageId: FunnelStageId) => {
    if (dragOverColumn === stageId) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, stageId: FunnelStageId) => {
    e.preventDefault();
    setDragOverColumn(null);
    const leadId = e.dataTransfer.getData('text/plain');
    if (leadId) {
      onMoveStage(leadId, stageId);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top Filter & Quick Stat Bar */}
      <div className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[260px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar empresa, telefone, cidade..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Script Filter */}
            <select
              value={scriptFilter}
              onChange={(e) => setScriptFilter(e.target.value as any)}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Todos os Scripts</option>
              {Object.values(niche.scripts).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title.split('—')[0]}
                </option>
              ))}
              <option value="none">Sem script</option>
            </select>

            {/* Inactive +48h Filter */}
            <button
              onClick={() => setOnlyInactive(!onlyInactive)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer border ${
                onlyInactive
                  ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Inativos +48h</span>
              {inactiveCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 text-amber-900 font-mono">
                  {inactiveCount}
                </span>
              )}
            </button>
          </div>

          {/* Quick Metrics Ticker */}
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-600 overflow-x-auto py-1">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-slate-400 font-sans text-[11px]">Leads:</span>
              <span className="font-semibold text-slate-900">{totalLeads}</span>
            </div>
            <span className="text-slate-200">·</span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-slate-400 font-sans text-[11px]">Follow-ups:</span>
              <span className="font-semibold text-purple-700">{inFollowupLeads}</span>
            </div>
            <span className="text-slate-200">·</span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-slate-400 font-sans text-[11px]">Interessados:</span>
              <span className="font-semibold text-emerald-700">{interestedLeads}</span>
            </div>
            <span className="text-slate-200">·</span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-slate-400 font-sans text-[11px]">MRR Fechado:</span>
              <span className="font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                R$ {totalMrr.toLocaleString('pt-BR')}/mês
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Clean Zero-State Guide Banner */}
      {totalLeads === 0 && (
        <div className="bg-blue-50/80 border-b border-blue-200/90 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-blue-950">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>
              <strong>Sua lista de contatos está limpa e pronta para prospecção!</strong> Cadastre seus contatos manualmente ou importe sua planilha do Excel/Sheets para começar a disparar o <em>Script 1 (Mockup)</em>.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenNewLeadModal('nao_iniciada')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              + Novo Lead
            </button>
            {onSwitchToImporter && (
              <button
                type="button"
                onClick={onSwitchToImporter}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 rounded-lg font-semibold transition-colors cursor-pointer"
              >
                📥 Importar Planilha
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Column Switcher (Visible on mobile/tablet) */}
      <div className="lg:hidden bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0">
        {FUNNEL_STAGES.map((stage) => {
          const count = filteredLeads.filter((l) => l.stage === stage.id).length;
          const isSelected = mobileSelectedStage === stage.id;
          return (
            <button
              key={stage.id}
              onClick={() => setMobileSelectedStage(stage.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
              }`}
            >
              <span>{stage.shortName}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-x-auto p-4 sm:p-6 bg-slate-50/50">
        <div className="flex items-start gap-3 h-full min-w-max pb-4">
          {FUNNEL_STAGES.map((stage) => {
            const stageLeads = filteredLeads.filter((l) => l.stage === stage.id);
            const isDragOver = dragOverColumn === stage.id;
            
            // Value sum in this stage
            const stageSetupSum = stageLeads.reduce((acc, l) => acc + (l.creationValue || 0), 0);
            const stageMrrSum = stageLeads.reduce((acc, l) => acc + (l.monthlyMrr || 0), 0);

            // Hide inactive columns on mobile unless selected
            const mobileHiddenClass = mobileSelectedStage === stage.id ? 'flex' : 'hidden lg:flex';

            return (
              <div
                key={stage.id}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={(e) => handleDragLeave(e, stage.id)}
                onDrop={(e) => handleDrop(e, stage.id)}
                className={`${mobileHiddenClass} flex-col w-[300px] shrink-0 bg-slate-100/90 rounded-xl border transition-all duration-150 max-h-full ${
                  isDragOver
                    ? 'border-blue-500 ring-2 ring-blue-300/50 bg-blue-50/30'
                    : 'border-slate-200/80'
                }`}
              >
                {/* Column Header */}
                <div className="p-3 border-b border-slate-200/80 flex items-center justify-between shrink-0 bg-white/50 rounded-t-xl">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-xs font-bold text-slate-800 tracking-tight truncate">
                      {stage.name}
                    </span>
                    <span className="font-mono tabular-nums text-[11px] font-semibold text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded-full shrink-0">
                      {stageLeads.length}
                    </span>
                  </div>

                  {/* Add button inside column */}
                  <button
                    onClick={() => onOpenNewLeadModal(stage.id)}
                    className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                    title={`Adicionar lead em ${stage.name}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Subtitle / Stage Summary if values exist */}
                {(stageSetupSum > 0 || stageMrrSum > 0) && (
                  <div className="px-3 py-1 bg-white/30 border-b border-slate-200/50 flex items-center justify-between text-[10px] font-mono text-slate-500 shrink-0">
                    {stageSetupSum > 0 && (
                      <span>Setup: R$ {stageSetupSum.toLocaleString('pt-BR')}</span>
                    )}
                    {stageMrrSum > 0 && (
                      <span className="text-emerald-700 font-semibold">
                        MRR: R$ {stageMrrSum.toLocaleString('pt-BR')}/mês
                      </span>
                    )}
                  </div>
                )}

                {/* Card List with custom scroll */}
                <div className="p-2 space-y-2 overflow-y-auto flex-1 kanban-column-scroll min-h-[160px]">
                  {stageLeads.length === 0 ? (
                    <div className="h-32 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-3 text-center text-slate-400">
                      <p className="text-xs">Nenhum lead nesta etapa</p>
                      <button
                        onClick={() => onOpenNewLeadModal(stage.id)}
                        className="mt-1.5 text-[11px] font-medium text-blue-600 hover:underline cursor-pointer"
                      >
                        + Adicionar
                      </button>
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        niche={niche}
                        userName={userName}
                        onClick={() => onOpenLeadModal(lead)}
                        onMoveStage={onMoveStage}
                        onFastWhatsAppContacted={onFastWhatsAppContacted}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
