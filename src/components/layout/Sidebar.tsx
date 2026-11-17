import React from 'react';
import {
  LayoutDashboard,
  Kanban,
  Users,
  FileSignature,
  FolderKanban,
  CheckSquare,
  Calendar,
  Share2,
  FolderOpen,
  FileText,
  Library,
  Wallet,
  BarChart3,
  Gauge,
  Settings,
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { AppTab } from '../../types/crm';
import {
  NAVIGATION_GROUPS,
  NAVIGATION_ITEMS,
  NavigationItem,
} from '../../config/navigation';
import { Tooltip } from '../ui/Tooltip';

interface SidebarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  agendaAlertsCount?: number;
}

const ICON_MAP: Record<NavigationItem['iconName'], React.FC<{ className?: string }>> = {
  LayoutDashboard,
  Kanban,
  Users,
  FileSignature,
  FolderKanban,
  CheckSquare,
  Calendar,
  Share2,
  FolderOpen,
  FileText,
  Library,
  Wallet,
  BarChart3,
  Gauge,
  Settings,
  Bot,
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  agendaAlertsCount = 0,
}) => {
  const isItemActive = (item: NavigationItem) => {
    if (item.id === activeTab) return true;
    return Boolean(item.matchTabs?.includes(activeTab));
  };

  const handleNavigate = (tab: AppTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const renderNavContent = (isCollapsedMode: boolean) => (
    <div className="flex flex-col h-full bg-[var(--kz-bg-sidebar)] border-r border-[var(--kz-border-subtle)] select-none">
      {/* Brand Bar */}
      <div
        className={`h-16 px-3.5 border-b border-[var(--kz-border-subtle)] flex items-center shrink-0 ${
          isCollapsedMode ? 'justify-center' : 'justify-between gap-2'
        }`}
      >
        <button
          type="button"
          onClick={() => handleNavigate('dashboard')}
          className={`flex items-center gap-2.5 text-left cursor-pointer group focus:outline-none ${
            isCollapsedMode ? 'justify-center' : 'min-w-0'
          }`}
          title="Kaizen — Sistema de Gestão Integrada"
        >
          <div className="w-8 h-8 rounded-lg bg-[#19191F] border border-[#C6A15B]/45 text-[#C6A15B] flex items-center justify-center font-extrabold text-sm tracking-tight shrink-0 shadow-[var(--kz-shadow-xs)] group-hover:border-[#C6A15B] group-hover:bg-[#C6A15B]/15 transition-colors">
            K
          </div>
          {!isCollapsedMode && (
            <div className="min-w-0">
              <div className="text-sm font-bold text-[var(--kz-text-primary)] tracking-tight leading-tight truncate">
                Kaizen
              </div>
              <div className="text-[10px] font-medium text-[var(--kz-text-subtle)] tracking-wide truncate">
                Gestão Integrada
              </div>
            </div>
          )}
        </button>

        {/* Desktop collapse toggle */}
        {!isCollapsedMode && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden md:inline-flex p-1.5 rounded-lg text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)] hover:bg-[var(--kz-bg-subtle)] transition-colors cursor-pointer"
            title="Recolher barra lateral"
            aria-label="Recolher barra lateral"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}

        {/* Mobile close button */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="md:hidden p-1.5 rounded-lg text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)] hover:bg-[var(--kz-bg-subtle)] cursor-pointer"
          aria-label="Fechar menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Expand button when collapsed on desktop */}
      {isCollapsedMode && (
        <div className="hidden md:flex justify-center py-2 border-b border-[var(--kz-border-subtle)]">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)] hover:bg-[var(--kz-bg-subtle)] transition-colors cursor-pointer"
            title="Expandir barra lateral"
            aria-label="Expandir barra lateral"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Scrollable Navigation Groups */}
      <nav
        aria-label="Navegação principal"
        className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 kanban-column-scroll"
      >
        {NAVIGATION_GROUPS.map((group) => {
          const items = NAVIGATION_ITEMS.filter((item) => item.group === group.id);
          return (
            <div key={group.id} className="space-y-1">
              {!isCollapsedMode ? (
                <div className="px-2.5 pb-1 kz-overline">{group.label}</div>
              ) : (
                <div className="mx-2 my-1 border-t border-[var(--kz-border-subtle)]" />
              )}

              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = ICON_MAP[item.iconName];
                  const active = isItemActive(item);
                  const showAgendaBadge = item.id === 'agenda' && agendaAlertsCount > 0;

                  const buttonEl = (
                    <button
                      type="button"
                      onClick={() => handleNavigate(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`w-full flex items-center gap-2.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kz-accent)] ${
                        isCollapsedMode ? 'justify-center px-2 py-2' : 'px-2.5 py-2'
                      } ${
                        active
                          ? 'bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] font-semibold shadow-[var(--kz-shadow-xs)] ring-1 ring-[var(--kz-accent-border)]'
                          : item.implemented
                          ? 'text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)] hover:text-[var(--kz-text-primary)]'
                          : 'text-[var(--kz-text-muted)] hover:bg-[var(--kz-bg-subtle)]/70 hover:text-[var(--kz-text-secondary)]'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          active
                            ? 'text-[var(--kz-accent)]'
                            : item.implemented
                            ? 'text-[var(--kz-text-muted)]'
                            : 'text-[var(--kz-text-subtle)]'
                        }`}
                      />

                      {!isCollapsedMode && (
                        <>
                          <span className="flex-1 text-left truncate">{item.label}</span>

                          {showAgendaBadge && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)] border border-[var(--kz-warning-border)]">
                              {agendaAlertsCount}
                            </span>
                          )}

                          {!item.implemented && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--kz-bg-subtle)] text-[var(--kz-text-subtle)] border border-[var(--kz-border-subtle)]">
                              Em breve
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );

                  return (
                    <div key={item.id}>
                      {isCollapsedMode ? (
                        <Tooltip
                          content={
                            item.implemented
                              ? item.label
                              : `${item.label} (Em desenvolvimento)`
                          }
                          position="right"
                        >
                          {buttonEl}
                        </Tooltip>
                      ) : (
                        buttonEl
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer note */}
      {!isCollapsedMode && (
        <div className="px-3.5 py-2.5 border-t border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)]/60 shrink-0">
          <div className="flex items-center justify-between text-[11px] text-[var(--kz-text-muted)]">
            <span className="font-semibold text-[var(--kz-text-secondary)]">Kaizen v1.0</span>
            <span className="font-mono text-[10px]">Uso Privado</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 transition-[width] duration-200 ease-out h-full ${
          collapsed ? 'w-[68px]' : 'w-[248px]'
        }`}
      >
        {renderNavContent(collapsed)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-[var(--kz-bg-overlay)] backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[272px] max-w-[85vw] h-full shadow-[var(--kz-shadow-lg)] animate-in slide-in-from-left duration-150">
            {renderNavContent(false)}
          </aside>
        </div>
      )}
    </>
  );
};
