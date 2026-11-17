import { NicheCampaign, Lead, ImportedSheet, normalizeStageId } from '../types/crm';
import {
  AgendaEvent,
  Client,
  Project,
  ProposalContract,
  SocialChannel,
  SocialPost,
  Task,
} from '../types/kaizen';
import {
  FinancialAuditLog,
  FinancialCategory,
  FinancialEntry,
  FinancialRecurrence,
  FinancialSettings,
  FinancialTransaction,
} from '../types/finance';
import {
  CommercialScript,
  ModelTemplate,
  ResourceCategory,
  ResourceFile,
  ResourceFolder,
} from '../types/resources';
import {
  INITIAL_NICHES,
  SCRIPT_MENSAGEM,
  SCRIPT_LIGACAO,
} from './initialData';
import {
  serializeCompleteBackupJson,
  parseAndValidateBackup,
} from '../services/backupService';

const NICHES_STORAGE_KEY = 'prospectflow_crm_niches_clean_v2';
const LEADS_STORAGE_KEY = 'prospectflow_crm_leads_clean_v2';
const CLIENTS_STORAGE_KEY = 'kaizen_clients_v1';
const PROPOSALS_STORAGE_KEY = 'kaizen_proposals_v1';
const PROJECTS_STORAGE_KEY = 'kaizen_projects_v1';
const TASKS_STORAGE_KEY = 'kaizen_tasks_v1';
const AGENDA_EVENTS_STORAGE_KEY = 'kaizen_agenda_events_v1';
const SOCIAL_CHANNELS_STORAGE_KEY = 'kaizen_social_channels_v1';
const SOCIAL_POSTS_STORAGE_KEY = 'kaizen_social_posts_v1';
const FINANCIAL_ENTRIES_STORAGE_KEY = 'kaizen_financial_entries_v1';
const FINANCIAL_TRANSACTIONS_STORAGE_KEY = 'kaizen_financial_transactions_v1';
const FINANCIAL_CATEGORIES_STORAGE_KEY = 'kaizen_financial_categories_v1';
const FINANCIAL_RECURRENCES_STORAGE_KEY = 'kaizen_financial_recurrences_v1';
const FINANCIAL_SETTINGS_STORAGE_KEY = 'kaizen_financial_settings_v1';
const FINANCIAL_AUDIT_LOGS_STORAGE_KEY = 'kaizen_financial_audit_logs_v1';
const RESOURCE_FILES_STORAGE_KEY = 'kaizen_resource_files_v1';
const RESOURCE_FOLDERS_STORAGE_KEY = 'kaizen_resource_folders_v1';
const RESOURCE_CATEGORIES_STORAGE_KEY = 'kaizen_resource_categories_v1';
const COMMERCIAL_SCRIPTS_STORAGE_KEY = 'kaizen_commercial_scripts_v1';
const MODEL_TEMPLATES_STORAGE_KEY = 'kaizen_model_templates_v1';
const ACTIVE_NICHE_KEY = 'prospectflow_crm_active_niche_clean_v2';
const USER_NAME_KEY = 'prospectflow_crm_user_name_clean_v2';
const LAST_BACKUP_AT_KEY = 'prospectflow_crm_last_backup_at';

/**
 * Loads niches from localStorage without destructive substring filters or
 * overwriting custom user scripts.
 */
export function loadStoredNiches(): NicheCampaign[] {
  try {
    const raw = localStorage.getItem(NICHES_STORAGE_KEY);
    if (!raw) {
      saveStoredNiches(INITIAL_NICHES);
      return INITIAL_NICHES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const normalized: NicheCampaign[] = parsed
        .filter((n: unknown): n is NicheCampaign => Boolean(n && typeof n === 'object' && (n as NicheCampaign).id))
        .map((niche: NicheCampaign): NicheCampaign => ({
          ...niche,
          // Backward-compatible read fallback only if scripts object is completely missing
          scripts:
            niche.scripts && Object.keys(niche.scripts).length > 0
              ? niche.scripts
              : {
                  script_mensagem: SCRIPT_MENSAGEM,
                  script_ligacao: SCRIPT_LIGACAO,
                },
        }));

      if (normalized.length > 0) {
        return normalized;
      }
    }
    return INITIAL_NICHES;
  } catch (err) {
    console.error('Failed to load niches from localStorage', err);
    return INITIAL_NICHES;
  }
}

export function resetAllDataToCleanBaseline(): void {
  try {
    saveStoredNiches(INITIAL_NICHES);
    saveStoredLeads([]);
    saveStoredActiveNicheId(INITIAL_NICHES[0].id);
  } catch (err) {
    console.error('Failed to reset stored data', err);
  }
}

export function saveStoredNiches(niches: NicheCampaign[]): void {
  try {
    localStorage.setItem(NICHES_STORAGE_KEY, JSON.stringify(niches));
  } catch (err) {
    console.error('Failed to save niches to localStorage', err);
  }
}

/**
 * Loads leads from localStorage preserving all legacy IDs and normalizing stage names
 * purely in memory without dropping records by ID prefix.
 */
export function loadStoredLeads(): Lead[] {
  try {
    const raw = localStorage.getItem(LEADS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((l: unknown): l is Lead => Boolean(l && typeof l === 'object' && (l as Lead).id))
        .map((l: Lead) => ({
          ...l,
          stage: normalizeStageId(l.stage),
          notes: Array.isArray(l.notes) ? l.notes : [],
        }));
    }
    return [];
  } catch (err) {
    console.error('Failed to load leads from localStorage', err);
    return [];
  }
}

export function clearStoredLeads(): void {
  try {
    localStorage.removeItem(LEADS_STORAGE_KEY);
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify([]));
  } catch (err) {
    console.error('Failed to clear stored leads', err);
  }
}

export function saveStoredLeads(leads: Lead[]): void {
  try {
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
  } catch (err) {
    console.error('Failed to save leads to localStorage', err);
  }
}

export function loadStoredClients(): Client[] {
  try {
    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c: unknown): c is Client => Boolean(c && typeof c === 'object' && (c as Client).id))
      .map((c: Client) => ({
        ...c,
        timeline: Array.isArray(c.timeline) ? c.timeline : [],
      }));
  } catch (err) {
    console.error('Failed to load clients from localStorage', err);
    return [];
  }
}

export function saveStoredClients(clients: Client[]): void {
  try {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
  } catch (err) {
    console.error('Failed to save clients to localStorage', err);
  }
}

export function loadStoredProposals(): ProposalContract[] {
  try {
    const raw = localStorage.getItem(PROPOSALS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p: unknown): p is ProposalContract =>
          Boolean(p && typeof p === 'object' && (p as ProposalContract).id)
      )
      .map((p: ProposalContract) => ({
        ...p,
        items: Array.isArray(p.items) ? p.items : [],
        history: Array.isArray(p.history) ? p.history : [],
      }));
  } catch (err) {
    console.error('Failed to load proposals from localStorage', err);
    return [];
  }
}

export function saveStoredProposals(proposals: ProposalContract[]): void {
  try {
    localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(proposals));
  } catch (err) {
    console.error('Failed to save proposals to localStorage', err);
  }
}

export function loadStoredProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p: unknown): p is Project => Boolean(p && typeof p === 'object' && (p as Project).id))
      .map((p: Project) => ({
        ...p,
        documents: Array.isArray(p.documents) ? p.documents : [],
        history: Array.isArray(p.history) ? p.history : [],
      }));
  } catch (err) {
    console.error('Failed to load projects from localStorage', err);
    return [];
  }
}

export function saveStoredProjects(projects: Project[]): void {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch (err) {
    console.error('Failed to save projects to localStorage', err);
  }
}

export function loadStoredTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t: unknown): t is Task => Boolean(t && typeof t === 'object' && (t as Task).id))
      .map((t: Task) => ({
        ...t,
        checklist: Array.isArray(t.checklist) ? t.checklist : [],
      }));
  } catch (err) {
    console.error('Failed to load tasks from localStorage', err);
    return [];
  }
}

export function saveStoredTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error('Failed to save tasks to localStorage', err);
  }
}

export function loadStoredAgendaEvents(): AgendaEvent[] {
  try {
    const raw = localStorage.getItem(AGENDA_EVENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e: unknown): e is AgendaEvent => Boolean(e && typeof e === 'object' && (e as AgendaEvent).id)
    );
  } catch (err) {
    console.error('Failed to load agendaEvents from localStorage', err);
    return [];
  }
}

export function saveStoredAgendaEvents(events: AgendaEvent[]): void {
  try {
    localStorage.setItem(AGENDA_EVENTS_STORAGE_KEY, JSON.stringify(events));
  } catch (err) {
    console.error('Failed to save agendaEvents to localStorage', err);
  }
}

export function loadStoredSocialChannels(): SocialChannel[] {
  try {
    const raw = localStorage.getItem(SOCIAL_CHANNELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c: unknown): c is SocialChannel =>
        Boolean(c && typeof c === 'object' && (c as SocialChannel).id)
    );
  } catch (err) {
    console.error('Failed to load socialChannels from localStorage', err);
    return [];
  }
}

export function saveStoredSocialChannels(channels: SocialChannel[]): void {
  try {
    localStorage.setItem(SOCIAL_CHANNELS_STORAGE_KEY, JSON.stringify(channels));
  } catch (err) {
    console.error('Failed to save socialChannels to localStorage', err);
  }
}

export function loadStoredSocialPosts(): SocialPost[] {
  try {
    const raw = localStorage.getItem(SOCIAL_POSTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: unknown): p is SocialPost => Boolean(p && typeof p === 'object' && (p as SocialPost).id)
    );
  } catch (err) {
    console.error('Failed to load socialPosts from localStorage', err);
    return [];
  }
}

export function saveStoredSocialPosts(posts: SocialPost[]): void {
  try {
    localStorage.setItem(SOCIAL_POSTS_STORAGE_KEY, JSON.stringify(posts));
  } catch (err) {
    console.error('Failed to save socialPosts to localStorage', err);
  }
}

export function loadStoredFinancialEntries(): FinancialEntry[] {
  try {
    const raw = localStorage.getItem(FINANCIAL_ENTRIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e: unknown): e is FinancialEntry =>
        Boolean(e && typeof e === 'object' && (e as FinancialEntry).id)
    );
  } catch (err) {
    console.error('Failed to load financialEntries from localStorage', err);
    return [];
  }
}

export function saveStoredFinancialEntries(entries: FinancialEntry[]): void {
  try {
    localStorage.setItem(FINANCIAL_ENTRIES_STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Failed to save financialEntries to localStorage', err);
  }
}

export function loadStoredFinancialTransactions(): FinancialTransaction[] {
  try {
    const raw = localStorage.getItem(FINANCIAL_TRANSACTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t: unknown): t is FinancialTransaction =>
        Boolean(t && typeof t === 'object' && (t as FinancialTransaction).id)
    );
  } catch (err) {
    console.error('Failed to load financialTransactions from localStorage', err);
    return [];
  }
}

export function saveStoredFinancialTransactions(txs: FinancialTransaction[]): void {
  try {
    localStorage.setItem(FINANCIAL_TRANSACTIONS_STORAGE_KEY, JSON.stringify(txs));
  } catch (err) {
    console.error('Failed to save financialTransactions to localStorage', err);
  }
}

export function loadStoredFinancialCategories(): FinancialCategory[] {
  try {
    const raw = localStorage.getItem(FINANCIAL_CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c: unknown): c is FinancialCategory =>
        Boolean(c && typeof c === 'object' && (c as FinancialCategory).id)
    );
  } catch (err) {
    console.error('Failed to load financialCategories from localStorage', err);
    return [];
  }
}

export function saveStoredFinancialCategories(categories: FinancialCategory[]): void {
  try {
    localStorage.setItem(FINANCIAL_CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  } catch (err) {
    console.error('Failed to save financialCategories to localStorage', err);
  }
}

export function loadStoredFinancialRecurrences(): FinancialRecurrence[] {
  try {
    const raw = localStorage.getItem(FINANCIAL_RECURRENCES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r: unknown): r is FinancialRecurrence =>
        Boolean(r && typeof r === 'object' && (r as FinancialRecurrence).id)
    );
  } catch (err) {
    console.error('Failed to load financialRecurrences from localStorage', err);
    return [];
  }
}

export function saveStoredFinancialRecurrences(recurrences: FinancialRecurrence[]): void {
  try {
    localStorage.setItem(FINANCIAL_RECURRENCES_STORAGE_KEY, JSON.stringify(recurrences));
  } catch (err) {
    console.error('Failed to save financialRecurrences to localStorage', err);
  }
}

export function loadStoredFinancialSettings(): FinancialSettings | null {
  try {
    const raw = localStorage.getItem(FINANCIAL_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && (parsed as FinancialSettings).id) {
      return parsed as FinancialSettings;
    }
    return null;
  } catch (err) {
    console.error('Failed to load financialSettings from localStorage', err);
    return null;
  }
}

export function saveStoredFinancialSettings(settings: FinancialSettings): void {
  try {
    localStorage.setItem(FINANCIAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save financialSettings to localStorage', err);
  }
}

export function loadStoredFinancialAuditLogs(): FinancialAuditLog[] {
  try {
    const raw = localStorage.getItem(FINANCIAL_AUDIT_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l: unknown): l is FinancialAuditLog =>
        Boolean(l && typeof l === 'object' && (l as FinancialAuditLog).id)
    );
  } catch (err) {
    console.error('Failed to load financialAuditLogs from localStorage', err);
    return [];
  }
}

export function saveStoredFinancialAuditLogs(logs: FinancialAuditLog[]): void {
  try {
    localStorage.setItem(FINANCIAL_AUDIT_LOGS_STORAGE_KEY, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed to save financialAuditLogs to localStorage', err);
  }
}

export function loadStoredResourceFiles(): ResourceFile[] {
  try {
    const raw = localStorage.getItem(RESOURCE_FILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((f: unknown): f is ResourceFile => Boolean(f && typeof f === 'object' && (f as ResourceFile).id))
      .map((f: ResourceFile) => ({
        ...f,
        tags: Array.isArray(f.tags) ? f.tags : [],
      }));
  } catch (err) {
    console.error('Failed to load resourceFiles from localStorage', err);
    return [];
  }
}

export function saveStoredResourceFiles(files: ResourceFile[]): void {
  try {
    localStorage.setItem(RESOURCE_FILES_STORAGE_KEY, JSON.stringify(files));
  } catch (err) {
    console.error('Failed to save resourceFiles to localStorage', err);
  }
}

export function loadStoredResourceFolders(): ResourceFolder[] {
  try {
    const raw = localStorage.getItem(RESOURCE_FOLDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((f: unknown): f is ResourceFolder =>
      Boolean(f && typeof f === 'object' && (f as ResourceFolder).id)
    );
  } catch (err) {
    console.error('Failed to load resourceFolders from localStorage', err);
    return [];
  }
}

export function saveStoredResourceFolders(folders: ResourceFolder[]): void {
  try {
    localStorage.setItem(RESOURCE_FOLDERS_STORAGE_KEY, JSON.stringify(folders));
  } catch (err) {
    console.error('Failed to save resourceFolders to localStorage', err);
  }
}

export function loadStoredResourceCategories(): ResourceCategory[] {
  try {
    const raw = localStorage.getItem(RESOURCE_CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c: unknown): c is ResourceCategory =>
      Boolean(c && typeof c === 'object' && (c as ResourceCategory).id)
    );
  } catch (err) {
    console.error('Failed to load resourceCategories from localStorage', err);
    return [];
  }
}

export function saveStoredResourceCategories(categories: ResourceCategory[]): void {
  try {
    localStorage.setItem(RESOURCE_CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  } catch (err) {
    console.error('Failed to save resourceCategories to localStorage', err);
  }
}

export function loadStoredCommercialScripts(): CommercialScript[] {
  try {
    const raw = localStorage.getItem(COMMERCIAL_SCRIPTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s: unknown): s is CommercialScript =>
        Boolean(s && typeof s === 'object' && (s as CommercialScript).id)
      )
      .map((s: CommercialScript) => ({
        ...s,
        tags: Array.isArray(s.tags) ? s.tags : [],
      }));
  } catch (err) {
    console.error('Failed to load commercialScripts from localStorage', err);
    return [];
  }
}

export function saveStoredCommercialScripts(scripts: CommercialScript[]): void {
  try {
    localStorage.setItem(COMMERCIAL_SCRIPTS_STORAGE_KEY, JSON.stringify(scripts));
  } catch (err) {
    console.error('Failed to save commercialScripts to localStorage', err);
  }
}

export function loadStoredModelTemplates(): ModelTemplate[] {
  try {
    const raw = localStorage.getItem(MODEL_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t: unknown): t is ModelTemplate =>
        Boolean(t && typeof t === 'object' && (t as ModelTemplate).id)
      )
      .map((t: ModelTemplate) => ({
        ...t,
        tags: Array.isArray(t.tags) ? t.tags : [],
      }));
  } catch (err) {
    console.error('Failed to load modelTemplates from localStorage', err);
    return [];
  }
}

export function saveStoredModelTemplates(templates: ModelTemplate[]): void {
  try {
    localStorage.setItem(MODEL_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (err) {
    console.error('Failed to save modelTemplates to localStorage', err);
  }
}

export function loadStoredActiveNicheId(defaultId: string): string {
  try {
    return localStorage.getItem(ACTIVE_NICHE_KEY) || defaultId;
  } catch {
    return defaultId;
  }
}

export function saveStoredActiveNicheId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_NICHE_KEY, id);
  } catch (err) {
    console.error('Failed to save active niche', err);
  }
}

export function loadStoredUserName(): string {
  try {
    return localStorage.getItem(USER_NAME_KEY) || 'Ian';
  } catch {
    return 'Ian';
  }
}

export function saveStoredUserName(name: string): void {
  try {
    localStorage.setItem(USER_NAME_KEY, name);
  } catch (err) {
    console.error('Failed to save user name', err);
  }
}

export function loadLastBackupTimestamp(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_AT_KEY);
  } catch {
    return null;
  }
}

export function recordLastBackupTimestamp(isoDate: string = new Date().toISOString()): void {
  try {
    localStorage.setItem(LAST_BACKUP_AT_KEY, isoDate);
  } catch {
    // Ignore storage error
  }
}

export interface BackupData {
  version: string;
  exportedAt: string;
  userName: string;
  niches: NicheCampaign[];
  leads: Lead[];
  importedSheets?: ImportedSheet[];
}

export function exportBackupJson(
  niches: NicheCampaign[],
  leads: Lead[],
  userName: string,
  importedSheets: ImportedSheet[] = []
): string {
  return serializeCompleteBackupJson({ niches, leads, importedSheets, userName });
}

export function parseBackupJson(
  jsonString: string
): { niches: NicheCampaign[]; leads: Lead[]; importedSheets: ImportedSheet[]; userName?: string } | null {
  const result = parseAndValidateBackup(jsonString);
  if (!result.ok || !result.data) {
    return null;
  }
  return {
    niches: result.data.niches,
    leads: result.data.leads,
    importedSheets: result.data.importedSheets,
    userName: result.data.userName,
  };
}

export function resetAllDataToDefault(): { niches: NicheCampaign[]; leads: Lead[] } {
  saveStoredNiches(INITIAL_NICHES);
  saveStoredLeads([]);
  saveStoredActiveNicheId(INITIAL_NICHES[0].id);
  saveStoredUserName('Ian');
  return { niches: INITIAL_NICHES, leads: [] };
}
