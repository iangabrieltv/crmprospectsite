import { NicheCampaign, Lead, normalizeStageId } from '../types/crm';
import {
  INITIAL_NICHES,
  INITIAL_LEADS,
  DEFAULT_SCRIPTS,
  SCRIPT_NUTRICIONISTA,
  SCRIPT_NUTRICIONISTA_MENSAGENS
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
      // Auto-migrate: ensure default scripts and new objections are populated in niches if missing
      let upgraded = parsed.map((niche: NicheCampaign) => {
        const isNutri =
          niche.name.toLowerCase().includes('nutri') ||
          niche.segment.toLowerCase().includes('nutri');

        const mergedScripts: Record<string, any> = isNutri
          ? {
              script_nutri: SCRIPT_NUTRICIONISTA,
              script_nutri_mensagens: SCRIPT_NUTRICIONISTA_MENSAGENS,
              ...(niche.scripts || {}),
              ...DEFAULT_SCRIPTS,
            }
          : { ...DEFAULT_SCRIPTS, ...(niche.scripts || {}) };

        // Ensure both nutri scripts are always present and up to date
        mergedScripts.script_nutri = SCRIPT_NUTRICIONISTA;
        mergedScripts.script_nutri_mensagens = SCRIPT_NUTRICIONISTA_MENSAGENS;

        // Ensure script2 is always updated to the new validated 10-step proposal structure
        mergedScripts.script2 = DEFAULT_SCRIPTS.script2;

        // If script3 is not yet in niche.scripts, add it
        if (!mergedScripts.script3) {
          mergedScripts.script3 = DEFAULT_SCRIPTS.script3;
        }

        // Ensure script1 has the new objection 'obj-ja-tem-equipe'
        if (mergedScripts.script1) {
          const objections = mergedScripts.script1.objections || [];
          const hasEquipeObj = objections.some((o: any) => o.id === 'obj-ja-tem-equipe');
          if (!hasEquipeObj) {
            const defaultEquipeObj = DEFAULT_SCRIPTS.script1?.objections?.find(
              (o) => o.id === 'obj-ja-tem-equipe'
            );
            if (defaultEquipeObj) {
              mergedScripts.script1 = {
                ...mergedScripts.script1,
                objections: [defaultEquipeObj, ...objections],
              };
            }
          }

          // Ensure etapa-1 and etapa-2 steps
          if (mergedScripts.script1.stages?.[0]) {
            const st1Steps = mergedScripts.script1.stages[0].steps || [];
            if (!st1Steps.some((s: any) => s.id === 'etapa-1-ja-tem-equipe')) {
              const defaultStep1 = DEFAULT_SCRIPTS.script1?.stages?.[0]?.steps?.find(
                (s) => s.id === 'etapa-1-ja-tem-equipe'
              );
              if (defaultStep1) {
                mergedScripts.script1.stages[0].steps = [...st1Steps, defaultStep1];
              }
            }
          }
          if (mergedScripts.script1.stages?.[1]) {
            const st2Steps = mergedScripts.script1.stages[1].steps || [];
            if (!st2Steps.some((s: any) => s.id === 'etapa-2-envio-pos-equipe')) {
              const defaultStep2 = DEFAULT_SCRIPTS.script1?.stages?.[1]?.steps?.find(
                (s) => s.id === 'etapa-2-envio-pos-equipe'
              );
              if (defaultStep2) {
                mergedScripts.script1.stages[1].steps = [...st2Steps, defaultStep2];
              }
            }
          }

          // Ensure follow-ups 1, 2, and 3 are updated
          mergedScripts.script1.followUp1 = DEFAULT_SCRIPTS.script1.followUp1;
          mergedScripts.script1.followUp2 = DEFAULT_SCRIPTS.script1.followUp2;
          mergedScripts.script1.followUp3 = DEFAULT_SCRIPTS.script1.followUp3;

          // Ensure etapa-followup-mockup is present in stages
          const stages = mergedScripts.script1.stages || [];
          if (!stages.some((st: any) => st.id === 'etapa-followup-mockup')) {
            const defaultFuStage = DEFAULT_SCRIPTS.script1?.stages?.find(
              (st) => st.id === 'etapa-followup-mockup'
            );
            if (defaultFuStage) {
              const etapa2Idx = stages.findIndex((st: any) => st.id === 'etapa-2');
              if (etapa2Idx >= 0) {
                stages.splice(etapa2Idx + 1, 0, defaultFuStage);
              } else {
                stages.push(defaultFuStage);
              }
              mergedScripts.script1.stages = [...stages];
            }
          }
        }

        return {
          ...niche,
          scripts: mergedScripts,
        };
      });

      // Ensure default preset niches are available if not yet added
      INITIAL_NICHES.forEach((initNiche) => {
        const exists = upgraded.some((n) => n.id === initNiche.id || n.name.toLowerCase() === initNiche.name.toLowerCase());
        if (!exists) {
          upgraded.push(initNiche);
        }
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
