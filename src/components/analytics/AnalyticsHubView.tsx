import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Briefcase,
  CheckSquare,
  Download,
  FileSpreadsheet,
  FolderKanban,
  Gauge,
  Settings,
  Share2,
  ShieldCheck,
  Sliders,
  Users,
  Wallet,
} from 'lucide-react';
import { AppTab, Lead, NicheCampaign } from '../../types/crm';
import {
  AgendaEvent,
  Client,
  Project,
  ProposalContract,
  SocialChannel,
  SocialPost,
  Task,
} from '../../types/kaizen';
import {
  FinancialAuditLog,
  FinancialCategory,
  FinancialEntry,
  FinancialRecurrence,
  FinancialSettings,
  FinancialTransaction,
} from '../../types/finance';
import { ResourceFile } from '../../types/resources';
import {
  ANALYTICS_PERIOD_OPTIONS,
  AnalyticsPeriodPreset,
  AnalyticsPreferences,
  AnalyticsSubTabId,
  GeneratedAnalyticsReport,
  SavedCustomReport,
} from '../../types/analytics';
import {
  buildActiveSubTabExportReport,
  computeExecutiveDashboardSnapshot,
  downloadAnalyticsReportCsv,
  downloadAnalyticsReportPdf,
} from '../../services/analytics';
import { KAIZEN_TIMEZONE, getTodayInTimezone } from '../../services/finance/money';
import { Alert, Button, Select, TabOption, Tabs } from '../ui';
import { AnalyticsOverviewTab } from './AnalyticsOverviewTab';
import { AnalyticsCommercialTab } from './AnalyticsCommercialTab';
import { AnalyticsFinancialTab } from './AnalyticsFinancialTab';
import { AnalyticsOperationalTab } from './AnalyticsOperationalTab';
import { AnalyticsClientsTab } from './AnalyticsClientsTab';
import { AnalyticsProjectsTab } from './AnalyticsProjectsTab';
import { AnalyticsSocialTab } from './AnalyticsSocialTab';
import { AnalyticsProductivityTab } from './AnalyticsProductivityTab';
import { AnalyticsCustomReportsTab } from './AnalyticsCustomReportsTab';
import { AnalyticsSettingsModal } from './AnalyticsSettingsModal';

export interface AnalyticsHubViewProps {
  leads: Lead[];
  niches: NicheCampaign[];
  clients: Client[];
  proposals: ProposalContract[];
  projects: Project[];
  tasks: Task[];
  agendaEvents: AgendaEvent[];
  socialChannels: SocialChannel[];
  socialPosts: SocialPost[];
  financialEntries: FinancialEntry[];
  financialTransactions: FinancialTransaction[];
  financialCategories: FinancialCategory[];
  financialRecurrences: FinancialRecurrence[];
  financialSettings: FinancialSettings;
  financialAuditLogs: FinancialAuditLog[];
  resourceFiles: ResourceFile[];
  savedReports: SavedCustomReport[];
  preferences: AnalyticsPreferences;
  cloudPermissionBlocked?: boolean;
  onSaveCustomReport: (report: SavedCustomReport) => Promise<void>;
  onDeleteCustomReport: (reportId: string) => Promise<void>;
  onToggleFavoriteCustomReport: (report: SavedCustomReport) => Promise<void>;
  onSavePreferences: (prefs: AnalyticsPreferences) => Promise<void>;
  onNavigateTab: (tab: AppTab) => void;
  onOpenClient: (clientId: string) => void;
  onOpenProject: (projectId: string) => void;
}

const SUB_TABS: TabOption<AnalyticsSubTabId>[] = [
  { id: 'visao_geral', label: 'Visão Geral', icon: <Gauge className="w-3.5 h-3.5" /> },
  { id: 'comercial', label: 'Comercial', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: 'financeiro', label: 'Financeiro', icon: <Wallet className="w-3.5 h-3.5" /> },
  { id: 'operacional', label: 'Operacional', icon: <CheckSquare className="w-3.5 h-3.5" /> },
  { id: 'clientes', label: 'Clientes', icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'projetos', label: 'Projetos', icon: <FolderKanban className="w-3.5 h-3.5" /> },
  { id: 'redes_sociais', label: 'Redes Sociais', icon: <Share2 className="w-3.5 h-3.5" /> },
  { id: 'produtividade', label: 'Produtividade', icon: <Activity className="w-3.5 h-3.5" /> },
  { id: 'personalizados', label: 'Personalizados', icon: <Sliders className="w-3.5 h-3.5" /> },
];

export const AnalyticsHubView: React.FC<AnalyticsHubViewProps> = ({
  leads,
  niches,
  clients,
  proposals,
  projects,
  tasks,
  agendaEvents,
  socialChannels,
  socialPosts,
  financialEntries,
  financialTransactions,
  financialCategories,
  financialRecurrences,
  financialSettings,
  financialAuditLogs,
  resourceFiles,
  savedReports,
  preferences,
  cloudPermissionBlocked = false,
  onSaveCustomReport,
  onDeleteCustomReport,
  onToggleFavoriteCustomReport,
  onSavePreferences,
  onNavigateTab,
  onOpenClient,
  onOpenProject,
}) => {
  const todayStr = getTodayInTimezone(financialSettings.timezone || KAIZEN_TIMEZONE);

  const [subTab, setSubTab] = useState<AnalyticsSubTabId>(
    preferences.preferredSubTab || 'visao_geral'
  );
  const [periodPreset, setPeriodPreset] = useState<AnalyticsPeriodPreset>(
    preferences.defaultPeriodPreset || 'este_mes'
  );
  const [customStart, setCustomStart] = useState<string>(todayStr);
  const [customEnd, setCustomEnd] = useState<string>(todayStr);
  const [commercialNicheFilter, setCommercialNicheFilter] = useState<string>('');
  const [activeCustomReport, setActiveCustomReport] =
    useState<GeneratedAnalyticsReport | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => {
      setFeedback((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const snapshot = useMemo(
    () =>
      computeExecutiveDashboardSnapshot({
        leads,
        niches,
        clients,
        proposals,
        projects,
        tasks,
        agendaEvents,
        socialChannels,
        socialPosts,
        financialEntries,
        financialTransactions,
        financialCategories,
        financialRecurrences,
        financialSettings,
        financialAuditLogs,
        resourceFiles,
        preset: periodPreset,
        customStart,
        customEnd,
        todayStr,
        nicheIdFilter:
          subTab === 'comercial' && commercialNicheFilter ? commercialNicheFilter : undefined,
      }),
    [
      leads,
      niches,
      clients,
      proposals,
      projects,
      tasks,
      agendaEvents,
      socialChannels,
      socialPosts,
      financialEntries,
      financialTransactions,
      financialCategories,
      financialRecurrences,
      financialSettings,
      financialAuditLogs,
      resourceFiles,
      periodPreset,
      customStart,
      customEnd,
      todayStr,
      subTab,
      commercialNicheFilter,
    ]
  );

  const handleToggleFavoriteKpi = async (kpiId: string) => {
    const exists = preferences.favoriteKpis.includes(kpiId);
    const nextList = exists
      ? preferences.favoriteKpis.filter((id) => id !== kpiId)
      : [...preferences.favoriteKpis, kpiId];
    await onSavePreferences({
      ...preferences,
      favoriteKpis: nextList,
      updatedAt: new Date().toISOString(),
    });
  };

  const getReportForCurrentView = (): GeneratedAnalyticsReport | null => {
    if (subTab === 'personalizados') {
      return activeCustomReport;
    }
    return buildActiveSubTabExportReport(subTab, snapshot);
  };

  const handleExportPdf = () => {
    const report = getReportForCurrentView();
    if (!report) return;
    const filename = downloadAnalyticsReportPdf(report);
    showFeedback(`PDF gerencial exportado: ${filename}`);
  };

  const handleExportCsv = () => {
    const report = getReportForCurrentView();
    if (!report) return;
    const filename = downloadAnalyticsReportCsv(report);
    showFeedback(`CSV exportado: ${filename}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header Executiva & Controles Globais */}
      <div className="border-b border-[var(--kz-border-subtle)] pb-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Briefcase className="w-4 h-4 text-[var(--kz-accent)]" />
            <span className="kz-overline text-[var(--kz-accent-text)]">
              ETAPA 6 — INTELIGÊNCIA DE GESTÃO
            </span>
          </div>
          <h2 className="kz-page-title">Relatórios, Produtividade e Inteligência de Gestão</h2>
          <p className="kz-subtitle">
            Consolidação analítica em tempo real de comercial, financeiro, entregas, clientes e ritmo operacional.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {subTab !== 'personalizados' && (
            <>
              <div className="w-44">
                <Select
                  label="Período Analisado"
                  value={periodPreset}
                  onChange={(e) => setPeriodPreset(e.target.value as AnalyticsPeriodPreset)}
                >
                  {ANALYTICS_PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              {periodPreset === 'personalizado' && (
                <div className="flex items-end gap-1.5">
                  <div>
                    <label className="block kz-label mb-1">Início</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="h-9 px-2.5 text-xs bg-[var(--kz-bg-subtle)] text-[var(--kz-text-primary)] border border-[var(--kz-border-default)] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block kz-label mb-1">Fim</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="h-9 px-2.5 text-xs bg-[var(--kz-bg-subtle)] text-[var(--kz-text-primary)] border border-[var(--kz-border-default)] rounded-lg"
                    />
                  </div>
                </div>
              )}

              {subTab === 'comercial' && niches.length > 0 && (
                <div className="w-44">
                  <Select
                    label="Campanha / Nicho"
                    value={commercialNicheFilter}
                    onChange={(e) => setCommercialNicheFilter(e.target.value)}
                  >
                    <option value="">Todos os nichos</option>
                    {niches.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.emoji} {n.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </>
          )}

          <Button
            variant="outline"
            size="md"
            leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
            onClick={handleExportCsv}
            disabled={subTab === 'personalizados' && !activeCustomReport}
          >
            CSV
          </Button>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExportPdf}
            disabled={subTab === 'personalizados' && !activeCustomReport}
          >
            Exportar PDF
          </Button>
          <Button
            variant="secondary"
            size="md"
            leftIcon={<Settings className="w-3.5 h-3.5" />}
            onClick={() => setIsSettingsOpen(true)}
            title="Configurar preferências e KPIs"
          >
            Personalizar
          </Button>
          <Button
            variant="ghost"
            size="md"
            leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
            onClick={() => onNavigateTab('global')}
            title="Abrir painel comparativo de nichos e Backup v3.0"
          >
            Governança & Backup
          </Button>
        </div>
      </div>

      {cloudPermissionBlocked && (
        <Alert variant="warning" title="Modo local ativo para Modelos e Preferências de Relatórios">
          As preferências e modelos salvos estão sendo mantidos localmente neste navegador até que as regras de segurança atualizadas do Firestore sejam publicadas. Os dados operacionais continuam sincronizados normalmente.
        </Alert>
      )}

      {feedback && (
        <Alert variant="success" onDismiss={() => setFeedback(null)}>
          {feedback}
        </Alert>
      )}

      {/* Sub-navegação das 9 Áreas */}
      <Tabs items={SUB_TABS} activeId={subTab} onChange={setSubTab} variant="underline" />

      {/* Conteúdo da Sub-aba Ativa */}
      {subTab === 'visao_geral' && (
        <AnalyticsOverviewTab
          snapshot={snapshot}
          preferences={preferences}
          onToggleFavoriteKpi={handleToggleFavoriteKpi}
          onSelectSubTab={setSubTab}
          onNavigateTab={onNavigateTab}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {subTab === 'comercial' && (
        <AnalyticsCommercialTab
          commercial={snapshot.commercial}
          preferences={preferences}
          onNavigateTab={onNavigateTab}
        />
      )}

      {subTab === 'financeiro' && (
        <AnalyticsFinancialTab
          financial={snapshot.financial}
          preferences={preferences}
          onNavigateTab={onNavigateTab}
        />
      )}

      {subTab === 'operacional' && (
        <AnalyticsOperationalTab
          operational={snapshot.operational}
          preferences={preferences}
          onNavigateTab={onNavigateTab}
        />
      )}

      {subTab === 'clientes' && (
        <AnalyticsClientsTab
          clientsAnalytics={snapshot.clients}
          preferences={preferences}
          onOpenClient={onOpenClient}
          onNavigateTab={onNavigateTab}
        />
      )}

      {subTab === 'projetos' && (
        <AnalyticsProjectsTab
          operational={snapshot.operational}
          preferences={preferences}
          onOpenProject={onOpenProject}
          onNavigateTab={onNavigateTab}
        />
      )}

      {subTab === 'redes_sociais' && (
        <AnalyticsSocialTab
          social={snapshot.social}
          preferences={preferences}
          onNavigateTab={onNavigateTab}
        />
      )}

      {subTab === 'produtividade' && (
        <AnalyticsProductivityTab
          productivity={snapshot.productivity}
          preferences={preferences}
        />
      )}

      {subTab === 'personalizados' && (
        <AnalyticsCustomReportsTab
          leads={leads}
          niches={niches}
          clients={clients}
          proposals={proposals}
          projects={projects}
          tasks={tasks}
          agendaEvents={agendaEvents}
          socialPosts={socialPosts}
          financialEntries={financialEntries}
          financialTransactions={financialTransactions}
          financialCategories={financialCategories}
          financialSettings={financialSettings}
          resourceFiles={resourceFiles}
          savedReports={savedReports}
          preferences={preferences}
          onSaveCustomReport={onSaveCustomReport}
          onDeleteCustomReport={onDeleteCustomReport}
          onToggleFavoriteCustomReport={onToggleFavoriteCustomReport}
          onActiveReportChange={setActiveCustomReport}
          onFeedback={showFeedback}
        />
      )}

      <AnalyticsSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        preferences={preferences}
        onSave={onSavePreferences}
      />
    </div>
  );
};
