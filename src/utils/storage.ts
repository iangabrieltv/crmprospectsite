import { NicheCampaign, Lead } from '../types/crm';
import { INITIAL_NICHES, INITIAL_LEADS, DEFAULT_SCRIPTS } from './initialData';

const NICHES_STORAGE_KEY = 'prospectflow_crm_niches_clean_v2';
const LEADS_STORAGE_KEY = 'prospectflow_crm_leads_clean_v2';
const ACTIVE_NICHE_KEY = 'prospectflow_crm_active_niche_clean_v2';
const USER_NAME_KEY = 'prospectflow_crm_user_name_clean_v2';

export function loadStoredNiches(): NicheCampaign[] {
  try {
    const raw = localStorage.getItem(NICHES_STORAGE_KEY);
    if (!raw) {
      saveStoredNiches(INITIAL_NICHES);
      return INITIAL_NICHES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Auto-migrate: ensure default scripts like script3 are populated in niches if missing
      const upgraded = parsed.map((niche: NicheCampaign) => {
        const mergedScripts = { ...DEFAULT_SCRIPTS, ...(niche.scripts || {}) };
        // If script3 is not yet in niche.scripts, add it
        if (!mergedScripts.script3) {
          mergedScripts.script3 = DEFAULT_SCRIPTS.script3;
        }
        return {
          ...niche,
          scripts: mergedScripts,
        };
      });
      return upgraded;
    }
    return INITIAL_NICHES;
  } catch (err) {
    console.error('Failed to load niches from localStorage', err);
    return INITIAL_NICHES;
  }
}

export function saveStoredNiches(niches: NicheCampaign[]): void {
  try {
    localStorage.setItem(NICHES_STORAGE_KEY, JSON.stringify(niches));
  } catch (err) {
    console.error('Failed to save niches to localStorage', err);
  }
}

export function loadStoredLeads(): Lead[] {
  try {
    const raw = localStorage.getItem(LEADS_STORAGE_KEY);
    if (!raw) {
      saveStoredLeads(INITIAL_LEADS);
      return INITIAL_LEADS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // If contains old mock leads with lead-sp- or lead-rj-, clean it out
      const hasMockLeads = parsed.some((l: Lead) => l.id?.startsWith('lead-sp-') || l.id?.startsWith('lead-rj-') || l.id?.startsWith('lead-cwb-'));
      if (hasMockLeads) {
        saveStoredLeads([]);
        return [];
      }
      return parsed;
    }
    return INITIAL_LEADS;
  } catch (err) {
    console.error('Failed to load leads from localStorage', err);
    return INITIAL_LEADS;
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

export interface BackupData {
  version: string;
  exportedAt: string;
  userName: string;
  niches: NicheCampaign[];
  leads: Lead[];
}

export function exportBackupJson(niches: NicheCampaign[], leads: Lead[], userName: string): string {
  const data: BackupData = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    userName,
    niches,
    leads,
  };
  return JSON.stringify(data, null, 2);
}

export function parseBackupJson(jsonString: string): { niches: NicheCampaign[]; leads: Lead[]; userName?: string } | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !Array.isArray(parsed.niches) || !Array.isArray(parsed.leads)) {
      throw new Error('Arquivo de backup inválido.');
    }
    return {
      niches: parsed.niches,
      leads: parsed.leads,
      userName: parsed.userName,
    };
  } catch (err) {
    console.error('Invalid backup JSON:', err);
    return null;
  }
}

export function resetAllDataToDefault(): { niches: NicheCampaign[]; leads: Lead[] } {
  saveStoredNiches(INITIAL_NICHES);
  saveStoredLeads([]);
  saveStoredActiveNicheId(INITIAL_NICHES[0].id);
  saveStoredUserName('Ian');
  return { niches: INITIAL_NICHES, leads: [] };
}
