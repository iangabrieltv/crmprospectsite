import React from 'react';
import { Kanban, List, Upload, BarChart3 } from 'lucide-react';
import { AppTab } from '../types/crm';
import { Tabs, TabOption } from './ui/Tabs';

interface CrmSubNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  leadsCount: number;
  importedSheetsCount: number;
}

export const CrmSubNav: React.FC<CrmSubNavProps> = ({
  activeTab,
  onSelectTab,
  leadsCount,
  importedSheetsCount,
}) => {
  const crmTabs: TabOption<AppTab>[] = [
    {
      id: 'kanban',
      label: 'Pipeline (Kanban)',
      icon: <Kanban className="w-3.5 h-3.5" />,
      badge: leadsCount,
    },
    {
      id: 'leads_list',
      label: 'Lista de Leads',
      icon: <List className="w-3.5 h-3.5" />,
      badge: leadsCount,
    },
    {
      id: 'importer',
      label: 'Importar Planilha',
      icon: <Upload className="w-3.5 h-3.5" />,
      badge: importedSheetsCount > 0 ? importedSheetsCount : undefined,
    },
    {
      id: 'global',
      label: 'Campanhas & Relatórios',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="bg-[var(--kz-bg-surface)] border-b border-[var(--kz-border-subtle)] px-3 sm:px-6 py-2 flex items-center justify-between gap-3 shrink-0">
      <Tabs
        items={crmTabs}
        activeId={activeTab}
        onChange={onSelectTab}
        variant="segmented"
      />
    </div>
  );
};
