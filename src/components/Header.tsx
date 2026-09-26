import React, { useState, useRef, useEffect } from 'react';
import {
  NicheCampaign,
  AppTab,
  FUNNEL_STAGES
} from '../types/crm';
import {
  Kanban,
  BarChart3,
  FileText,
  Upload,
  Globe,
  Plus,
  ChevronDown,
  Building2,
  Sparkles,
  TrendingUp,
  User,
  Check
} from 'lucide-react';

interface HeaderProps {
  niches: NicheCampaign[];
  activeNiche: NicheCampaign;
  onSelectNiche: (nicheId: string) => void;
  onOpenNewNicheModal: () => void;
  onOpenNewLeadModal: () => void;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  userName: string;
  onUpdateUserName: (name: string) => void;
  totalLeadsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  niches,
  activeNiche,
  onSelectNiche,
  onOpenNewNicheModal,
  onOpenNewLeadModal,
  activeTab,
  onSelectTab,
  userName,
  onUpdateUserName,
  totalLeadsCount,
}) => {
  const [isNicheDropdownOpen, setIsNicheDropdownOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [tempUserName, setTempUserName] = useState(userName);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsNicheDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems: { tab: AppTab; label: string; icon: React.ReactNode }[] = [
    { tab: 'kanban', label: 'Kanban & Pipeline', icon: <Kanban className="w-4 h-4" /> },
    { tab: 'dashboard', label: 'Dashboard & Funil', icon: <BarChart3 className="w-4 h-4" /> },
    { tab: 'scripts', label: 'Scripts & Prospecção', icon: <FileText className="w-4 h-4" /> },
    { tab: 'importer', label: 'Importador Inteligente', icon: <Upload className="w-4 h-4" /> },
    { tab: 'global', label: 'Visão Global da Agência', icon: <Globe className="w-4 h-4" /> },
  ];

  const handleSaveUserName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempUserName.trim()) {
      onUpdateUserName(tempUserName.trim());
      setIsUserModalOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-xs">
      {/* Top Bar Contract: 3 zones */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* ZONE 1: Single text element wordmark + subtle breadcrumb */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectTab('kanban')}
            className="flex items-center gap-2 group text-left cursor-pointer focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs transition-transform group-hover:scale-105">
              PF
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                ProspectFlow
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                CRM de Venda de Sites
              </span>
            </div>
          </button>

          <span className="text-slate-300 hidden md:inline">/</span>

          {/* Active Niche Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsNicheDropdownOpen(!isNicheDropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-slate-800 text-xs sm:text-sm font-medium transition-all cursor-pointer"
              title="Alternar nicho ou criar nova campanha"
            >
              <span className="text-base leading-none">{activeNiche.emoji}</span>
              <span className="max-w-[130px] sm:max-w-[200px] truncate text-slate-900 font-semibold">
                {activeNiche.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            </button>

            {isNicheDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    Nichos / Campanhas
                  </span>
                  <span className="text-[11px] text-slate-600 font-mono">
                    {niches.length} ativos
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto py-1">
                  {niches.map((niche) => {
                    const isCurrent = niche.id === activeNiche.id;
                    return (
                      <button
                        key={niche.id}
                        onClick={() => {
                          onSelectNiche(niche.id);
                          setIsNicheDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-blue-50 text-blue-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base">{niche.emoji}</span>
                          <div className="truncate">
                            <div className="truncate font-medium">{niche.name}</div>
                            <div className="text-[10px] text-slate-600 font-normal truncate">
                              {niche.city}
                            </div>
                          </div>
                        </div>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="p-1.5 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setIsNicheDropdownOpen(false);
                      onOpenNewNicheModal();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Novo Nicho / Campanha
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ZONE 2: 4-5 Clean Nav Tabs */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => onSelectTab(item.tab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ZONE 3: 1-2 Primary Actions & User Identity */}
        <div className="flex items-center gap-2">
          {/* Quick Add Lead Button */}
          <button
            onClick={onOpenNewLeadModal}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            title="Cadastrar novo lead manualmente"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">+ Novo Lead</span>
            <span className="sm:hidden">Lead</span>
          </button>

          {/* User Name Tag */}
          <button
            onClick={() => {
              setTempUserName(userName);
              setIsUserModalOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-medium transition-colors cursor-pointer"
            title="Nome usado para personalizar os scripts de WhatsApp"
          >
            <User className="w-3 h-3 text-slate-500" />
            <span className="max-w-[70px] truncate hidden sm:inline">{userName}</span>
          </button>
        </div>
      </div>

      {/* Mobile Nav Links bar */}
      <div className="lg:hidden px-4 py-2 border-t border-slate-100 flex items-center gap-1 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => onSelectTab(item.tab)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* User Name Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Configurar Nome do Vendedor
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Este nome será usado na variável <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">&#123;SeuNome&#125;</code> ao disparar mensagens pelo WhatsApp.
            </p>
            <form onSubmit={handleSaveUserName} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Seu Nome ou Nome da Agência
                </label>
                <input
                  type="text"
                  value={tempUserName}
                  onChange={(e) => setTempUserName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Gabriel"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                >
                  Salvar Nome
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
