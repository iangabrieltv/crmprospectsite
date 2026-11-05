import { NicheCampaign, Lead, normalizeStageId } from '../types/crm';
import {
  INITIAL_NICHES,
  INITIAL_LEADS,
  DEFAULT_SCRIPTS,
  SCRIPT_MENSAGEM,
  SCRIPT_LIGACAO,
} from './initialData';

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
      // Filter out legacy sample niches (advogados, carros, estética automotiva, clínicas)
      const isLegacySample = (n: NicheCampaign) => {
        const id = (n.id || '').toLowerCase();
        const name = (n.name || '').toLowerCase();
        return (
          id.includes('estetica-automotiva') ||
          id.includes('clinicas-locais') ||
          id.includes('nutricionistas') ||
          id.includes('odontologia') ||
          name.includes('estética automotiva') ||
          name.includes('clínicas & consultórios') ||
          name.includes('advogad') ||
          name.includes('advocacia') ||
          name.includes('carro') ||
          name.includes('automot')
        );
      };

      const filtered = parsed.filter((n: NicheCampaign) => !isLegacySample(n));
      if (filtered.length === 0) {
        saveStoredNiches(INITIAL_NICHES);
        return INITIAL_NICHES;
      }

      // Auto-migrate: ensure every niche has exactly the two official scripts: script_mensagem and script_ligacao
      let upgraded: NicheCampaign[] = filtered.map((niche: NicheCampaign): NicheCampaign => {
        const hasOldTemplate =
          niche.scripts?.script_mensagem?.template?.includes('tráfego pago com IA') ||
          niche.scripts?.script_mensagem?.template?.includes('Kaizen Visual') ||
          niche.scripts?.script_ligacao?.template?.includes('Kaizen Visual') ||
          niche.scripts?.script_mensagem?.template?.includes('dois minutinhos') ||
          niche.scripts?.script_ligacao?.template?.includes('dois minutinhos') ||
          niche.scripts?.script_mensagem?.template?.includes('{NomeContato}') ||
          niche.scripts?.script_ligacao?.template?.includes('{NomeContato}');

        return {
          ...niche,
          scripts: {
            script_mensagem: hasOldTemplate ? SCRIPT_MENSAGEM : (niche.scripts?.script_mensagem || SCRIPT_MENSAGEM),
            script_ligacao: niche.scripts?.script_ligacao || SCRIPT_LIGACAO,
          },
        };
      });

      // Ensure clean baseline niche is available
      INITIAL_NICHES.forEach((initNiche) => {
        const exists = upgraded.some((n) => n.id === initNiche.id || n.name.toLowerCase() === initNiche.name.toLowerCase());
        if (!exists) {
          upgraded.unshift(initNiche);
        }
      });

      saveStoredNiches(upgraded);
      return upgraded;
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

export function loadStoredLeads(): Lead[] {
  try {
    const raw = localStorage.getItem(LEADS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Clean out any old mock leads or demo leads
      const cleaned = parsed.filter((l: Lead) => {
        if (!l || !l.id) return false;
        if (l.id.startsWith('lead-sp-') || l.id.startsWith('lead-rj-') || l.id.startsWith('lead-cwb-') || l.id === 'lead-frila-demo') {
          return false;
        }
        return true;
      });
      return cleaned.map((l: Lead) => ({
        ...l,
        stage: normalizeStageId(l.stage),
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
