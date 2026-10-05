import React, { useState, useRef, useEffect } from 'react';
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
  DollarSign,
  ArrowUpDown,
  Send,
  Sparkles,
  Check,
  CheckCircle2,
  Calendar,
  Star,
  Users,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  X,
  Flame,
  PhoneOff
} from 'lucide-react';

export type KanbanSortOption =
  | 'last_contact_desc' // Última mensagem enviada (Mais recente primeiro)
  | 'last_contact_asc'  // Primeira mensagem enviada (Mais antiga primeiro)
  | 'created_desc'       // Cadastro: Mais recente
  | 'created_asc'        // Cadastro: Mais antigo
  | 'rating_desc'        // Maior nota do Google
  | 'company_asc';       // Nome da empresa (A-Z)

export type KanbanContactFilter =
  | 'all'
  | 'with_contact'    // Apenas com mensagem enviada
  | 'without_contact'; // Apenas sem mensagem ainda

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
  const [sortOption, setSortOption] = useState<KanbanSortOption>('last_contact_desc');
  const [contactFilter, setContactFilter] = useState<KanbanContactFilter>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const [dragOverColumn, setDragOverColumn] = useState<FunnelStageId | null>(null);
  const [mobileSelectedStage, setMobileSelectedStage] = useState<FunnelStageId>('nao_iniciada');

  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
    };
    if (showFilterMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterMenu]);

  // Sort leads comparator
  const sortLeads = (a: Lead, b: Lead) => {
    switch (sortOption) {
      case 'last_contact_desc': {
        // Leads with lastContactDate come first, newest first
        const aTime = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
        const bTime = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      case 'last_contact_asc': {
        // Leads with lastContactDate, oldest contact first
        const aTime = a.lastContactDate ? new Date(a.lastContactDate).getTime() : Infinity;
        const bTime = b.lastContactDate ? new Date(b.lastContactDate).getTime() : Infinity;
        if (aTime !== bTime) return aTime - bTime;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      case 'created_desc':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'created_asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'rating_desc':
        return (b.googleRating || 0) - (a.googleRating || 0);
      case 'company_asc':
        return a.companyName.localeCompare(b.companyName);
      default:
        return 0;
    }
  };

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

    // Contact status filter
    if (contactFilter === 'with_contact' && !lead.lastContactDate) {
      return false;
    }
    if (contactFilter === 'without_contact' && lead.lastContactDate) {
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
  const totalContactedLeads = leads.filter(
    (l) => l.stage !== 'nao_iniciada' || Boolean(l.lastContactDate)
  ).length;
  const firstContactLeads = leads.filter((l) => l.stage === 'primeiro_contato').length;
  const mockupSentLeads = leads.filter((l) => l.stage === 'mockup_enviado').length;
  const noContactLeads = leads.filter((l) => l.stage === 'nao_tem_contato').length;
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

  // Toggle quick column contact sort (alternates between last contact and first contact)
  const handleToggleColumnContactSort = () => {
    if (sortOption === 'last_contact_desc') {
      setSortOption('last_contact_asc');
    } else {
      setSortOption('last_contact_desc');
    }
  };

  const getSortOptionLabel = (opt: KanbanSortOption) => {
    switch (opt) {
      case 'last_contact_desc':
        return 'Último contato enviado';
      case 'last_contact_asc':
        return 'Primeiro contato enviado';
      case 'created_desc':
        return 'Cadastro: Mais recente';
      case 'created_asc':
        return 'Cadastro: Mais antigo';
      case 'rating_desc':
        return 'Maior nota Google';
      case 'company_asc':
        return 'Nome da empresa (A-Z)';
      default:
        return 'Ordenar';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-w-0 w-full max-w-full">
      {/* Top Filter & Quick Stat Bar */}
      <div className="bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 shrink-0 w-full max-w-full overflow-hidden">
        <div className="w-full max-w-full flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          
          {/* Search, Filter Icon and Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[190px] sm:min-w-[240px]">
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* SCRIPT FILTER */}
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

            {/* DEDICATED SORT & FILTER BUTTON WITH ICON */}
            <div className="relative" ref={filterMenuRef}>
              <button
                type="button"
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shadow-2xs ${
                  sortOption.startsWith('last_contact') || contactFilter !== 'all'
                    ? 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-200'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="Filtrar e ordenar por último ou primeiro contato"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                <span className="truncate max-w-[170px]">{getSortOptionLabel(sortOption)}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* POPUP DROPDOWN MENU */}
              {showFilterMenu && (
                <div className="absolute left-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3">
                  
                  {/* Section 1: Order by Contact Date / Sent Message */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                      <ArrowUpDown className="w-3 h-3 text-blue-600" />
                      <span>Ordenar Contatos</span>
                    </div>

                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSortOption('last_contact_desc');
                          setShowFilterMenu(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-xs text-left cursor-pointer transition-colors ${
                          sortOption === 'last_contact_desc'
                            ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Send className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <div>
                            <div>Último contato que mandei msg</div>
                            <span className="text-[10px] text-slate-500 font-normal">Mais recente no topo</span>
                          </div>
                        </div>
                        {sortOption === 'last_contact_desc' && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSortOption('last_contact_asc');
                          setShowFilterMenu(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-xs text-left cursor-pointer transition-colors ${
                          sortOption === 'last_contact_asc'
                            ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <div>
                            <div>Primeiro contato que mandei msg</div>
                            <span className="text-[10px] text-slate-500 font-normal">Mais antigo no topo</span>
                          </div>
                        </div>
                        {sortOption === 'last_contact_asc' && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSortOption('created_desc');
                          setShowFilterMenu(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-xs text-left cursor-pointer transition-colors ${
                          sortOption === 'created_desc'
                            ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <div>Cadastro mais recente</div>
                        </div>
                        {sortOption === 'created_desc' && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSortOption('rating_desc');
                          setShowFilterMenu(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-xs text-left cursor-pointer transition-colors ${
                          sortOption === 'rating_desc'
                            ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <div>Maior avaliação Google (⭐)</div>
                        </div>
                        {sortOption === 'rating_desc' && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Filter by Contact Status */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                      <Filter className="w-3 h-3 text-slate-500" />
                      <span>Filtrar por Status de Disparo</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => setContactFilter('all')}
                        className={`p-1.5 rounded-lg text-[11px] font-medium text-center cursor-pointer transition-colors ${
                          contactFilter === 'all'
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactFilter('with_contact')}
                        className={`p-1.5 rounded-lg text-[11px] font-medium text-center cursor-pointer transition-colors ${
                          contactFilter === 'with_contact'
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Com Msg
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactFilter('without_contact')}
                        className={`p-1.5 rounded-lg text-[11px] font-medium text-center cursor-pointer transition-colors ${
                          contactFilter === 'without_contact'
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Sem Msg
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

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

          {/* Quick Metrics Badges - Always 100% visible, NO horizontal scrollbar */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono tabular-nums">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 border border-slate-200/80 shrink-0" title="Total de leads cadastrados">
              <span className="text-slate-500 font-sans text-[11px]">Leads:</span>
              <span className="font-bold text-slate-900">{totalLeads}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/90 rounded-lg text-blue-700 border border-blue-200/80 shrink-0" title="Total de pessoas que você já entrou em contato (mensagens enviadas, follow-ups, interessados, etc.)">
              <Send className="w-3 h-3 text-blue-600 shrink-0" />
              <span className="text-blue-600 font-sans text-[11px]">Já Contatados:</span>
              <span className="font-bold text-blue-800">{totalContactedLeads}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-50/90 rounded-lg text-violet-700 border border-violet-200/80 shrink-0" title="Pessoas que receberam mockup da prévia">
              <Sparkles className="w-3 h-3 text-violet-600 shrink-0" />
              <span className="text-violet-600 font-sans text-[11px]">Mockups:</span>
              <span className="font-bold text-violet-800">{mockupSentLeads}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 rounded-lg text-zinc-700 border border-zinc-200/80 shrink-0" title="Números que você não conseguiu falar">
              <PhoneOff className="w-3 h-3 text-zinc-500 shrink-0" />
              <span className="text-zinc-500 font-sans text-[11px]">Sem Contato:</span>
              <span className="font-bold text-zinc-800">{noContactLeads}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/90 rounded-lg text-amber-800 border border-amber-200/80 shrink-0" title="Interessados na proposta">
              <Flame className="w-3 h-3 text-amber-600 shrink-0" />
              <span className="text-amber-700 font-sans text-[11px]">Interessados:</span>
              <span className="font-bold text-amber-900">{interestedLeads}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/90 rounded-lg text-emerald-800 border border-emerald-200/80 shrink-0" title="MRR Mensal Fechado">
              <DollarSign className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="text-emerald-700 font-sans text-[11px]">MRR:</span>
              <span className="font-bold text-emerald-900">R$ {totalMrr.toLocaleString('pt-BR')}/mês</span>
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
      <div className="lg:hidden bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
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

      {/* Kanban Board Container with All Sequential Stages */}
      <div className="flex-1 overflow-x-auto p-4 sm:p-6 bg-slate-50/50 min-w-0 w-full">
        <div className="flex items-start gap-3 h-full min-w-max pb-4">
          {FUNNEL_STAGES.map((stage) => {
            const stageLeads = filteredLeads
              .filter((l) => l.stage === stage.id)
              .sort(sortLeads);

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
                <div className="p-3 border-b border-slate-200/80 flex items-center justify-between shrink-0 bg-white/70 rounded-t-xl">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-xs font-bold text-slate-800 tracking-tight truncate">
                      {stage.name}
                    </span>
                    <span className="font-mono tabular-nums text-[11px] font-semibold text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded-full shrink-0">
                      {stageLeads.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Quick Sort Toggle Button for this Column */}
                    <button
                      type="button"
                      onClick={handleToggleColumnContactSort}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        sortOption === 'last_contact_desc'
                          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                          : sortOption === 'last_contact_asc'
                          ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                      title={
                        sortOption === 'last_contact_desc'
                          ? 'Ordenado por: Último contato que mandei mensagem (Clique para inverter para o Primeiro)'
                          : 'Ordenado por: Primeiro contato que mandei mensagem (Clique para inverter para o Último)'
                      }
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Add button inside column */}
                    <button
                      type="button"
                      onClick={() => onOpenNewLeadModal(stage.id)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                      title={`Adicionar lead em ${stage.name}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subtitle / Stage Summary if values exist */}
                {(stageSetupSum > 0 || stageMrrSum > 0) && (
                  <div className="px-3 py-1 bg-white/40 border-b border-slate-200/50 flex items-center justify-between text-[10px] font-mono text-slate-500 shrink-0">
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
