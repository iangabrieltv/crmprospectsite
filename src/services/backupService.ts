import { ImportedSheet, Lead, NicheCampaign, normalizeStageId } from '../types/crm';
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
 * Builds a complete, integrity-checked v3.0 JSON backup including leads, niches, scripts,
 * histories, meetings, callbacks, and importedSheets (without exposing any credentials).
 */
export function buildCompleteBackupData(params: {
  niches: NicheCampaign[];
  leads: Lead[];
  importedSheets: ImportedSheet[];
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
      normalizedData.counts.importedSheets !== normalizedData.importedSheets.length)
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

  return {
    nichesToWrite,
    leadsToWrite,
    sheetsToWrite,
    skippedDuplicates,
  };
}
