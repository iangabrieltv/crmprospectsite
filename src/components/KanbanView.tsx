import React, { useState, useRef, useEffect } from 'react';
import {
  Lead,
  FunnelStageId,
  FUNNEL_STAGES,
  NicheCampaign,
  ScriptId,
  normalizeStageId
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
  PhoneOff,
  MapPin,
  Globe
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
  onOpenNewLeadModal: (defaultStage?: FunnelStageId, defaultCity?: string) => void;
  onFastWhatsAppContacted: (lead: Lead) => void;
  onSwitchToImporter?: () => void;
  onSwitchToAgenda?: (leadId?: string) => void;
  onUpdateNicheTargetCities?: (targetCities: string[]) => void;
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
  onSwitchToAgenda,
  onUpdateNicheTargetCities,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [scriptFilter, setScriptFilter] = useState<'all' | ScriptId>('all');
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [sortOption, setSortOption] = useState<KanbanSortOption>('last_contact_desc');
  const [contactFilter, setContactFilter] = useState<KanbanContactFilter>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Cidades em Prospecção state
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement | null>(null);

  const [dragOverColumn, setDragOverColumn] = useState<FunnelStageId | null>(null);

  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  // Memoized unique cities present in the spreadsheet / leads
  const prospectedCities = React.useMemo(() => {
    const cityMap = new Map<string, { city: string; count: number }>();

    // 1. Count leads currently in each city directly from the spreadsheet / leads
    leads.forEach((l) => {
      const ct = (l.city || '').trim();
      if (ct) {
        const key = ct.toLowerCase();
        const existing = cityMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          cityMap.set(key, { city: ct, count: 1 });
        }
      }
    });

    // 2. Base city of the niche if no cities were found in the leads
    if (cityMap.size === 0 && niche.city && niche.city.trim()) {
      const key = niche.city.trim().toLowerCase();
      cityMap.set(key, { city: niche.city.trim(), count: leads.length });
    }

    // Sort by count descending, then alphabetically
    return Array.from(cityMap.values()).sort(
      (a, b) => b.count - a.count || a.city.localeCompare(b.city)
    );
  }, [niche.city, leads]);

  // Reset selected city to 'all' when switching niches
  useEffect(() => {
    setSelectedCity('all');
  }, [niche.id]);

  // Close city dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    if (isCityDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCityDropdownOpen]);

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

    // City filter (De acordo com a planilha)
    if (selectedCity !== 'all') {
      const leadCity = (lead.city || niche.city || '').trim().toLowerCase();
      const target = selectedCity.trim().toLowerCase();
      if (leadCity !== target && !leadCity.includes(target) && !target.includes(leadCity)) {
        return false;
      }
    }

    // Inactivity filter
    if (onlyInactive && !isInactiveOver48h(lead.lastContactDate, lead.createdAt)) {
      return false;
    }

    return true;
  });

  // Calculate totals for summary bar
  const totalLeads = leads.length;
  const closedLeads = leads.filter((l) => normalizeStageId(l.stage) === 'fechado');
  const closedRevenue = closedLeads.reduce((acc, l) => acc + (l.creationValue || 0), 0);
  const totalMrr = closedLeads.reduce((acc, l) => acc + (l.monthlyMrr || 0), 0);
  const totalContactedLeads = leads.filter(
    (l) => normalizeStageId(l.stage) !== 'leads_sem_contato' || Boolean(l.lastContactDate)
  ).length;
  const semContatoCount = leads.filter((l) => normalizeStageId(l.stage) === 'leads_sem_contato').length;
  const primeiroContatoCount = leads.filter((l) => normalizeStageId(l.stage) === 'primeiro_contato').length;
  const naoAtendidaCount = leads.filter((l) => normalizeStageId(l.stage) === 'nao_atendida').length;
  const inFollowupLeads = leads.filter(
    (l) => normalizeStageId(l.stage) === 'follow_up_1' || normalizeStageId(l.stage) === 'follow_up_2'
  ).length;
  const reuniaoCount = leads.filter((l) => normalizeStageId(l.stage) === 'reuniao_marcada').length;
  const inactiveCount = leads.filter((l) => isInactiveOver48h(l.lastContactDate, l.createdAt)).length;

  const handleDragOver = (e: React.DragEvent, stageId: FunnelStageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== stageId) {
      setDragOverColumn(stageId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, stageId: FunnelStageId) => {
    // Only reset dragOverColumn if genuinely leaving the column container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dragOverColumn === stageId) {
        setDragOverColumn(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, stageId: FunnelStageId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);
    const leadId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('leadId');
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
    <div className="flex flex-col h-full flex-1 min-h-0 min-w-0 w-full max-w-full overflow-hidden">
      {/* Top Filter & Quick Stat Bar */}
      <div className="bg-white border-b border-slate-200/80 px-2.5 sm:px-6 py-2 sm:py-2.5 shrink-0 w-full max-w-full overflow-hidden">
        <div className="w-full max-w-full flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2 sm:gap-3">
          
          {/* Search, Filter Icon and Dropdowns */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[130px] sm:min-w-[240px]">
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

            {/* BOTÃO DA CIDADE / TODAS AS CIDADES (DE ACORDO COM A PLANILHA) */}
            <div className="relative" ref={cityDropdownRef}>
              <button
                type="button"
                onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shadow-2xs ${
                  selectedCity === 'all'
                    ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    : 'bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-200 font-bold'
                }`}
                title="Escolher cidade de acordo com a planilha"
              >
                {selectedCity === 'all' ? (
                  <>
                    <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Todas as Cidades</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
                      {leads.length}
                    </span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="max-w-[150px] truncate">{selectedCity}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-100 text-blue-700 font-bold">
                      {filteredLeads.length}
                    </span>
                  </>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCityDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Menu Dropdown de Cidades da Planilha */}
              {isCityDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Cidades da Planilha
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {prospectedCities.length} {prospectedCities.length === 1 ? 'cidade' : 'cidades'}
                    </span>
                  </div>

                  {/* Opção: Todas as Cidades */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCity('all');
                      setIsCityDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      selectedCity === 'all'
                        ? 'bg-blue-50 text-blue-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Todas as Cidades</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
                        {leads.length}
                      </span>
                      {selectedCity === 'all' && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  {/* Lista de Cidades da Planilha */}
                  <div className="max-h-60 overflow-y-auto py-0.5">
                    {prospectedCities.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-slate-400 text-center">
                        Nenhuma cidade encontrada na planilha.
                      </div>
                    ) : (
                      prospectedCities.map((item) => {
                        const isSelected = selectedCity.toLowerCase() === item.city.toLowerCase();
                        return (
                          <button
                            key={item.city}
                            type="button"
                            onClick={() => {
                              setSelectedCity(item.city);
                              setIsCityDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 text-blue-900 font-bold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                              <span className="truncate">{item.city}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
                                {item.count}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
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

            {/* Inactive +48h Filter (Desktop only as requested) */}
            <button
              onClick={() => setOnlyInactive(!onlyInactive)}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer border ${
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

          {/* Quick Metrics Badges - Always 100% visible on desktop, hidden on mobile */}
          <div className="hidden xl:flex flex-wrap items-center gap-1.5 text-xs font-mono tabular-nums">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 border border-slate-200/80 shrink-0" title="Total de leads cadastrados">
              <span className="text-slate-500 font-sans text-[11px]">Leads:</span>
              <span className="font-bold text-slate-900">{totalLeads}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/90 rounded-lg text-blue-700 border border-blue-200/80 shrink-0" title="Total de pessoas que você já entrou em contato (mensagens enviadas, follow-ups, interessados, etc.)">
              <Send className="w-3 h-3 text-blue-600 shrink-0" />
              <span className="text-blue-600 font-sans text-[11px]">Já Contatados:</span>
              <span className="font-bold text-blue-800">{totalContactedLeads}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 border border-slate-200/80 shrink-0" title="Leads sem contato aguardando abordagem">
              <span className="text-slate-500 font-sans text-[11px]">Sem Contato:</span>
              <span className="font-bold text-slate-900">{semContatoCount}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/90 rounded-lg text-blue-700 border border-blue-200/80 shrink-0" title="Primeiro contato enviado no WhatsApp">
              <Send className="w-3 h-3 text-blue-600 shrink-0" />
              <span className="text-blue-600 font-sans text-[11px]">1º Contato:</span>
              <span className="font-bold text-blue-800">{primeiroContatoCount}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/90 rounded-lg text-amber-800 border border-amber-200/80 shrink-0" title="Mensagens não respondidas / não atendidas">
              <PhoneOff className="w-3 h-3 text-amber-600 shrink-0" />
              <span className="text-amber-700 font-sans text-[11px]">Não Atendida:</span>
              <span className="font-bold text-amber-900">{naoAtendidaCount}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50/90 rounded-lg text-purple-700 border border-purple-200/80 shrink-0" title="Follow-up 1 e Follow-up 2">
              <Clock className="w-3 h-3 text-purple-600 shrink-0" />
              <span className="text-purple-600 font-sans text-[11px]">Follow-ups:</span>
              <span className="font-bold text-purple-800">{inFollowupLeads}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/90 rounded-lg text-emerald-800 border border-emerald-200/80 shrink-0" title="Reunião ou demonstração agendada">
              <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="text-emerald-700 font-sans text-[11px]">Reunião:</span>
              <span className="font-bold text-emerald-900">{reuniaoCount}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 rounded-lg text-green-800 border border-green-300 shrink-0" title="Contratos fechados e MRR mensal">
              <DollarSign className="w-3 h-3 text-green-700 shrink-0" />
              <span className="text-green-800 font-sans text-[11px] font-bold">Fechados ({closedLeads.length}):</span>
              <span className="font-bold text-green-900">R$ {totalMrr.toLocaleString('pt-BR')}/mês</span>
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
              onClick={() => onOpenNewLeadModal('leads_sem_contato')}
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

      {/* Kanban Board Container with All Sequential Stages */}
      <div className="flex-1 min-h-0 overflow-x-auto p-2 sm:p-6 bg-slate-50/50 min-w-0 w-full">
        <div className="flex items-start gap-3 h-full min-w-max pb-2">
          {FUNNEL_STAGES.map((stage) => {
            const stageLeads = filteredLeads
              .filter((l) => normalizeStageId(l.stage) === stage.id)
              .sort(sortLeads);

            const isDragOver = dragOverColumn === stage.id;
            
            // Value sum in this stage
            const stageSetupSum = stageLeads.reduce((acc, l) => acc + (l.creationValue || 0), 0);
            const stageMrrSum = stageLeads.reduce((acc, l) => acc + (l.monthlyMrr || 0), 0);

            return (
              <div
                key={stage.id}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={(e) => handleDragLeave(e, stage.id)}
                onDrop={(e) => handleDrop(e, stage.id)}
                className={`flex flex-col w-[85vw] max-w-[320px] lg:w-[300px] shrink-0 bg-slate-100/90 rounded-xl border transition-all duration-150 h-full ${
                  isDragOver
                    ? 'border-blue-500 ring-2 ring-blue-300/50 bg-blue-50/30'
                    : 'border-slate-200/80 shadow-2xs'
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

                    {/* Quick Agenda button for Reunião Marcada */}
                    {stage.id === 'reuniao_marcada' && onSwitchToAgenda && (
                      <button
                        type="button"
                        onClick={() => onSwitchToAgenda()}
                        className="ml-1 px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-md transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                        title="Ver e organizar reuniões na Agenda"
                      >
                        <Calendar className="w-3 h-3 text-emerald-700" />
                        <span>Agenda</span>
                      </button>
                    )}
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

                {/* Card List with custom scroll and direct drop support */}
                <div
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDrop={(e) => handleDrop(e, stage.id)}
                  className="p-2 space-y-2 overflow-y-auto flex-1 min-h-0 kanban-column-scroll pb-24 sm:pb-4"
                >
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
                        onSelectCity={(city) => setSelectedCity(city)}
                        onOpenAgenda={(leadId) => onSwitchToAgenda?.(leadId)}
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
