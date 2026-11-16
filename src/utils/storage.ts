import { NicheCampaign, Lead, ImportedSheet, normalizeStageId } from '../types/crm';
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
