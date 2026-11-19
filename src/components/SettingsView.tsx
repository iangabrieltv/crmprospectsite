import React, { useMemo, useState } from 'react';
import {
  User,
  ShieldCheck,
  Database,
  CheckCircle2,
  ArrowUpRight,
  Trash2,
  Plug,
  Palette,
  Sliders,
  ScrollText,
  Download,
  RefreshCw,
  Bell,
  Zap,
  Sparkles,
  Lock,
  Globe,
  Search,
  LayoutDashboard,
} from 'lucide-react';
import { auth } from '../utils/firebase';
import { WORKSPACE_ID } from '../config/env';
import { AppTab, NicheCampaign, Lead, ImportedSheet } from '../types/crm';
import {
  AutomationRuleSetting,
  IntegrationStatusItem,
  SystemLogEntry,
  SystemLogLevel,
  SystemLogSource,
  SystemNotification,
  SystemSettings,
} from '../types/system';
import {
  GeminiStatusProbe,
  checkSystemIntegrationsStatus,
} from '../services/system/integrationsService';
import { normalizeSystemSettings } from '../services/system/settingsService';
import { sanitizeSensitiveText } from '../services/system/logSanitizerService';
import { loadLastBackupTimestamp } from '../utils/storage';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Select,
  Button,
  Badge,
  Alert,
  Tabs,
  EmptyState,
  ConfirmDialog,
} from './ui';

type SettingsSubTab =
  | 'visao_geral'
  | 'perfil_marca'
  | 'preferencias'
  | 'integracoes'
  | 'logs'
  | 'backup';

interface SettingsViewProps {
  userName: string;
  onUpdateUserName: (name: string) => void;
  systemSettings: SystemSettings;
  onSaveSystemSettings: (next: SystemSettings) => Promise<void> | void;
  notifications?: SystemNotification[];
  automationRules?: AutomationRuleSetting[];
  systemLogs?: SystemLogEntry[];
  geminiStatus?: GeminiStatusProbe | null;
  onRefreshIntegrations?: () => Promise<void> | void;
  onRunAllAutomations?: () => Promise<void> | void;
  niches: NicheCampaign[];
  leads: Lead[];
  importedSheets: ImportedSheet[];
  clientsCount?: number;
  proposalsCount?: number;
  projectsCount?: number;
  tasksCount?: number;
  financialEntriesCount?: number;
  isCloudSynced: boolean;
  syncStatus: 'synced' | 'saving' | 'error';
  onNavigate: (tab: AppTab) => void;
  onClearAllContacts?: () => Promise<void>;
}

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getIntegrationBadge(status: IntegrationStatusItem['status']): {
  variant: 'success' | 'neutral' | 'warning' | 'danger';
  label: string;
} {
  switch (status) {
    case 'conectado':
      return { variant: 'success', label: 'Conectado' };
    case 'nao_configurado':
      return { variant: 'neutral', label: 'Não configurado' };
    case 'indisponivel':
      return { variant: 'warning', label: 'Indisponível' };
    case 'erro':
      return { variant: 'danger', label: 'Erro' };
  }
}

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  id,
  label,
  description,
  checked,
  disabled = false,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)]">
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="text-xs font-semibold text-[var(--kz-text-primary)] block cursor-pointer"
      >
        {label}
      </label>
      <p className="text-[11px] text-[var(--kz-text-muted)] mt-0.5">{description}</p>
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kz-accent)] disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-[var(--kz-accent)]' : 'bg-[var(--kz-bg-muted)] border-[var(--kz-border-default)]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[var(--kz-bg-canvas)] shadow-sm transition duration-150 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

export const SettingsView: React.FC<SettingsViewProps> = ({
  userName,
  onUpdateUserName,
  systemSettings,
  onSaveSystemSettings,
  notifications = [],
  automationRules = [],
  systemLogs = [],
  geminiStatus = null,
  onRefreshIntegrations,
  onRunAllAutomations,
  niches,
  leads,
  importedSheets,
  clientsCount = 0,
  proposalsCount = 0,
  projectsCount = 0,
  tasksCount = 0,
  financialEntriesCount = 0,
  isCloudSynced,
  syncStatus,
  onNavigate,
  onClearAllContacts,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('visao_geral');

  // Profile & Brand form state
  const [displayName, setDisplayName] = useState(
    systemSettings.adminProfile.displayName || userName
  );
  const [contactEmail, setContactEmail] = useState(
    systemSettings.adminProfile.contactEmail || ''
  );
  const [photoUrl, setPhotoUrl] = useState(systemSettings.adminProfile.photoUrl || '');
  const [agencyName, setAgencyName] = useState(
    systemSettings.adminProfile.agencyName || 'Agência Kaizen'
  );
  const [commercialPhone, setCommercialPhone] = useState(
    systemSettings.adminProfile.commercialPhone || ''
  );
  const [websiteUrl, setWebsiteUrl] = useState(systemSettings.adminProfile.websiteUrl || '');
  const [issuerDocument, setIssuerDocument] = useState(
    systemSettings.adminProfile.issuerDocument || ''
  );

  const [brandName, setBrandName] = useState(systemSettings.visualIdentity.brandName || 'Kaizen');
  const [primaryLogoUrl, setPrimaryLogoUrl] = useState(
    systemSettings.visualIdentity.primaryLogoUrl || ''
  );
  const [compactLogoUrl, setCompactLogoUrl] = useState(
    systemSettings.visualIdentity.compactLogoUrl || ''
  );
  const [primaryColor, setPrimaryColor] = useState(
    systemSettings.visualIdentity.primaryColor || '#C6A15B'
  );
  const [secondaryColor, setSecondaryColor] = useState(
    systemSettings.visualIdentity.secondaryColor || '#A98B50'
  );

  const [preferences, setPreferences] = useState(systemSettings.preferences);
  const [isSaving, setIsSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Integrations check state
  const [isRefreshingIntegrations, setIsRefreshingIntegrations] = useState(false);

  // Logs filter state
  const [logLevelFilter, setLogLevelFilter] = useState<'all' | SystemLogLevel>('all');
  const [logSourceFilter, setLogSourceFilter] = useState<'all' | SystemLogSource>('all');
  const [logSearch, setLogSearch] = useState('');

  // Clear Base modal state
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearError, setClearError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const adminEmail = auth.currentUser?.email || 'Sessão administrativa autenticada';
  const adminUid = auth.currentUser?.uid || null;
  const lastBackupAt = loadLastBackupTimestamp();

  const integrations = useMemo(
    () =>
      checkSystemIntegrationsStatus({
        authUserEmail: auth.currentUser?.email || null,
        authUid: adminUid,
        isCloudSynced,
        syncStatus,
        geminiProbe: geminiStatus,
      }),
    [adminUid, isCloudSynced, syncStatus, geminiStatus]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read && !n.dismissed).length,
    [notifications]
  );
  const enabledAutomationsCount = useMemo(
    () => automationRules.filter((r) => r.enabled).length,
    [automationRules]
  );

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return systemLogs.filter((log) => {
      if (logLevelFilter !== 'all' && log.level !== logLevelFilter) return false;
      if (logSourceFilter !== 'all' && log.source !== logSourceFilter) return false;
      if (!q) return true;
      return (
        log.title.toLowerCase().includes(q) ||
        log.message.toLowerCase().includes(q) ||
        log.source.toLowerCase().includes(q)
      );
    });
  }, [systemLogs, logLevelFilter, logSourceFilter, logSearch]);

  const showSavedToast = (msg: string) => {
    setSavedFeedback(msg);
    setSaveError(null);
    setTimeout(() => setSavedFeedback(null), 4000);
  };

  const handleSaveProfileAndBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedDisplay = displayName.trim() || userName || 'Ian';
    setIsSaving(true);
    setSaveError(null);
    try {
      const next = normalizeSystemSettings(
        {
          ...systemSettings,
          adminProfile: {
            displayName: cleanedDisplay,
            contactEmail: contactEmail.trim(),
            photoUrl: photoUrl.trim(),
            agencyName: agencyName.trim() || 'Agência Kaizen',
            commercialPhone: commercialPhone.trim(),
            websiteUrl: websiteUrl.trim(),
            issuerDocument: issuerDocument.trim(),
          },
          visualIdentity: {
            brandName: brandName.trim() || 'Kaizen',
            primaryLogoUrl: primaryLogoUrl.trim(),
            compactLogoUrl: compactLogoUrl.trim(),
            primaryColor,
            secondaryColor,
            appearanceMode: 'premium_dark',
          },
          preferences,
          updatedAt: new Date().toISOString(),
        },
        cleanedDisplay
      );
      await onSaveSystemSettings(next);
      onUpdateUserName(next.adminProfile.displayName);
      showSavedToast('Perfil, marca e assinatura comercial salvos no Firestore.');
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Falha ao salvar configurações.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreferences = async (nextPrefs = preferences) => {
    setPreferences(nextPrefs);
    setIsSaving(true);
    setSaveError(null);
    try {
      const next = normalizeSystemSettings(
        {
          ...systemSettings,
          preferences: nextPrefs,
          updatedAt: new Date().toISOString(),
        },
        userName
      );
      await onSaveSystemSettings(next);
      showSavedToast('Preferências operacionais atualizadas.');
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Falha ao atualizar preferências.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshIntegrationsClick = async () => {
    if (!onRefreshIntegrations) return;
    setIsRefreshingIntegrations(true);
    try {
      await onRefreshIntegrations();
      showSavedToast('Status real das integrações verificado.');
    } finally {
      setIsRefreshingIntegrations(false);
    }
  };

  const handleExportLogsJson = () => {
    const sanitized = filteredLogs.map((l) => ({
      ...l,
      title: sanitizeSensitiveText(l.title, 160),
      message: sanitizeSensitiveText(l.message, 800),
    }));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadTextFile(
      `kaizen_system_logs_${stamp}.json`,
      JSON.stringify(sanitized, null, 2),
      'application/json'
    );
  };

  const handleExportLogsTxt = () => {
    const lines = filteredLogs.map(
      (l) =>
        `[${l.createdAt}] [${l.level.toUpperCase()}] [${l.source}] ${sanitizeSensitiveText(
          l.title,
          160
        )} — ${sanitizeSensitiveText(l.message, 800)}`
    );
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadTextFile(
      `kaizen_system_logs_${stamp}.txt`,
      lines.join('\n') || 'Nenhum evento registrado.',
      'text/plain;charset=utf-8'
    );
  };

  const handleConfirmClear = async () => {
    if (!onClearAllContacts) return;
    setIsClearing(true);
    setClearError(null);
    try {
      await onClearAllContacts();
      setIsClearOpen(false);
      setClearConfirmText('');
    } catch (err) {
      setClearError(
        err instanceof Error
          ? `Falha ao zerar banco: ${err.message}`
          : 'Erro ao zerar banco na nuvem.'
      );
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--kz-border-subtle)] pb-5">
        <div className="space-y-1">
          <h2 className="kz-page-title">Configurações & Governança do Sistema</h2>
          <p className="kz-subtitle">
            Administração privada do workspace Kaizen: perfil do administrador, marca institucional, preferências, integrações reais, logs e backup.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="success" dot>
            Uso exclusivo do administrador
          </Badge>
          <Badge
            variant={
              syncStatus === 'error'
                ? 'danger'
                : syncStatus === 'saving'
                ? 'info'
                : isCloudSynced
                ? 'success'
                : 'warning'
            }
            dot
          >
            {syncStatus === 'error'
              ? 'Erro de Sync'
              : syncStatus === 'saving'
              ? 'Salvando...'
              : isCloudSynced
              ? 'Firestore Conectado'
              : 'Conectando...'}
          </Badge>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <Tabs<SettingsSubTab>
        activeId={activeSubTab}
        onChange={setActiveSubTab}
        items={[
          { id: 'visao_geral', label: 'Visão Geral', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
          { id: 'perfil_marca', label: 'Perfil & Marca', icon: <Palette className="w-3.5 h-3.5" /> },
          { id: 'preferencias', label: 'Preferências', icon: <Sliders className="w-3.5 h-3.5" /> },
          { id: 'integracoes', label: 'Integrações', icon: <Plug className="w-3.5 h-3.5" /> },
          {
            id: 'logs',
            label: 'Logs & Monitoramento',
            icon: <ScrollText className="w-3.5 h-3.5" />,
            badge: systemLogs.length,
          },
          { id: 'backup', label: 'Backup & Governança', icon: <Database className="w-3.5 h-3.5" /> },
        ]}
      />

      {savedFeedback && (
        <Alert variant="success" onDismiss={() => setSavedFeedback(null)}>
          {savedFeedback}
        </Alert>
      )}
      {saveError && (
        <Alert variant="danger" onDismiss={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}

      {/* TAB 1: VISÃO GERAL */}
      {activeSubTab === 'visao_geral' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card padding="sm">
              <div className="text-[11px] font-semibold text-[var(--kz-text-muted)]">
                Workspace & Autenticação
              </div>
              <div className="mt-2 text-sm font-mono font-bold text-[var(--kz-text-primary)] truncate">
                {WORKSPACE_ID}
              </div>
              <div className="mt-1 text-[11px] text-[var(--kz-text-muted)] truncate">
                {adminEmail}
              </div>
            </Card>

            <Card padding="sm">
              <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
                <span>Assistente IA (Servidor)</span>
                <Sparkles className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge
                  variant={
                    geminiStatus?.configured
                      ? 'success'
                      : geminiStatus?.reachable
                      ? 'warning'
                      : 'neutral'
                  }
                  dot
                >
                  {geminiStatus?.configured
                    ? 'Gemini Ativo'
                    : geminiStatus?.reachable
                    ? 'Sem GEMINI_API_KEY'
                    : 'Verificando'}
                </Badge>
              </div>
              <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
                Sugestões determinísticas sempre ativas
              </div>
            </Card>

            <Card padding="sm">
              <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
                <span>Central de Notificações</span>
                <Bell className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
              </div>
              <div className="mt-2 text-2xl kz-metric text-[var(--kz-text-primary)]">
                {unreadNotificationsCount}
              </div>
              <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
                Não lida(s) · {notifications.length} total ativa(s)
              </div>
            </Card>

            <Card padding="sm">
              <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
                <span>Regras de Automação</span>
                <Zap className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
              </div>
              <div className="mt-2 text-2xl kz-metric text-[var(--kz-text-primary)]">
                {enabledAutomationsCount}/{automationRules.length || 11}
              </div>
              <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
                Execução manual ou na abertura
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card padding="lg" className="lg:col-span-2 space-y-4">
              <CardHeader>
                <div>
                  <CardTitle>Resumo da Base Operacional Sincronizada</CardTitle>
                  <CardDescription>
                    Contagem real dos documentos carregados no workspace privado da agência.
                  </CardDescription>
                </div>
              </CardHeader>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/60 border border-[var(--kz-border-subtle)]">
                  <div className="text-[var(--kz-text-muted)] text-[11px]">Nichos / Leads</div>
                  <div className="font-mono font-bold text-sm text-[var(--kz-text-primary)] mt-1">
                    {niches.length} / {leads.length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/60 border border-[var(--kz-border-subtle)]">
                  <div className="text-[var(--kz-text-muted)] text-[11px]">Clientes / Propostas</div>
                  <div className="font-mono font-bold text-sm text-[var(--kz-text-primary)] mt-1">
                    {clientsCount} / {proposalsCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/60 border border-[var(--kz-border-subtle)]">
                  <div className="text-[var(--kz-text-muted)] text-[11px]">Projetos / Tarefas</div>
                  <div className="font-mono font-bold text-sm text-[var(--kz-text-primary)] mt-1">
                    {projectsCount} / {tasksCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/60 border border-[var(--kz-border-subtle)]">
                  <div className="text-[var(--kz-text-muted)] text-[11px]">Financeiro / Planilhas</div>
                  <div className="font-mono font-bold text-sm text-[var(--kz-text-primary)] mt-1">
                    {financialEntriesCount} / {importedSheets.length}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--kz-border-subtle)]">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                  onClick={() => onNavigate('ai_assistant')}
                >
                  Abrir Assistente IA
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Zap className="w-3.5 h-3.5" />}
                  onClick={() => onNavigate('automations')}
                >
                  Abrir Automações
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Bell className="w-3.5 h-3.5" />}
                  onClick={() => onNavigate('notifications')}
                >
                  Central de Notificações
                </Button>
                {onRunAllAutomations && (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={onRunAllAutomations}
                  >
                    Executar Checagens Agora
                  </Button>
                )}
              </div>
            </Card>

            <Card padding="lg" className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--kz-text-primary)]">
                <Lock className="w-4 h-4 text-[var(--kz-accent)]" />
                <span>Padrões Bloqueados de Governança</span>
              </div>
              <div className="space-y-2 text-xs text-[var(--kz-text-secondary)]">
                <div className="p-2.5 rounded-lg bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] flex items-center justify-between">
                  <span>Identidade Visual</span>
                  <Badge variant="accent" size="sm">Premium Dark</Badge>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] flex items-center justify-between">
                  <span>Moeda & Idioma</span>
                  <span className="font-mono font-bold text-[var(--kz-text-primary)]">BRL · pt-BR</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] flex items-center justify-between">
                  <span>Fuso Horário</span>
                  <span className="font-mono text-[var(--kz-text-primary)]">America/Maceio</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] flex items-center justify-between">
                  <span>Modo de Acesso</span>
                  <span className="font-semibold text-[var(--kz-success-text)]">Admin Único</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: PERFIL & MARCA */}
      {activeSubTab === 'perfil_marca' && (
        <form onSubmit={handleSaveProfileAndBrand} className="space-y-6">
          <Card padding="lg" className="space-y-4">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle>Perfil do Administrador & Assinatura Comercial</CardTitle>
                  <CardDescription>
                    Esses dados alimentam a variável {'{SeuNome}'} dos scripts, o emissor das propostas/contratos e o cabeçalho dos PDFs.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nome de Exibição ({SeuNome}) *"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex: Ian"
                required
              />
              <Input
                label="Login Firebase Auth (somente leitura)"
                value={adminEmail}
                readOnly
                disabled
                helperText="O e-mail de login do Firebase Auth não é alterado por aqui."
              />
              <Input
                label="Nome Comercial da Agência *"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Ex: Agência Kaizen"
                required
              />
              <Input
                label="CNPJ / CPF do Emissor (PDF e Contratos)"
                value={issuerDocument}
                onChange={(e) => setIssuerDocument(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="font-mono"
              />
              <Input
                label="Telefone / WhatsApp Comercial"
                value={commercialPhone}
                onChange={(e) => setCommercialPhone(e.target.value)}
                placeholder="+55 82 99999-9999"
                className="font-mono"
              />
              <Input
                label="E-mail Comercial de Contato"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contato@kaizen.com.br"
              />
              <Input
                label="Site / Portfólio da Agência"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://kaizen.com.br"
              />
              <Input
                label="URL da Foto / Avatar do Administrador (opcional)"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </Card>

          <Card padding="lg" className="space-y-4">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--kz-bg-subtle)] text-[var(--kz-accent-text)] flex items-center justify-center">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle>Identidade Visual & Aparência</CardTitle>
                  <CardDescription>
                    Personalização da marca Kaizen preservando o tema oficial Premium Dark.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="accent" size="md">
                <Lock className="w-3 h-3" />
                Premium Dark Fixo
              </Badge>
            </CardHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nome da Marca na Barra Lateral *"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Kaizen"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Cor Primária (Hex)"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="font-mono"
                  placeholder="#C6A15B"
                />
                <Input
                  label="Cor Secundária (Hex)"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="font-mono"
                  placeholder="#A98B50"
                />
              </div>
              <Input
                label="URL da Logo Principal (opcional)"
                value={primaryLogoUrl}
                onChange={(e) => setPrimaryLogoUrl(e.target.value)}
                placeholder="https://..."
              />
              <Input
                label="URL do Ícone / Logo Compacta (opcional)"
                value={compactLogoUrl}
                onChange={(e) => setCompactLogoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)]">
                O modo visual permanece em Premium Dark para preservar a legibilidade executiva de todo o sistema.
              </span>
              <Button type="submit" variant="primary" size="md" loading={isSaving}>
                Salvar Perfil & Marca
              </Button>
            </div>
          </Card>
        </form>
      )}

      {/* TAB 3: PREFERÊNCIAS */}
      {activeSubTab === 'preferencias' && (
        <div className="space-y-6">
          <Card padding="lg" className="space-y-4">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--kz-bg-subtle)] text-[var(--kz-text-secondary)] flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle>Preferências Regionais (Padronizadas)</CardTitle>
                  <CardDescription>
                    Configurações fixas de moeda, formato de data e fuso horário para garantir consistência nos lançamentos financeiros e prazos.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Input label="Moeda Padrão" value="BRL (R$)" readOnly disabled className="font-mono" />
              <Input label="Formato de Data" value="DD/MM/YYYY" readOnly disabled className="font-mono" />
              <Input label="Fuso Horário" value="America/Maceio" readOnly disabled className="font-mono" />
              <Input label="Idioma" value="pt-BR" readOnly disabled className="font-mono" />
            </div>
          </Card>

          <Card padding="lg" className="space-y-4">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle>Preferências de Notificações, Automações e IA</CardTitle>
                  <CardDescription>
                    Controle quais alertas são exibidos na Central de Notificações e o comportamento de inicialização.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <div className="space-y-2.5">
              <ToggleRow
                id="pref-enable-notifications"
                label="Ativar Central de Notificações"
                description="Controla a geração de alertas na barra superior e na Central de Notificações."
                checked={preferences.enableNotifications}
                disabled={isSaving}
                onChange={(val) =>
                  handleSavePreferences({ ...preferences, enableNotifications: val })
                }
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-0 sm:pl-4">
                <ToggleRow
                  id="pref-notify-comercial"
                  label="Alertas Comerciais"
                  description="Leads parados no funil e propostas aguardando retorno."
                  checked={preferences.notifyComercial}
                  disabled={isSaving || !preferences.enableNotifications}
                  onChange={(val) =>
                    handleSavePreferences({ ...preferences, notifyComercial: val })
                  }
                />
                <ToggleRow
                  id="pref-notify-operacional"
                  label="Alertas Operacionais"
                  description="Tarefas próximas/vencidas e projetos com prazo crítico."
                  checked={preferences.notifyOperacional}
                  disabled={isSaving || !preferences.enableNotifications}
                  onChange={(val) =>
                    handleSavePreferences({ ...preferences, notifyOperacional: val })
                  }
                />
                <ToggleRow
                  id="pref-notify-financeiro"
                  label="Alertas Financeiros"
                  description="Contas a receber ou pagar vencidas ou próximas do vencimento."
                  checked={preferences.notifyFinanceiro}
                  disabled={isSaving || !preferences.enableNotifications}
                  onChange={(val) =>
                    handleSavePreferences({ ...preferences, notifyFinanceiro: val })
                  }
                />
                <ToggleRow
                  id="pref-notify-agenda"
                  label="Alertas da Agenda"
                  description="Retornos comerciais (callbacks), reuniões e eventos do dia."
                  checked={preferences.notifyAgenda}
                  disabled={isSaving || !preferences.enableNotifications}
                  onChange={(val) =>
                    handleSavePreferences({ ...preferences, notifyAgenda: val })
                  }
                />
              </div>

              <ToggleRow
                id="pref-autorun-open"
                label="Executar checagens de automação ao abrir o sistema"
                description="Roda apenas as regras ativas de monitoramento (sem baixar finanças nem enviar mensagens) uma vez ao carregar a sessão."
                checked={preferences.autoRunAutomationsOnOpen}
                disabled={isSaving}
                onChange={(val) =>
                  handleSavePreferences({ ...preferences, autoRunAutomationsOnOpen: val })
                }
              />

              <ToggleRow
                id="pref-ai-suggestions"
                label="Exibir painel de Sugestões Inteligentes no Assistente IA"
                description="Mostra recomendações calculadas diretamente dos dados reais do CRM, Projetos, Tarefas e Financeiro."
                checked={preferences.showAssistantSuggestions}
                disabled={isSaving}
                onChange={(val) =>
                  handleSavePreferences({ ...preferences, showAssistantSuggestions: val })
                }
              />
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: INTEGRAÇÕES */}
      {activeSubTab === 'integracoes' && (
        <Card padding="lg" className="space-y-4">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] flex items-center justify-center">
                <Plug className="w-4 h-4" />
              </div>
              <div>
                <CardTitle>Central Real de Integrações</CardTitle>
                <CardDescription>
                  Verificação honesta de conectividade, autenticação e recursos externos configurados neste ambiente.
                </CardDescription>
              </div>
            </div>
            {onRefreshIntegrations && (
              <Button
                variant="outline"
                size="sm"
                loading={isRefreshingIntegrations}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={handleRefreshIntegrationsClick}
              >
                Verificar Novamente
              </Button>
            )}
          </CardHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {integrations.map((integ) => {
              const badge = getIntegrationBadge(integ.status);
              return (
                <div
                  key={integ.id}
                  className="p-4 rounded-xl border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-subtle)]/50 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-[var(--kz-text-primary)]">
                        {integ.name}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--kz-text-muted)] font-semibold mt-0.5">
                        {integ.category}
                      </div>
                    </div>
                    <Badge variant={badge.variant} dot size="sm">
                      {badge.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--kz-text-secondary)] leading-relaxed">
                    {integ.detail}
                  </p>
                  {integ.limitationsNote && (
                    <p className="text-[11px] text-[var(--kz-text-muted)] border-t border-[var(--kz-border-subtle)] pt-2">
                      {integ.limitationsNote}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <Alert variant="info">
            Chaves de API (como GEMINI_API_KEY) ficam exclusivamente nas variáveis de ambiente do servidor e nunca são inseridas ou expostas no navegador. Conectores externos não habilitados permanecem explicitamente como <strong>Não configurado</strong>.
          </Alert>
        </Card>
      )}

      {/* TAB 5: LOGS & MONITORAMENTO */}
      {activeSubTab === 'logs' && (
        <Card padding="lg" className="space-y-4">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--kz-bg-subtle)] text-[var(--kz-text-secondary)] flex items-center justify-center">
                <ScrollText className="w-4 h-4" />
              </div>
              <div>
                <CardTitle>Logs Operacionais & Monitoramento Seguro</CardTitle>
                <CardDescription>
                  Registro auditável de eventos de sincronização, IA, automações e backups com sanitização automática de tokens e segredos.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={handleExportLogsTxt}
                disabled={filteredLogs.length === 0}
              >
                TXT
              </Button>
              <Button
                variant="outline"
                size="xs"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={handleExportLogsJson}
                disabled={filteredLogs.length === 0}
              >
                JSON
              </Button>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Filtrar eventos por texto..."
              leftIcon={<Search className="w-3.5 h-3.5" />}
            />
            <Select
              value={logLevelFilter}
              onChange={(e) => setLogLevelFilter(e.target.value as 'all' | SystemLogLevel)}
            >
              <option value="all">Todos os níveis</option>
              <option value="info">Info</option>
              <option value="warning">Aviso</option>
              <option value="error">Erro</option>
            </Select>
            <Select
              value={logSourceFilter}
              onChange={(e) => setLogSourceFilter(e.target.value as 'all' | SystemLogSource)}
            >
              <option value="all">Todas as origens</option>
              <option value="sistema">Sistema</option>
              <option value="firestore">Firestore</option>
              <option value="gemini_ia">Assistente IA</option>
              <option value="automacoes">Automações</option>
              <option value="notificacoes">Notificações</option>
              <option value="backup">Backup</option>
              <option value="auth">Auth</option>
            </Select>
          </div>

          {filteredLogs.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="w-5 h-5" />}
              title="Nenhum evento encontrado"
              description="Eventos operacionais do sistema aparecerão aqui automaticamente conforme ações relevantes forem executadas."
            />
          ) : (
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={
                          log.level === 'error'
                            ? 'danger'
                            : log.level === 'warning'
                            ? 'warning'
                            : 'info'
                        }
                        size="sm"
                      >
                        {log.level.toUpperCase()}
                      </Badge>
                      <Badge variant="neutral" size="sm">
                        {log.source}
                      </Badge>
                      <span className="font-semibold text-[var(--kz-text-primary)]">
                        {log.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--kz-text-secondary)] break-words">
                      {log.message}
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-[var(--kz-text-muted)] shrink-0">
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 6: BACKUP & GOVERNANÇA */}
      {activeSubTab === 'backup' && (
        <Card padding="lg" className="space-y-4">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--kz-bg-subtle)] text-[var(--kz-text-secondary)] flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <CardTitle>Governança, Backup Completo (v3.0) e Integridade</CardTitle>
                <CardDescription>
                  Exporte toda a base do Kaizen (CRM, Clientes, Propostas, Projetos, Tarefas, Financeiro, Materiais, Relatórios e Configurações) com hash de integridade.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[var(--kz-bg-subtle)]/60 border border-[var(--kz-border-subtle)] space-y-1">
              <div className="text-[11px] font-medium text-[var(--kz-text-muted)]">
                Workspace Ativo
              </div>
              <div className="text-xs font-mono font-bold text-[var(--kz-text-primary)]">
                {WORKSPACE_ID}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--kz-bg-subtle)]/60 border border-[var(--kz-border-subtle)] space-y-1">
              <div className="text-[11px] font-medium text-[var(--kz-text-muted)]">
                Registros do Funil CRM
              </div>
              <div className="text-xs font-mono font-bold text-[var(--kz-text-primary)]">
                {niches.length} nichos · {leads.length} leads · {importedSheets.length} planilhas
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--kz-bg-subtle)]/60 border border-[var(--kz-border-subtle)] space-y-1">
              <div className="text-[11px] font-medium text-[var(--kz-text-muted)]">
                Último Backup neste Navegador
              </div>
              <div className="text-xs font-semibold text-[var(--kz-text-primary)] flex items-center gap-1.5">
                {lastBackupAt ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--kz-success-solid)]" />
                    <span>{new Date(lastBackupAt).toLocaleString('pt-BR')}</span>
                  </>
                ) : (
                  <span>Nenhum registrado</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--kz-border-subtle)]">
            <div className="flex items-center gap-2 text-xs text-[var(--kz-text-muted)]">
              <ShieldCheck className="w-4 h-4 text-[var(--kz-success-solid)] shrink-0" />
              <span>
                Exportação completa, restauração com pré-visualização e validação de integridade estão em Relatórios da Agência.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
                onClick={() => onNavigate('global')}
              >
                Abrir Backup & Restauração v3.0
              </Button>

              {onClearAllContacts && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash2 className="w-3.5 h-3.5 text-[var(--kz-danger-solid)]" />}
                  className="text-[var(--kz-danger-text)] hover:bg-[var(--kz-danger-bg)]"
                  onClick={() => {
                    setClearConfirmText('');
                    setClearError(null);
                    setIsClearOpen(true);
                  }}
                >
                  Zerar Base do CRM
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Confirm Clear Base Dialog */}
      <ConfirmDialog
        isOpen={isClearOpen}
        onClose={() => setIsClearOpen(false)}
        onConfirm={handleConfirmClear}
        title="Zerar Base do CRM (Ação Irreversível)"
        description={
          <span>
            Serão apagados do Cloud Firestore e do cache local apenas os dados comerciais:{' '}
            <strong>{leads.length} leads</strong>, <strong>{niches.length} nichos</strong> e{' '}
            <strong>{importedSheets.length} registros de planilhas</strong>. Clientes, Propostas,
            Projetos, Tarefas, Financeiro, Materiais e Configurações são preservados.
          </span>
        }
        confirmLabel="Confirmar Limpeza do CRM"
        variant="danger"
        loading={isClearing}
        confirmDisabled={clearConfirmText.trim().toUpperCase() !== 'ZERAR'}
      >
        <Input
          label="Digite ZERAR para confirmar"
          value={clearConfirmText}
          onChange={(e) => setClearConfirmText(e.target.value)}
          placeholder="ZERAR"
          className="font-mono"
        />
        {clearError && <Alert variant="danger">{clearError}</Alert>}
      </ConfirmDialog>
    </div>
  );
};
