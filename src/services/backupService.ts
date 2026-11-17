import { ImportedSheet, Lead, NicheCampaign, normalizeStageId } from '../types/crm';
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
import { APP_ENV, WORKSPACE_ID, firebaseConfig } from '../config/env';
import { cleanPhoneForWhatsApp } from '../utils/phone';

export const BACKUP_FORMAT_VERSION = '3.0';

export interface BackupMetadata {
  projectId: string;
  firestoreDatabaseId: string;
  workspaceId: string;
  environment: string;
}

export interface BackupCounts {
  niches: number;
  leads: number;
  importedSheets: number;
  clients?: number;
  proposals?: number;
  projects?: number;
  tasks?: number;
  agendaEvents?: number;
  socialChannels?: number;
  socialPosts?: number;
  financialEntries?: number;
  financialTransactions?: number;
  financialCategories?: number;
  financialRecurrences?: number;
  financialAuditLogs?: number;
  resourceFiles?: number;
  resourceFolders?: number;
  resourceCategories?: number;
  commercialScripts?: number;
  modelTemplates?: number;
}

export interface CompleteBackupData {
  version: string;
  exportedAt: string;
  userName: string;
  metadata?: BackupMetadata;
  counts?: BackupCounts;
  integrityHash?: string;
  niches: NicheCampaign[];
  leads: Lead[];
  importedSheets: ImportedSheet[];
  clients?: Client[];
  proposals?: ProposalContract[];
  projects?: Project[];
  tasks?: Task[];
  agendaEvents?: AgendaEvent[];
  socialChannels?: SocialChannel[];
  socialPosts?: SocialPost[];
  financialEntries?: FinancialEntry[];
  financialTransactions?: FinancialTransaction[];
  financialCategories?: FinancialCategory[];
  financialRecurrences?: FinancialRecurrence[];
  financialSettings?: FinancialSettings;
  financialAuditLogs?: FinancialAuditLog[];
  resourceFiles?: ResourceFile[];
  resourceFolders?: ResourceFolder[];
  resourceCategories?: ResourceCategory[];
  commercialScripts?: CommercialScript[];
  modelTemplates?: ModelTemplate[];
}

export interface BackupValidationResult {
  ok: boolean;
  error?: string;
  warnings: string[];
  data?: CompleteBackupData;
}

export interface RestoreAnalysisSummary {
  version: string;
  exportedAt: string;
  sourceWorkspace?: string;
  sourceDatabaseId?: string;
  totalNichesInFile: number;
  totalLeadsInFile: number;
  totalSheetsInFile: number;
  nichesNew: number;
  nichesExisting: number;
  leadsNew: number;
  leadsExistingById: number;
  leadsPotentialPhoneDuplicates: number;
  sheetsNew: number;
  sheetsExisting: number;
  orphanLeadsInFile: number;
}

export type RestoreDuplicateStrategy = 'skip_phone_duplicates' | 'merge_by_id';

/**
 * Computes a deterministic 64-bit FNV-1a integrity fingerprint over backup content
 * (works synchronously in both browser and Node without relying on async WebCrypto).
 */
export function computeBackupIntegrityHash(payload: {
  version: string;
  exportedAt: string;
  userName: string;
  metadata?: BackupMetadata;
  counts?: BackupCounts;
  niches: NicheCampaign[];
  leads: Lead[];
  importedSheets: ImportedSheet[];
  clients?: Client[];
  proposals?: ProposalContract[];
  projects?: Project[];
  tasks?: Task[];
  agendaEvents?: AgendaEvent[];
  socialChannels?: SocialChannel[];
  socialPosts?: SocialPost[];
  financialEntries?: FinancialEntry[];
  financialTransactions?: FinancialTransaction[];
  financialCategories?: FinancialCategory[];
  financialRecurrences?: FinancialRecurrence[];
  financialSettings?: FinancialSettings;
  financialAuditLogs?: FinancialAuditLog[];
  resourceFiles?: ResourceFile[];
  resourceFolders?: ResourceFolder[];
  resourceCategories?: ResourceCategory[];
  commercialScripts?: CommercialScript[];
  modelTemplates?: ModelTemplate[];
}): string {
  const canonical = JSON.stringify({
    version: payload.version,
    exportedAt: payload.exportedAt,
    userName: payload.userName,
    metadata: payload.metadata,
    counts: payload.counts,
    niches: payload.niches,
    leads: payload.leads,
    importedSheets: payload.importedSheets,
    ...(payload.clients !== undefined ? { clients: payload.clients } : {}),
    ...(payload.proposals !== undefined ? { proposals: payload.proposals } : {}),
    ...(payload.projects !== undefined ? { projects: payload.projects } : {}),
    ...(payload.tasks !== undefined ? { tasks: payload.tasks } : {}),
    ...(payload.agendaEvents !== undefined ? { agendaEvents: payload.agendaEvents } : {}),
    ...(payload.socialChannels !== undefined
      ? { socialChannels: payload.socialChannels }
      : {}),
    ...(payload.socialPosts !== undefined ? { socialPosts: payload.socialPosts } : {}),
    ...(payload.financialEntries !== undefined
      ? { financialEntries: payload.financialEntries }
      : {}),
    ...(payload.financialTransactions !== undefined
      ? { financialTransactions: payload.financialTransactions }
      : {}),
    ...(payload.financialCategories !== undefined
      ? { financialCategories: payload.financialCategories }
      : {}),
    ...(payload.financialRecurrences !== undefined
      ? { financialRecurrences: payload.financialRecurrences }
      : {}),
    ...(payload.financialSettings !== undefined
      ? { financialSettings: payload.financialSettings }
      : {}),
    ...(payload.financialAuditLogs !== undefined
      ? { financialAuditLogs: payload.financialAuditLogs }
      : {}),
    ...(payload.resourceFiles !== undefined ? { resourceFiles: payload.resourceFiles } : {}),
    ...(payload.resourceFolders !== undefined
      ? { resourceFolders: payload.resourceFolders }
      : {}),
    ...(payload.resourceCategories !== undefined
      ? { resourceCategories: payload.resourceCategories }
      : {}),
    ...(payload.commercialScripts !== undefined
      ? { commercialScripts: payload.commercialScripts }
      : {}),
    ...(payload.modelTemplates !== undefined ? { modelTemplates: payload.modelTemplates } : {}),
  });

  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    const c = canonical.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c ^ (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `fnv1a-${canonical.length}-${part1}${part2}`;
}

/**
 * Builds a complete, integrity-checked v3.0 JSON backup including CRM, Clientes,
 * Propostas, Projetos, Tarefas, Agenda Integrada e Redes Sociais (sem credenciais).
 */
export function buildCompleteBackupData(params: {
  niches: NicheCampaign[];
  leads: Lead[];
  importedSheets: ImportedSheet[];
  clients?: Client[];
  proposals?: ProposalContract[];
  projects?: Project[];
  tasks?: Task[];
  agendaEvents?: AgendaEvent[];
  socialChannels?: SocialChannel[];
  socialPosts?: SocialPost[];
  financialEntries?: FinancialEntry[];
  financialTransactions?: FinancialTransaction[];
  financialCategories?: FinancialCategory[];
  financialRecurrences?: FinancialRecurrence[];
  financialSettings?: FinancialSettings;
  financialAuditLogs?: FinancialAuditLog[];
  resourceFiles?: ResourceFile[];
  resourceFolders?: ResourceFolder[];
  resourceCategories?: ResourceCategory[];
  commercialScripts?: CommercialScript[];
  modelTemplates?: ModelTemplate[];
  userName: string;
  exportedAt?: string;
}): CompleteBackupData {
  const exportedAt = params.exportedAt || new Date().toISOString();
  const metadata: BackupMetadata = {
    projectId: firebaseConfig.projectId,
    firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
    workspaceId: WORKSPACE_ID,
    environment: APP_ENV,
  };
  const counts: BackupCounts = {
    niches: params.niches.length,
    leads: params.leads.length,
    importedSheets: params.importedSheets.length,
    ...(params.clients !== undefined ? { clients: params.clients.length } : {}),
    ...(params.proposals !== undefined ? { proposals: params.proposals.length } : {}),
    ...(params.projects !== undefined ? { projects: params.projects.length } : {}),
    ...(params.tasks !== undefined ? { tasks: params.tasks.length } : {}),
    ...(params.agendaEvents !== undefined
      ? { agendaEvents: params.agendaEvents.length }
      : {}),
    ...(params.socialChannels !== undefined
      ? { socialChannels: params.socialChannels.length }
      : {}),
    ...(params.socialPosts !== undefined
      ? { socialPosts: params.socialPosts.length }
      : {}),
    ...(params.financialEntries !== undefined
      ? { financialEntries: params.financialEntries.length }
      : {}),
    ...(params.financialTransactions !== undefined
      ? { financialTransactions: params.financialTransactions.length }
      : {}),
    ...(params.financialCategories !== undefined
      ? { financialCategories: params.financialCategories.length }
      : {}),
    ...(params.financialRecurrences !== undefined
      ? { financialRecurrences: params.financialRecurrences.length }
      : {}),
    ...(params.financialAuditLogs !== undefined
      ? { financialAuditLogs: params.financialAuditLogs.length }
      : {}),
    ...(params.resourceFiles !== undefined
      ? { resourceFiles: params.resourceFiles.length }
      : {}),
    ...(params.resourceFolders !== undefined
      ? { resourceFolders: params.resourceFolders.length }
      : {}),
    ...(params.resourceCategories !== undefined
      ? { resourceCategories: params.resourceCategories.length }
      : {}),
    ...(params.commercialScripts !== undefined
      ? { commercialScripts: params.commercialScripts.length }
      : {}),
    ...(params.modelTemplates !== undefined
      ? { modelTemplates: params.modelTemplates.length }
      : {}),
  };

  const basePayload = {
    version: BACKUP_FORMAT_VERSION,
    exportedAt,
    userName: params.userName || 'Admin',
    metadata,
    counts,
    niches: params.niches,
    leads: params.leads,
    importedSheets: params.importedSheets,
    ...(params.clients !== undefined ? { clients: params.clients } : {}),
    ...(params.proposals !== undefined ? { proposals: params.proposals } : {}),
    ...(params.projects !== undefined ? { projects: params.projects } : {}),
    ...(params.tasks !== undefined ? { tasks: params.tasks } : {}),
    ...(params.agendaEvents !== undefined ? { agendaEvents: params.agendaEvents } : {}),
    ...(params.socialChannels !== undefined
      ? { socialChannels: params.socialChannels }
      : {}),
    ...(params.socialPosts !== undefined ? { socialPosts: params.socialPosts } : {}),
    ...(params.financialEntries !== undefined
      ? { financialEntries: params.financialEntries }
      : {}),
    ...(params.financialTransactions !== undefined
      ? { financialTransactions: params.financialTransactions }
      : {}),
    ...(params.financialCategories !== undefined
      ? { financialCategories: params.financialCategories }
      : {}),
    ...(params.financialRecurrences !== undefined
      ? { financialRecurrences: params.financialRecurrences }
      : {}),
    ...(params.financialSettings !== undefined
      ? { financialSettings: params.financialSettings }
      : {}),
    ...(params.financialAuditLogs !== undefined
      ? { financialAuditLogs: params.financialAuditLogs }
      : {}),
    ...(params.resourceFiles !== undefined ? { resourceFiles: params.resourceFiles } : {}),
    ...(params.resourceFolders !== undefined
      ? { resourceFolders: params.resourceFolders }
      : {}),
    ...(params.resourceCategories !== undefined
      ? { resourceCategories: params.resourceCategories }
      : {}),
    ...(params.commercialScripts !== undefined
      ? { commercialScripts: params.commercialScripts }
      : {}),
    ...(params.modelTemplates !== undefined ? { modelTemplates: params.modelTemplates } : {}),
  };

  return {
    ...basePayload,
    integrityHash: computeBackupIntegrityHash(basePayload),
  };
}

export function serializeCompleteBackupJson(params: {
  niches: NicheCampaign[];
  leads: Lead[];
  importedSheets: ImportedSheet[];
  clients?: Client[];
  proposals?: ProposalContract[];
  projects?: Project[];
  tasks?: Task[];
  agendaEvents?: AgendaEvent[];
  socialChannels?: SocialChannel[];
  socialPosts?: SocialPost[];
  financialEntries?: FinancialEntry[];
  financialTransactions?: FinancialTransaction[];
  financialCategories?: FinancialCategory[];
  financialRecurrences?: FinancialRecurrence[];
  financialSettings?: FinancialSettings;
  financialAuditLogs?: FinancialAuditLog[];
  resourceFiles?: ResourceFile[];
  resourceFolders?: ResourceFolder[];
  resourceCategories?: ResourceCategory[];
  commercialScripts?: CommercialScript[];
  modelTemplates?: ModelTemplate[];
  userName: string;
}): string {
  return JSON.stringify(buildCompleteBackupData(params), null, 2);
}

/**
 * Parses and validates backup JSON (v3.0 complete or legacy v2.0), verifying structural
 * integrity and optional checksum without silently discarding errors.
 */
export function parseAndValidateBackup(jsonString: string): BackupValidationResult {
  const warnings: string[] = [];

  if (!jsonString || typeof jsonString !== 'string') {
    return { ok: false, error: 'Arquivo de backup vazio ou ilegível.', warnings };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { ok: false, error: 'O arquivo não contém um JSON válido.', warnings };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Estrutura raiz do backup inválida.', warnings };
  }

  const obj = parsed as Record<string, unknown>;
  const version = typeof obj.version === 'string' ? obj.version : '2.0';
  if (version !== '2.0' && version !== '3.0') {
    return {
      ok: false,
      error: `Versão de backup não suportada ("${version}"). Versões compatíveis: 2.0 e 3.0.`,
      warnings,
    };
  }

  if (!Array.isArray(obj.niches) || !Array.isArray(obj.leads)) {
    return {
      ok: false,
      error: 'Backup inválido: os campos obrigatórios "niches" e "leads" devem ser listas.',
      warnings,
    };
  }

  const importedSheetsRaw = Array.isArray(obj.importedSheets) ? obj.importedSheets : [];
  if (version === '2.0' || !Array.isArray(obj.importedSheets)) {
    warnings.push(
      'Backup em formato legado (v2.0) sem histórico de planilhas importadas (importedSheets).'
    );
  }

  for (let i = 0; i < obj.niches.length; i++) {
    const n = obj.niches[i] as Partial<NicheCampaign> | null;
    if (!n || typeof n !== 'object' || !n.id || typeof n.id !== 'string' || !n.name) {
      return {
        ok: false,
        error: `Nicho inválido encontrado no índice ${i} (id ou name ausente).`,
        warnings,
      };
    }
  }

  for (let i = 0; i < obj.leads.length; i++) {
    const l = obj.leads[i] as Partial<Lead> | null;
    if (!l || typeof l !== 'object' || !l.id || typeof l.id !== 'string' || !l.companyName) {
      return {
        ok: false,
        error: `Lead inválido encontrado no índice ${i} (id ou companyName ausente).`,
        warnings,
      };
    }
  }

  for (let i = 0; i < importedSheetsRaw.length; i++) {
    const s = importedSheetsRaw[i] as Partial<ImportedSheet> | null;
    if (!s || typeof s !== 'object' || !s.id || typeof s.id !== 'string' || !s.name) {
      return {
        ok: false,
        error: `Registro de planilha inválido no índice ${i} (id ou name ausente).`,
        warnings,
      };
    }
  }

  const hasClientsField = Array.isArray(obj.clients);
  const hasProposalsField = Array.isArray(obj.proposals);
  const hasProjectsField = Array.isArray(obj.projects);
  const hasTasksField = Array.isArray(obj.tasks);
  const hasAgendaEventsField = Array.isArray(obj.agendaEvents);
  const hasSocialChannelsField = Array.isArray(obj.socialChannels);
  const hasSocialPostsField = Array.isArray(obj.socialPosts);
  const hasFinancialEntriesField = Array.isArray(obj.financialEntries);
  const hasFinancialTransactionsField = Array.isArray(obj.financialTransactions);
  const hasFinancialCategoriesField = Array.isArray(obj.financialCategories);
  const hasFinancialRecurrencesField = Array.isArray(obj.financialRecurrences);
  const hasFinancialSettingsField = Boolean(
    obj.financialSettings && typeof obj.financialSettings === 'object'
  );
  const hasFinancialAuditLogsField = Array.isArray(obj.financialAuditLogs);
  const hasResourceFilesField = Array.isArray(obj.resourceFiles);
  const hasResourceFoldersField = Array.isArray(obj.resourceFolders);
  const hasResourceCategoriesField = Array.isArray(obj.resourceCategories);
  const hasCommercialScriptsField = Array.isArray(obj.commercialScripts);
  const hasModelTemplatesField = Array.isArray(obj.modelTemplates);

  const normalizedData: CompleteBackupData = {
    version,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    userName: typeof obj.userName === 'string' ? obj.userName : 'Admin',
    metadata:
      obj.metadata && typeof obj.metadata === 'object'
        ? (obj.metadata as BackupMetadata)
        : undefined,
    counts:
      obj.counts && typeof obj.counts === 'object' ? (obj.counts as BackupCounts) : undefined,
    integrityHash: typeof obj.integrityHash === 'string' ? obj.integrityHash : undefined,
    niches: obj.niches as NicheCampaign[],
    leads: (obj.leads as Lead[]).map((l) => ({
      ...l,
      stage: normalizeStageId(l.stage),
      notes: Array.isArray(l.notes) ? l.notes : [],
    })),
    importedSheets: importedSheetsRaw as ImportedSheet[],
    ...(hasClientsField
      ? {
          clients: (obj.clients as Client[]).map((c) => ({
            ...c,
            timeline: Array.isArray(c.timeline) ? c.timeline : [],
          })),
        }
      : {}),
    ...(hasProposalsField
      ? {
          proposals: (obj.proposals as ProposalContract[]).map((p) => ({
            ...p,
            items: Array.isArray(p.items) ? p.items : [],
            history: Array.isArray(p.history) ? p.history : [],
          })),
        }
      : {}),
    ...(hasProjectsField
      ? {
          projects: (obj.projects as Project[]).map((proj) => ({
            ...proj,
            documents: Array.isArray(proj.documents) ? proj.documents : [],
            history: Array.isArray(proj.history) ? proj.history : [],
          })),
        }
      : {}),
    ...(hasTasksField
      ? {
          tasks: (obj.tasks as Task[]).map((t) => ({
            ...t,
            checklist: Array.isArray(t.checklist) ? t.checklist : [],
          })),
        }
      : {}),
    ...(hasAgendaEventsField
      ? { agendaEvents: obj.agendaEvents as AgendaEvent[] }
      : {}),
    ...(hasSocialChannelsField
      ? { socialChannels: obj.socialChannels as SocialChannel[] }
      : {}),
    ...(hasSocialPostsField ? { socialPosts: obj.socialPosts as SocialPost[] } : {}),
    ...(hasFinancialEntriesField
      ? { financialEntries: obj.financialEntries as FinancialEntry[] }
      : {}),
    ...(hasFinancialTransactionsField
      ? { financialTransactions: obj.financialTransactions as FinancialTransaction[] }
      : {}),
    ...(hasFinancialCategoriesField
      ? { financialCategories: obj.financialCategories as FinancialCategory[] }
      : {}),
    ...(hasFinancialRecurrencesField
      ? { financialRecurrences: obj.financialRecurrences as FinancialRecurrence[] }
      : {}),
    ...(hasFinancialSettingsField
      ? { financialSettings: obj.financialSettings as FinancialSettings }
      : {}),
    ...(hasFinancialAuditLogsField
      ? { financialAuditLogs: obj.financialAuditLogs as FinancialAuditLog[] }
      : {}),
    ...(hasResourceFilesField ? { resourceFiles: obj.resourceFiles as ResourceFile[] } : {}),
    ...(hasResourceFoldersField
      ? { resourceFolders: obj.resourceFolders as ResourceFolder[] }
      : {}),
    ...(hasResourceCategoriesField
      ? { resourceCategories: obj.resourceCategories as ResourceCategory[] }
      : {}),
    ...(hasCommercialScriptsField
      ? { commercialScripts: obj.commercialScripts as CommercialScript[] }
      : {}),
    ...(hasModelTemplatesField
      ? { modelTemplates: obj.modelTemplates as ModelTemplate[] }
      : {}),
  };

  if (version === '3.0' && normalizedData.integrityHash) {
    const expectedHash = computeBackupIntegrityHash({
      version: normalizedData.version,
      exportedAt: normalizedData.exportedAt,
      userName: normalizedData.userName,
      metadata: normalizedData.metadata,
      counts: normalizedData.counts,
      niches: normalizedData.niches,
      leads: normalizedData.leads,
      importedSheets: normalizedData.importedSheets,
      ...(hasClientsField ? { clients: normalizedData.clients } : {}),
      ...(hasProposalsField ? { proposals: normalizedData.proposals } : {}),
      ...(hasProjectsField ? { projects: normalizedData.projects } : {}),
      ...(hasTasksField ? { tasks: normalizedData.tasks } : {}),
      ...(hasAgendaEventsField ? { agendaEvents: normalizedData.agendaEvents } : {}),
      ...(hasSocialChannelsField ? { socialChannels: normalizedData.socialChannels } : {}),
      ...(hasSocialPostsField ? { socialPosts: normalizedData.socialPosts } : {}),
      ...(hasFinancialEntriesField ? { financialEntries: normalizedData.financialEntries } : {}),
      ...(hasFinancialTransactionsField
        ? { financialTransactions: normalizedData.financialTransactions }
        : {}),
      ...(hasFinancialCategoriesField
        ? { financialCategories: normalizedData.financialCategories }
        : {}),
      ...(hasFinancialRecurrencesField
        ? { financialRecurrences: normalizedData.financialRecurrences }
        : {}),
      ...(hasFinancialSettingsField
        ? { financialSettings: normalizedData.financialSettings }
        : {}),
      ...(hasFinancialAuditLogsField
        ? { financialAuditLogs: normalizedData.financialAuditLogs }
        : {}),
      ...(hasResourceFilesField ? { resourceFiles: normalizedData.resourceFiles } : {}),
      ...(hasResourceFoldersField ? { resourceFolders: normalizedData.resourceFolders } : {}),
      ...(hasResourceCategoriesField
        ? { resourceCategories: normalizedData.resourceCategories }
        : {}),
      ...(hasCommercialScriptsField
        ? { commercialScripts: normalizedData.commercialScripts }
        : {}),
      ...(hasModelTemplatesField ? { modelTemplates: normalizedData.modelTemplates } : {}),
    });
    if (expectedHash !== normalizedData.integrityHash) {
      return {
        ok: false,
        error:
          'Falha na validação de integridade (checksum divergente). O arquivo pode estar corrompido ou editado manualmente.',
        warnings,
      };
    }
  }

  if (
    normalizedData.counts &&
    (normalizedData.counts.leads !== normalizedData.leads.length ||
      normalizedData.counts.niches !== normalizedData.niches.length ||
      normalizedData.counts.importedSheets !== normalizedData.importedSheets.length ||
      (normalizedData.counts.clients !== undefined &&
        normalizedData.counts.clients !== (normalizedData.clients?.length ?? 0)) ||
      (normalizedData.counts.proposals !== undefined &&
        normalizedData.counts.proposals !== (normalizedData.proposals?.length ?? 0)) ||
      (normalizedData.counts.projects !== undefined &&
        normalizedData.counts.projects !== (normalizedData.projects?.length ?? 0)) ||
      (normalizedData.counts.tasks !== undefined &&
        normalizedData.counts.tasks !== (normalizedData.tasks?.length ?? 0)) ||
      (normalizedData.counts.agendaEvents !== undefined &&
        normalizedData.counts.agendaEvents !== (normalizedData.agendaEvents?.length ?? 0)) ||
      (normalizedData.counts.socialChannels !== undefined &&
        normalizedData.counts.socialChannels !==
          (normalizedData.socialChannels?.length ?? 0)) ||
      (normalizedData.counts.socialPosts !== undefined &&
        normalizedData.counts.socialPosts !== (normalizedData.socialPosts?.length ?? 0)) ||
      (normalizedData.counts.financialEntries !== undefined &&
        normalizedData.counts.financialEntries !==
          (normalizedData.financialEntries?.length ?? 0)) ||
      (normalizedData.counts.financialTransactions !== undefined &&
        normalizedData.counts.financialTransactions !==
          (normalizedData.financialTransactions?.length ?? 0)) ||
      (normalizedData.counts.financialCategories !== undefined &&
        normalizedData.counts.financialCategories !==
          (normalizedData.financialCategories?.length ?? 0)) ||
      (normalizedData.counts.financialRecurrences !== undefined &&
        normalizedData.counts.financialRecurrences !==
          (normalizedData.financialRecurrences?.length ?? 0)) ||
      (normalizedData.counts.financialAuditLogs !== undefined &&
        normalizedData.counts.financialAuditLogs !==
          (normalizedData.financialAuditLogs?.length ?? 0)) ||
      (normalizedData.counts.resourceFiles !== undefined &&
        normalizedData.counts.resourceFiles !== (normalizedData.resourceFiles?.length ?? 0)) ||
      (normalizedData.counts.resourceFolders !== undefined &&
        normalizedData.counts.resourceFolders !==
          (normalizedData.resourceFolders?.length ?? 0)) ||
      (normalizedData.counts.resourceCategories !== undefined &&
        normalizedData.counts.resourceCategories !==
          (normalizedData.resourceCategories?.length ?? 0)) ||
      (normalizedData.counts.commercialScripts !== undefined &&
        normalizedData.counts.commercialScripts !==
          (normalizedData.commercialScripts?.length ?? 0)) ||
      (normalizedData.counts.modelTemplates !== undefined &&
        normalizedData.counts.modelTemplates !==
          (normalizedData.modelTemplates?.length ?? 0)))
  ) {
    return {
      ok: false,
      error: 'A contagem declarada no cabeçalho do backup não confere com os registros do arquivo.',
      warnings,
    };
  }

  return { ok: true, warnings, data: normalizedData };
}

/**
 * Analyzes what a restore operation will add, update, or encounter as duplicates
 * before writing anything to local state or Firestore.
 */
export function analyzeBackupRestore(
  backup: CompleteBackupData,
  current: {
    niches: NicheCampaign[];
    leads: Lead[];
    importedSheets: ImportedSheet[];
  }
): RestoreAnalysisSummary {
  const existingNicheIds = new Set(current.niches.map((n) => n.id));
  const existingLeadIds = new Set(current.leads.map((l) => l.id));
  const existingSheetIds = new Set(current.importedSheets.map((s) => s.id));

  const existingPhoneKeys = new Set(
    current.leads
      .map((l) => {
        const clean = cleanPhoneForWhatsApp(l.phone || '');
        return clean ? `${l.nicheId || ''}::${clean}` : '';
      })
      .filter(Boolean)
  );

  let nichesNew = 0;
  let nichesExisting = 0;
  for (const n of backup.niches) {
    if (existingNicheIds.has(n.id)) nichesExisting++;
    else nichesNew++;
  }

  let leadsNew = 0;
  let leadsExistingById = 0;
  let leadsPotentialPhoneDuplicates = 0;
  const backupAndCurrentNicheIds = new Set([
    ...current.niches.map((n) => n.id),
    ...backup.niches.map((n) => n.id),
  ]);
  let orphanLeadsInFile = 0;

  for (const l of backup.leads) {
    if (l.nicheId && !backupAndCurrentNicheIds.has(l.nicheId)) {
      orphanLeadsInFile++;
    }
    if (existingLeadIds.has(l.id)) {
      leadsExistingById++;
    } else {
      leadsNew++;
      const clean = cleanPhoneForWhatsApp(l.phone || '');
      if (clean && existingPhoneKeys.has(`${l.nicheId || ''}::${clean}`)) {
        leadsPotentialPhoneDuplicates++;
      }
    }
  }

  let sheetsNew = 0;
  let sheetsExisting = 0;
  for (const s of backup.importedSheets) {
    if (existingSheetIds.has(s.id)) sheetsExisting++;
    else sheetsNew++;
  }

  return {
    version: backup.version,
    exportedAt: backup.exportedAt,
    sourceWorkspace: backup.metadata?.workspaceId,
    sourceDatabaseId: backup.metadata?.firestoreDatabaseId,
    totalNichesInFile: backup.niches.length,
    totalLeadsInFile: backup.leads.length,
    totalSheetsInFile: backup.importedSheets.length,
    nichesNew,
    nichesExisting,
    leadsNew,
    leadsExistingById,
    leadsPotentialPhoneDuplicates,
    sheetsNew,
    sheetsExisting,
    orphanLeadsInFile,
  };
}

/**
 * Prepares the exact records to persist during an explicitly confirmed restore,
 * preserving original IDs and links while honoring duplicate strategy.
 */
export function prepareBackupRestorePayload(
  backup: CompleteBackupData,
  current: {
    niches: NicheCampaign[];
    leads: Lead[];
    importedSheets: ImportedSheet[];
  },
  strategy: RestoreDuplicateStrategy
): {
  nichesToWrite: NicheCampaign[];
  leadsToWrite: Lead[];
  sheetsToWrite: ImportedSheet[];
  clientsToWrite: Client[];
  proposalsToWrite: ProposalContract[];
  projectsToWrite: Project[];
  tasksToWrite: Task[];
  agendaEventsToWrite: AgendaEvent[];
  socialChannelsToWrite: SocialChannel[];
  socialPostsToWrite: SocialPost[];
  financialEntriesToWrite: FinancialEntry[];
  financialTransactionsToWrite: FinancialTransaction[];
  financialCategoriesToWrite: FinancialCategory[];
  financialRecurrencesToWrite: FinancialRecurrence[];
  financialSettingsToWrite?: FinancialSettings;
  financialAuditLogsToWrite: FinancialAuditLog[];
  resourceFilesToWrite: ResourceFile[];
  resourceFoldersToWrite: ResourceFolder[];
  resourceCategoriesToWrite: ResourceCategory[];
  commercialScriptsToWrite: CommercialScript[];
  modelTemplatesToWrite: ModelTemplate[];
  skippedDuplicates: number;
} {
  const existingLeadIds = new Set(current.leads.map((l) => l.id));
  const existingPhoneKeys = new Set(
    current.leads
      .map((l) => {
        const clean = cleanPhoneForWhatsApp(l.phone || '');
        return clean ? `${l.nicheId || ''}::${clean}` : '';
      })
      .filter(Boolean)
  );

  let skippedDuplicates = 0;
  const leadsToWrite: Lead[] = [];

  for (const l of backup.leads) {
    const clean = cleanPhoneForWhatsApp(l.phone || '');
    const key = clean ? `${l.nicheId || ''}::${clean}` : '';
    const isNewIdWithDuplicatePhone =
      !existingLeadIds.has(l.id) && Boolean(key) && existingPhoneKeys.has(key);

    if (strategy === 'skip_phone_duplicates' && isNewIdWithDuplicatePhone) {
      skippedDuplicates++;
      continue;
    }

    leadsToWrite.push({
      ...l,
      stage: normalizeStageId(l.stage),
      notes: Array.isArray(l.notes) ? l.notes : [],
      schemaVersion: l.schemaVersion ?? 1,
    });
  }

  const nichesToWrite: NicheCampaign[] = backup.niches.map((n) => ({
    ...n,
    schemaVersion: n.schemaVersion ?? 1,
  }));

  const sheetsToWrite: ImportedSheet[] = backup.importedSheets.map((s) => ({
    ...s,
    schemaVersion: s.schemaVersion ?? 1,
  }));

  const clientsToWrite: Client[] = (backup.clients || []).map((c) => ({
    ...c,
    timeline: Array.isArray(c.timeline) ? c.timeline : [],
    schemaVersion: c.schemaVersion ?? 1,
  }));

  const proposalsToWrite: ProposalContract[] = (backup.proposals || []).map((p) => ({
    ...p,
    items: Array.isArray(p.items) ? p.items : [],
    history: Array.isArray(p.history) ? p.history : [],
    schemaVersion: p.schemaVersion ?? 1,
  }));

  const projectsToWrite: Project[] = (backup.projects || []).map((proj) => ({
    ...proj,
    documents: Array.isArray(proj.documents) ? proj.documents : [],
    history: Array.isArray(proj.history) ? proj.history : [],
    schemaVersion: proj.schemaVersion ?? 1,
  }));

  const tasksToWrite: Task[] = (backup.tasks || []).map((t) => ({
    ...t,
    checklist: Array.isArray(t.checklist) ? t.checklist : [],
    schemaVersion: t.schemaVersion ?? 1,
  }));

  const agendaEventsToWrite: AgendaEvent[] = (backup.agendaEvents || []).map((ev) => ({
    ...ev,
    schemaVersion: ev.schemaVersion ?? 1,
  }));

  const socialChannelsToWrite: SocialChannel[] = (backup.socialChannels || []).map(
    (ch) => ({
      ...ch,
      schemaVersion: ch.schemaVersion ?? 1,
    })
  );

  const socialPostsToWrite: SocialPost[] = (backup.socialPosts || []).map((post) => ({
    ...post,
    schemaVersion: post.schemaVersion ?? 1,
  }));

  const financialEntriesToWrite: FinancialEntry[] = (backup.financialEntries || []).map(
    (entry) => ({
      ...entry,
      schemaVersion: entry.schemaVersion ?? 1,
    })
  );

  const financialTransactionsToWrite: FinancialTransaction[] = (
    backup.financialTransactions || []
  ).map((tx) => ({
    ...tx,
    schemaVersion: tx.schemaVersion ?? 1,
  }));

  const financialCategoriesToWrite: FinancialCategory[] = (
    backup.financialCategories || []
  ).map((cat) => ({
    ...cat,
    schemaVersion: cat.schemaVersion ?? 1,
  }));

  const financialRecurrencesToWrite: FinancialRecurrence[] = (
    backup.financialRecurrences || []
  ).map((rec) => ({
    ...rec,
    schemaVersion: rec.schemaVersion ?? 1,
  }));

  const financialSettingsToWrite: FinancialSettings | undefined = backup.financialSettings
    ? {
        ...backup.financialSettings,
        openingBalanceHistory: Array.isArray(backup.financialSettings.openingBalanceHistory)
          ? backup.financialSettings.openingBalanceHistory
          : [],
        paymentMethods: Array.isArray(backup.financialSettings.paymentMethods)
          ? backup.financialSettings.paymentMethods
          : [],
        schemaVersion: backup.financialSettings.schemaVersion ?? 1,
      }
    : undefined;

  const financialAuditLogsToWrite: FinancialAuditLog[] = (
    backup.financialAuditLogs || []
  ).map((log) => ({
    ...log,
    schemaVersion: log.schemaVersion ?? 1,
  }));

  const resourceFilesToWrite: ResourceFile[] = (backup.resourceFiles || []).map((f) => ({
    ...f,
    tags: Array.isArray(f.tags) ? f.tags : [],
    schemaVersion: f.schemaVersion ?? 1,
  }));

  const resourceFoldersToWrite: ResourceFolder[] = (backup.resourceFolders || []).map((f) => ({
    ...f,
    schemaVersion: f.schemaVersion ?? 1,
  }));

  const resourceCategoriesToWrite: ResourceCategory[] = (
    backup.resourceCategories || []
  ).map((c) => ({
    ...c,
    schemaVersion: c.schemaVersion ?? 1,
  }));

  const commercialScriptsToWrite: CommercialScript[] = (
    backup.commercialScripts || []
  ).map((s) => ({
    ...s,
    tags: Array.isArray(s.tags) ? s.tags : [],
    schemaVersion: s.schemaVersion ?? 1,
  }));

  const modelTemplatesToWrite: ModelTemplate[] = (backup.modelTemplates || []).map((t) => ({
    ...t,
    tags: Array.isArray(t.tags) ? t.tags : [],
    schemaVersion: t.schemaVersion ?? 1,
  }));

  return {
    nichesToWrite,
    leadsToWrite,
    sheetsToWrite,
    clientsToWrite,
    proposalsToWrite,
    projectsToWrite,
    tasksToWrite,
    agendaEventsToWrite,
    socialChannelsToWrite,
    socialPostsToWrite,
    financialEntriesToWrite,
    financialTransactionsToWrite,
    financialCategoriesToWrite,
    financialRecurrencesToWrite,
    financialSettingsToWrite,
    financialAuditLogsToWrite,
    resourceFilesToWrite,
    resourceFoldersToWrite,
    resourceCategoriesToWrite,
    commercialScriptsToWrite,
    modelTemplatesToWrite,
    skippedDuplicates,
  };
}
