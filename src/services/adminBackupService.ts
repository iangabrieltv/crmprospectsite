import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DocumentReference, GeoPoint, Timestamp } from 'firebase-admin/firestore';

export interface ReadableDocSnapshot {
  id: string;
  exists: boolean;
  ref: ReadableDocRef;
  data(): Record<string, unknown> | undefined;
}

export interface ReadableQuerySnapshot {
  docs: ReadableDocSnapshot[];
  forEach(cb: (doc: ReadableDocSnapshot) => void): void;
}

export interface ReadableDocRef {
  id: string;
  path: string;
  get(): Promise<ReadableDocSnapshot>;
  collection(name: string): ReadableCollectionRef;
  listCollections(): Promise<ReadableCollectionRef[]>;
}

export interface ReadableCollectionRef {
  id: string;
  path: string;
  doc(id: string): ReadableDocRef;
  get(): Promise<ReadableQuerySnapshot>;
  listDocuments?: () => Promise<ReadableDocRef[]>;
}

export interface ReadableFirestore {
  collection(name: string): ReadableCollectionRef;
  listCollections(): Promise<ReadableCollectionRef[]>;
}

export interface RecursiveBackupDocNode {
  id: string;
  path: string;
  exists: boolean;
  hasOwnFields: boolean;
  data: Record<string, unknown>;
  subcollections: Record<string, RecursiveBackupDocNode[]>;
}

export interface BackupReadError {
  path: string;
  stage:
    | 'root_list'
    | 'root_inventory'
    | 'workspace_doc'
    | 'collection_list'
    | 'document_list'
    | 'document_get'
    | 'collection_get'
    | 'subcollection_list'
    | 'serialization'
    | 'disk_write'
    | 'validation';
  code?:
    | 'MISSING_CREDENTIALS'
    | 'PERMISSION_DENIED'
    | 'INVALID_DATABASE'
    | 'INVALID_WORKSPACE'
    | 'READ_ERROR'
    | 'SERIALIZATION_ERROR'
    | 'DISK_WRITE_ERROR'
    | 'VALIDATION_FAILED'
    | 'INCOMPLETE_BACKUP';
  message: string;
}

export interface RootCollectionInventoryItem {
  name: string;
  path: string;
  inBackupScope: boolean;
  isInternalSystemCollection: boolean;
  estimatedDocCount: number | null;
  scopeReason: string;
}

export interface ExcludedScopeItem {
  name: string;
  path: string;
  kind: 'external_root_collection' | 'other_workspace' | 'internal_system_collection';
  estimatedDocCount: number | null;
  reason: string;
}

export interface NdjsonFileRecord {
  collectionPath: string;
  fileName: string;
  documentCount: number;
  fieldlessDocumentsCount: number;
  sizeBytes: number;
  sha256: string;
}

export interface RecursiveBackupManifest {
  version: '3.1-admin-recursive' | '3.2-admin-recursive';
  readOnly: true;
  exportedAt: string;
  projectId: string;
  firestoreDatabaseId: string;
  workspaceId: string;
  rootCollectionsDiscovered: string[];
  rootCollectionsInventory?: RootCollectionInventoryItem[];
  includedCollections?: string[];
  excludedCollections?: ExcludedScopeItem[];
  workspaceDocument: {
    exists: boolean;
    hasOwnFields?: boolean;
    path: string;
    data: Record<string, unknown> | null;
  };
  discoveredCollections: string[];
  emptyCollections?: string[];
  countsByCollection: Record<string, number>;
  subcollectionCountsByPath?: Record<string, number>;
  totalDocuments: number;
  subcollectionsCount: number;
  documentsWithoutFieldsCount?: number;
  documentsWithoutFieldsPaths?: string[];
  preservedPathsCount: number;
  maxDepth: number;
  collections: Record<string, RecursiveBackupDocNode[]>;
  ndjsonFiles?: NdjsonFileRecord[];
  generatedFiles?: string[];
  warnings?: string[];
  errors: BackupReadError[];
  preWriteValidation?: {
    valid: boolean;
    issues: string[];
  };
  checksumSha256: string;
}

export interface NdjsonFileValidationResult {
  collectionPath: string;
  fileName: string;
  exists: boolean;
  readable: boolean;
  validJsonLines: boolean;
  pathsMatchCollection: boolean;
  expectedCount: number;
  actualCount: number;
  expectedFieldlessCount: number;
  actualFieldlessCount: number;
  expectedSha256: string;
  actualSha256: string;
  checksumMatch: boolean;
  issues: string[];
}

export interface BackupValidationResult {
  valid: boolean;
  status: 'SUCCESS' | 'FAILED';
  issues: string[];
  summary: {
    version: string;
    projectId: string;
    firestoreDatabaseId: string;
    workspaceId: string;
    discoveredCollections: number;
    emptyCollections: number;
    totalDocuments: number;
    subcollectionsCount: number;
    documentsWithoutFieldsCount: number;
    preservedPathsCount: number;
    maxDepth: number;
    errorsCount: number;
    warningsCount: number;
    checksumMatch: boolean;
    ndjsonFilesChecked: number;
    ndjsonFilesValid: number;
  };
  ndjsonResults?: NdjsonFileValidationResult[];
}

export interface CredentialCheckResult {
  ok: boolean;
  method?: 'GOOGLE_APPLICATION_CREDENTIALS' | 'GCLOUD_ADC';
  code?: 'MISSING_CREDENTIALS';
  detail?: string;
}

export interface TargetConfigCheckResult {
  ok: boolean;
  code?: 'INVALID_DATABASE' | 'INVALID_WORKSPACE';
  detail?: string;
}

const SUPPORTED_MANIFEST_VERSIONS = new Set([
  '3.1-admin-recursive',
  '3.2-admin-recursive',
]);

export function isInternalFirebaseCollectionName(name: string): boolean {
  return /^__.*__$/.test(name);
}

export function classifyBackupErrorCode(
  err: unknown,
  fallback: BackupReadError['code'] = 'READ_ERROR'
): BackupReadError['code'] {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes('permission_denied') ||
    lower.includes('permission denied') ||
    lower.includes('missing or insufficient permissions') ||
    lower.includes('unauthenticated') ||
    lower.includes('7 permission_denied')
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    lower.includes('database') &&
    (lower.includes('not found') || lower.includes('does not exist') || lower.includes('invalid'))
  ) {
    return 'INVALID_DATABASE';
  }
  return fallback;
}

export function checkCredentialsAvailability(options?: {
  googleApplicationCredentials?: string;
  homeDir?: string;
}): CredentialCheckResult {
  const credPath = (
    options?.googleApplicationCredentials ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS ??
    ''
  ).trim();

  if (credPath) {
    const resolved = path.resolve(credPath);
    if (!fs.existsSync(resolved)) {
      return {
        ok: false,
        code: 'MISSING_CREDENTIALS',
        detail: `Arquivo GOOGLE_APPLICATION_CREDENTIALS não encontrado em: ${resolved}`,
      };
    }
    return {
      ok: true,
      method: 'GOOGLE_APPLICATION_CREDENTIALS',
    };
  }

  const homeDir = options?.homeDir ?? process.env.HOME ?? '';
  if (homeDir) {
    const adcPath = path.join(homeDir, '.config', 'gcloud', 'application_default_credentials.json');
    if (fs.existsSync(adcPath)) {
      return {
        ok: true,
        method: 'GCLOUD_ADC',
      };
    }
  }

  return {
    ok: false,
    code: 'MISSING_CREDENTIALS',
    detail:
      'Nenhuma credencial administrativa de leitura disponível (GOOGLE_APPLICATION_CREDENTIALS e Application Default Credentials ausentes). Nenhum acesso ao Firestore foi realizado.',
  };
}

export function validateBackupTargetConfig(params: {
  projectId: string;
  firestoreDatabaseId: string;
  workspaceId: string;
  expectedProjectId?: string;
  expectedDatabaseId?: string;
  expectedWorkspaceId?: string;
}): TargetConfigCheckResult {
  const projectId = params.projectId.trim();
  const dbId = params.firestoreDatabaseId.trim();
  const wsId = params.workspaceId.trim();

  if (!projectId) {
    return {
      ok: false,
      code: 'INVALID_DATABASE',
      detail: 'projectId do Firebase não está configurado.',
    };
  }
  if (!dbId || dbId === '(default)') {
    return {
      ok: false,
      code: 'INVALID_DATABASE',
      detail:
        'firestoreDatabaseId inválido ou apontando para (default). O Kaizen exige o banco nomeado configurado.',
    };
  }
  if (params.expectedProjectId && projectId !== params.expectedProjectId) {
    return {
      ok: false,
      code: 'INVALID_DATABASE',
      detail: `projectId divergente: esperado "${params.expectedProjectId}", obtido "${projectId}".`,
    };
  }
  if (params.expectedDatabaseId && dbId !== params.expectedDatabaseId) {
    return {
      ok: false,
      code: 'INVALID_DATABASE',
      detail: `firestoreDatabaseId divergente: esperado "${params.expectedDatabaseId}", obtido "${dbId}".`,
    };
  }
  if (!wsId || !/^[a-zA-Z0-9_-]{3,128}$/.test(wsId)) {
    return {
      ok: false,
      code: 'INVALID_WORKSPACE',
      detail: `workspaceId inválido: "${wsId}".`,
    };
  }
  if (params.expectedWorkspaceId && wsId !== params.expectedWorkspaceId) {
    return {
      ok: false,
      code: 'INVALID_WORKSPACE',
      detail: `workspaceId divergente: esperado "${params.expectedWorkspaceId}", obtido "${wsId}".`,
    };
  }
  return { ok: true };
}

export function buildDeterministicNdjsonFilename(collectionPath: string): string {
  const normalized = collectionPath.trim();
  const slug = normalized
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'collection';
  const hash12 = crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex').slice(0, 12);
  return `${slug}__${hash12}.ndjson`;
}

function isFirestoreTimestampObject(value: unknown): value is {
  seconds?: number;
  nanoseconds?: number;
  _seconds?: number;
  _nanoseconds?: number;
  toDate: () => Date;
} {
  if (value instanceof Timestamp) return true;
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.toDate === 'function' &&
    (typeof obj.seconds === 'number' || typeof obj._seconds === 'number') &&
    (typeof obj.nanoseconds === 'number' || typeof obj._nanoseconds === 'number')
  );
}

function isRealGeoPoint(value: unknown): value is GeoPoint {
  if (value instanceof GeoPoint) return true;
  if (typeof value !== 'object' || value === null) return false;
  const protoName = Object.getPrototypeOf(value)?.constructor?.name;
  const obj = value as Record<string, unknown>;
  return (
    protoName === 'GeoPoint' &&
    typeof obj.latitude === 'number' &&
    typeof obj.longitude === 'number' &&
    typeof obj.isEqual === 'function'
  );
}

function isFirestoreDocumentReference(value: unknown): value is { path: string; id: string } {
  if (value instanceof DocumentReference) return true;
  if (typeof value !== 'object' || value === null) return false;
  const protoName = Object.getPrototypeOf(value)?.constructor?.name;
  const obj = value as Record<string, unknown>;
  if (protoName === 'DocumentReference' && typeof obj.path === 'string') return true;
  return (
    typeof obj.path === 'string' &&
    typeof obj.id === 'string' &&
    ('firestore' in obj || typeof obj.collection === 'function')
  );
}

export function serializeFirestoreValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Date) {
    return {
      __firestoreType: 'Date',
      iso: value.toISOString(),
    };
  }

  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return {
      __firestoreType: 'Bytes',
      base64: Buffer.from(value).toString('base64'),
    };
  }

  if (isFirestoreTimestampObject(value)) {
    const date = value.toDate();
    const seconds =
      typeof value.seconds === 'number'
        ? value.seconds
        : typeof value._seconds === 'number'
        ? value._seconds
        : Math.floor(date.getTime() / 1000);
    const nanoseconds =
      typeof value.nanoseconds === 'number'
        ? value.nanoseconds
        : typeof value._nanoseconds === 'number'
        ? value._nanoseconds
        : (date.getTime() % 1000) * 1_000_000;
    return {
      __firestoreType: 'Timestamp',
      seconds,
      nanoseconds,
      iso: date.toISOString(),
    };
  }

  if (isRealGeoPoint(value)) {
    return {
      __firestoreType: 'GeoPoint',
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }

  if (isFirestoreDocumentReference(value)) {
    return {
      __firestoreType: 'DocumentReference',
      path: value.path,
    };
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new Error('Referência circular detectada em array durante serialização.');
    }
    seen.add(value);
    const mapped = value.map((item) => serializeFirestoreValue(item, seen));
    seen.delete(value);
    return mapped;
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      throw new Error('Referência circular detectada em objeto durante serialização.');
    }
    seen.add(value);
    const obj = value as Record<string, unknown>;
    const serialized: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const val = obj[key];
      if (val !== undefined) {
        serialized[key] = serializeFirestoreValue(val, seen);
      }
    }
    seen.delete(value);
    return serialized;
  }

  return value;
}

export function computeManifestSha256(
  payload: Omit<RecursiveBackupManifest, 'checksumSha256'>
): string {
  const canonical = JSON.stringify(payload);
  return crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

async function safeCountCollectionDocsReadOnly(colRef: ReadableCollectionRef): Promise<number | null> {
  try {
    if (typeof colRef.listDocuments === 'function') {
      const refs = await colRef.listDocuments();
      return refs.length;
    }
    const snap = await colRef.get();
    return snap.docs.length;
  } catch {
    return null;
  }
}

export async function exportWorkspaceTreeReadOnly(
  db: ReadableFirestore,
  params: {
    projectId: string;
    firestoreDatabaseId: string;
    workspaceId: string;
  }
): Promise<RecursiveBackupManifest> {
  const { projectId, firestoreDatabaseId, workspaceId } = params;
  const errors: BackupReadError[] = [];
  const warnings: string[] = [];

  const configCheck = validateBackupTargetConfig({
    projectId,
    firestoreDatabaseId,
    workspaceId,
  });
  if (!configCheck.ok) {
    errors.push({
      path: `workspaces/${workspaceId}`,
      stage: 'validation',
      code: configCheck.code || 'INVALID_WORKSPACE',
      message: configCheck.detail || 'Configuração de destino inválida.',
    });
  }

  const discoveredCollectionsSet = new Set<string>();
  const emptyCollectionsSet = new Set<string>();
  const countsByCollection: Record<string, number> = {};
  const subcollectionCountsByPath: Record<string, number> = {};
  const documentsWithoutFieldsPaths: string[] = [];
  const visitedDocPaths = new Set<string>();
  const visitedCollectionPaths = new Set<string>();

  let totalDocuments = 0;
  let maxDepth = 0;
  let subcollectionsCount = 0;
  let preservedPathsCount = 0;

  // 1. Discover root collections and build separate scope inventory (read-only)
  const rootCollectionsDiscovered: string[] = [];
  const rootCollectionsInventory: RootCollectionInventoryItem[] = [];
  const excludedCollections: ExcludedScopeItem[] = [];

  try {
    const rootCols = await db.listCollections();
    const sortedRootCols = [...rootCols].sort((a, b) => a.id.localeCompare(b.id));
    for (const col of sortedRootCols) {
      rootCollectionsDiscovered.push(col.id);
      const isInternal = isInternalFirebaseCollectionName(col.id);
      if (col.id === 'workspaces') {
        const wsCount = await safeCountCollectionDocsReadOnly(col);
        rootCollectionsInventory.push({
          name: col.id,
          path: col.path,
          inBackupScope: true,
          isInternalSystemCollection: false,
          estimatedDocCount: wsCount,
          scopeReason: `Coleção raiz do workspace alvo (workspaces/${workspaceId})`,
        });

        // Check if there are sibling workspaces outside target scope without reading their contents
        try {
          const wsRefs =
            typeof col.listDocuments === 'function'
              ? await col.listDocuments()
              : (await col.get()).docs.map((d) => d.ref);
          for (const wsRef of wsRefs.sort((a, b) => a.id.localeCompare(b.id))) {
            if (wsRef.id !== workspaceId) {
              excludedCollections.push({
                name: wsRef.id,
                path: wsRef.path,
                kind: 'other_workspace',
                estimatedDocCount: null,
                reason: `Workspace diferente do escopo configurado (${workspaceId}) — não exportado.`,
              });
            }
          }
        } catch (err) {
          errors.push({
            path: col.path,
            stage: 'root_inventory',
            code: classifyBackupErrorCode(err),
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } else if (isInternal) {
        rootCollectionsInventory.push({
          name: col.id,
          path: col.path,
          inBackupScope: false,
          isInternalSystemCollection: true,
          estimatedDocCount: null,
          scopeReason: 'Coleção interna do Firebase/sistema — ignorada pelo backup de aplicação.',
        });
        excludedCollections.push({
          name: col.id,
          path: col.path,
          kind: 'internal_system_collection',
          estimatedDocCount: null,
          reason: 'Coleção interna do Firebase.',
        });
      } else {
        const extCount = await safeCountCollectionDocsReadOnly(col);
        rootCollectionsInventory.push({
          name: col.id,
          path: col.path,
          inBackupScope: false,
          isInternalSystemCollection: false,
          estimatedDocCount: extCount,
          scopeReason: `Coleção raiz externa a workspaces/${workspaceId} — fora do escopo principal.`,
        });
        excludedCollections.push({
          name: col.id,
          path: col.path,
          kind: 'external_root_collection',
          estimatedDocCount: extCount,
          reason: `Coleção externa ao workspace ${workspaceId} — apenas inventariada.`,
        });
      }
    }
  } catch (err) {
    errors.push({
      path: '/',
      stage: 'root_list',
      code: classifyBackupErrorCode(err),
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Read target workspace document itself
  const workspaceRef = db.collection('workspaces').doc(workspaceId);
  let workspaceDocData: Record<string, unknown> | null = null;
  let workspaceDocExists = false;
  let workspaceDocHasOwnFields = false;
  try {
    const wsSnap = await workspaceRef.get();
    workspaceDocExists = Boolean(wsSnap.exists);
    if (wsSnap.exists) {
      const rawWs = wsSnap.data() || {};
      workspaceDocHasOwnFields = Object.keys(rawWs).length > 0;
      workspaceDocData = (serializeFirestoreValue(rawWs) as Record<string, unknown>) || {};
    }
  } catch (err) {
    errors.push({
      path: workspaceRef.path,
      stage: 'workspace_doc',
      code: classifyBackupErrorCode(err),
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // 3. Recursive collection reader (discovers materialized AND phantom/fieldless documents)
  async function dumpCollectionRecursive(
    colRef: ReadableCollectionRef,
    depth: number
  ): Promise<RecursiveBackupDocNode[]> {
    const colPath = colRef.path;
    if (visitedCollectionPaths.has(colPath)) {
      warnings.push(`Caminho de coleção repetido ignorado para evitar ciclo: ${colPath}`);
      return [];
    }
    visitedCollectionPaths.add(colPath);

    discoveredCollectionsSet.add(colPath);
    if (depth > 1) {
      subcollectionsCount += 1;
    }

    const materializedById = new Map<string, ReadableDocSnapshot>();
    const allRefsById = new Map<string, ReadableDocRef>();

    // Read materialized documents first
    try {
      const snap = await colRef.get();
      snap.forEach((docSnap) => {
        materializedById.set(docSnap.id, docSnap);
        allRefsById.set(docSnap.id, docSnap.ref);
      });
    } catch (err) {
      errors.push({
        path: colPath,
        stage: 'collection_get',
        code: classifyBackupErrorCode(err),
        message: err instanceof Error ? err.message : String(err),
      });
      countsByCollection[colPath] = countsByCollection[colPath] ?? 0;
      if (depth > 1) {
        subcollectionCountsByPath[colPath] = subcollectionCountsByPath[colPath] ?? 0;
      }
      return [];
    }

    // Discover all document references including fieldless/phantom container docs via listDocuments()
    if (typeof colRef.listDocuments === 'function') {
      try {
        const listedRefs = await colRef.listDocuments();
        for (const docRef of listedRefs) {
          if (!allRefsById.has(docRef.id)) {
            allRefsById.set(docRef.id, docRef);
          }
        }
      } catch (err) {
        errors.push({
          path: colPath,
          stage: 'document_list',
          code: classifyBackupErrorCode(err),
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const sortedDocIds = Array.from(allRefsById.keys()).sort((a, b) => a.localeCompare(b));
    const nodes: RecursiveBackupDocNode[] = [];

    for (const docId of sortedDocIds) {
      const docRef = allRefsById.get(docId)!;
      if (visitedDocPaths.has(docRef.path)) {
        warnings.push(`Caminho de documento repetido ignorado para evitar ciclo: ${docRef.path}`);
        continue;
      }
      visitedDocPaths.add(docRef.path);

      let docSnap = materializedById.get(docId);
      if (!docSnap) {
        try {
          docSnap = await docRef.get();
        } catch (err) {
          errors.push({
            path: docRef.path,
            stage: 'document_get',
            code: classifyBackupErrorCode(err),
            message: err instanceof Error ? err.message : String(err),
          });
          continue;
        }
      }

      const rawData = docSnap.exists ? docSnap.data() || {} : {};
      const rawKeys = Object.keys(rawData);
      const hasOwnFields = Boolean(docSnap.exists) && rawKeys.length > 0;

      let serializedData: Record<string, unknown> = {};
      if (hasOwnFields) {
        try {
          serializedData = (serializeFirestoreValue(rawData) || {}) as Record<string, unknown>;
        } catch (err) {
          errors.push({
            path: docRef.path,
            stage: 'serialization',
            code: 'SERIALIZATION_ERROR',
            message: err instanceof Error ? err.message : String(err),
          });
          continue;
        }
      }

      const nestedSubcollections: Record<string, RecursiveBackupDocNode[]> = {};
      let subCols: ReadableCollectionRef[] = [];
      try {
        subCols = await docRef.listCollections();
        const sortedSubCols = [...subCols].sort((a, b) => a.id.localeCompare(b.id));
        for (const subCol of sortedSubCols) {
          nestedSubcollections[subCol.id] = await dumpCollectionRecursive(subCol, depth + 1);
        }
      } catch (err) {
        errors.push({
          path: docRef.path,
          stage: 'subcollection_list',
          code: classifyBackupErrorCode(err),
          message: err instanceof Error ? err.message : String(err),
        });
      }

      if (!hasOwnFields) {
        documentsWithoutFieldsPaths.push(docRef.path);
      }

      preservedPathsCount += 1;
      nodes.push({
        id: docRef.id,
        path: docRef.path,
        exists: Boolean(docSnap.exists),
        hasOwnFields,
        data: serializedData,
        subcollections: nestedSubcollections,
      });
    }

    countsByCollection[colPath] = nodes.length;
    totalDocuments += nodes.length;
    if (depth > 1) {
      subcollectionCountsByPath[colPath] = nodes.length;
    }
    if (nodes.length === 0) {
      emptyCollectionsSet.add(colPath);
    } else if (depth > maxDepth) {
      maxDepth = depth;
    }

    return nodes;
  }

  // 4. Discover ALL subcollections directly under the workspace document
  const topCollectionsMap = new Map<string, ReadableCollectionRef>();
  let topListSucceeded = false;
  try {
    const listedCols = await workspaceRef.listCollections();
    topListSucceeded = true;
    for (const col of listedCols) {
      topCollectionsMap.set(col.id, col);
    }
  } catch (err) {
    errors.push({
      path: workspaceRef.path,
      stage: 'collection_list',
      code: classifyBackupErrorCode(err),
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Ensure baseline CRM subcollections are checked as fallback if top-level listing failed
  if (!topListSucceeded) {
    for (const fallbackCol of ['leads', 'niches', 'importedSheets']) {
      if (!topCollectionsMap.has(fallbackCol)) {
        topCollectionsMap.set(fallbackCol, workspaceRef.collection(fallbackCol));
      }
    }
  }

  const collections: Record<string, RecursiveBackupDocNode[]> = {};
  const sortedTopNames = Array.from(topCollectionsMap.keys()).sort((a, b) => a.localeCompare(b));
  for (const colName of sortedTopNames) {
    const colRef = topCollectionsMap.get(colName)!;
    collections[colName] = await dumpCollectionRecursive(colRef, 1);
  }

  if (!workspaceDocExists && sortedTopNames.length === 0 && errors.length === 0) {
    warnings.push(
      `Workspace "${workspaceId}" não possui documento materializado nem subcoleções no banco.`
    );
  }

  documentsWithoutFieldsPaths.sort();
  const discoveredCollections = Array.from(discoveredCollectionsSet).sort();
  const emptyCollections = Array.from(emptyCollectionsSet).sort();

  const unsignedManifest: Omit<RecursiveBackupManifest, 'checksumSha256'> = {
    version: '3.2-admin-recursive',
    readOnly: true,
    exportedAt: new Date().toISOString(),
    projectId,
    firestoreDatabaseId,
    workspaceId,
    rootCollectionsDiscovered,
    rootCollectionsInventory,
    includedCollections: discoveredCollections,
    excludedCollections,
    workspaceDocument: {
      exists: workspaceDocExists,
      hasOwnFields: workspaceDocHasOwnFields,
      path: workspaceRef.path,
      data: workspaceDocData,
    },
    discoveredCollections,
    emptyCollections,
    countsByCollection,
    subcollectionCountsByPath,
    totalDocuments,
    subcollectionsCount,
    documentsWithoutFieldsCount: documentsWithoutFieldsPaths.length,
    documentsWithoutFieldsPaths,
    preservedPathsCount,
    maxDepth,
    collections,
    warnings,
    errors,
  };

  const checksumSha256 = computeManifestSha256(unsignedManifest);

  return {
    ...unsignedManifest,
    checksumSha256,
  };
}

function recountRecursiveNodes(
  nodes: RecursiveBackupDocNode[],
  collectionPath: string,
  depth: number,
  state: {
    countsAccumulator: Record<string, number>;
    subcollectionCountsAccumulator: Record<string, number>;
    subcollectionsCount: number;
    fieldlessCount: number;
    preservedPathsCount: number;
    maxDepth: number;
    seenPaths: Set<string>;
    issues: string[];
  }
): number {
  let subtotal = nodes.length;
  state.countsAccumulator[collectionPath] =
    (state.countsAccumulator[collectionPath] || 0) + nodes.length;
  if (depth > 1) {
    state.subcollectionsCount += 1;
    state.subcollectionCountsAccumulator[collectionPath] =
      (state.subcollectionCountsAccumulator[collectionPath] || 0) + nodes.length;
  }
  if (nodes.length > 0 && depth > state.maxDepth) {
    state.maxDepth = depth;
  }

  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || typeof node.path !== 'string') {
      state.issues.push(`Documento inválido na coleção "${collectionPath}" (id ou path ausente).`);
      continue;
    }
    if (state.seenPaths.has(node.path)) {
      state.issues.push(`Caminho duplicado no manifesto: ${node.path}`);
    }
    state.seenPaths.add(node.path);

    const hasOwnFields =
      typeof node.hasOwnFields === 'boolean'
        ? node.hasOwnFields
        : Boolean(node.data && Object.keys(node.data).length > 0);
    if (!hasOwnFields) {
      state.fieldlessCount += 1;
    }

    state.preservedPathsCount += 1;
    if (node.subcollections && typeof node.subcollections === 'object') {
      for (const [subName, subNodes] of Object.entries(node.subcollections)) {
        if (Array.isArray(subNodes)) {
          subtotal += recountRecursiveNodes(
            subNodes,
            `${node.path}/${subName}`,
            depth + 1,
            state
          );
        }
      }
    }
  }
  return subtotal;
}

function flattenCollectionsForNdjson(
  workspaceId: string,
  collections: Record<string, RecursiveBackupDocNode[]>
): Map<string, RecursiveBackupDocNode[]> {
  const result = new Map<string, RecursiveBackupDocNode[]>();

  function collect(colPath: string, nodes: RecursiveBackupDocNode[]) {
    result.set(colPath, nodes);
    for (const node of nodes) {
      for (const [subName, subNodes] of Object.entries(node.subcollections || {})) {
        collect(`${node.path}/${subName}`, subNodes);
      }
    }
  }

  for (const [topName, nodes] of Object.entries(collections)) {
    collect(`workspaces/${workspaceId}/${topName}`, nodes);
  }
  return result;
}

export function validateRecursiveBackupManifest(
  rawOrManifest: string | RecursiveBackupManifest,
  expected?: {
    projectId?: string;
    firestoreDatabaseId?: string;
    workspaceId?: string;
  }
): BackupValidationResult {
  const issues: string[] = [];
  let parsed: RecursiveBackupManifest;

  if (typeof rawOrManifest === 'string') {
    try {
      parsed = JSON.parse(rawOrManifest) as RecursiveBackupManifest;
    } catch (err) {
      return {
        valid: false,
        status: 'FAILED',
        issues: [
          `JSON inválido: ${err instanceof Error ? err.message : 'erro de parse'}`,
        ],
        summary: {
          version: '',
          projectId: '',
          firestoreDatabaseId: '',
          workspaceId: '',
          discoveredCollections: 0,
          emptyCollections: 0,
          totalDocuments: 0,
          subcollectionsCount: 0,
          documentsWithoutFieldsCount: 0,
          preservedPathsCount: 0,
          maxDepth: 0,
          errorsCount: 1,
          warningsCount: 0,
          checksumMatch: false,
          ndjsonFilesChecked: 0,
          ndjsonFilesValid: 0,
        },
      };
    }
  } else {
    parsed = rawOrManifest;
  }

  if (!parsed || typeof parsed !== 'object') {
    issues.push('Manifesto de backup vazio ou malformado.');
  }

  if (!SUPPORTED_MANIFEST_VERSIONS.has(String(parsed?.version || ''))) {
    issues.push(`Versão de backup inesperada: ${String(parsed?.version)}`);
  }

  if (!parsed?.projectId) issues.push('projectId ausente no manifesto.');
  if (!parsed?.firestoreDatabaseId) issues.push('firestoreDatabaseId ausente no manifesto.');
  if (!parsed?.workspaceId) issues.push('workspaceId ausente no manifesto.');

  if (expected?.projectId && parsed?.projectId !== expected.projectId) {
    issues.push(`projectId divergente: esperado "${expected.projectId}", obtido "${parsed?.projectId}".`);
  }
  if (
    expected?.firestoreDatabaseId &&
    parsed?.firestoreDatabaseId !== expected.firestoreDatabaseId
  ) {
    issues.push(
      `firestoreDatabaseId divergente: esperado "${expected.firestoreDatabaseId}", obtido "${parsed?.firestoreDatabaseId}".`
    );
  }
  if (expected?.workspaceId && parsed?.workspaceId !== expected.workspaceId) {
    issues.push(
      `workspaceId divergente: esperado "${expected.workspaceId}", obtido "${parsed?.workspaceId}".`
    );
  }

  const recountState = {
    countsAccumulator: {} as Record<string, number>,
    subcollectionCountsAccumulator: {} as Record<string, number>,
    subcollectionsCount: 0,
    fieldlessCount: 0,
    preservedPathsCount: 0,
    maxDepth: 0,
    seenPaths: new Set<string>(),
    issues,
  };
  let recountedTotal = 0;

  if (parsed?.collections && typeof parsed.collections === 'object') {
    for (const [topName, docs] of Object.entries(parsed.collections)) {
      if (!Array.isArray(docs)) {
        issues.push(`Coleção "${topName}" não é um array válido de documentos.`);
        continue;
      }
      recountedTotal += recountRecursiveNodes(
        docs,
        `workspaces/${parsed.workspaceId}/${topName}`,
        1,
        recountState
      );
    }
  } else {
    issues.push('Mapa de coleções ausente no manifesto.');
  }

  if (recountedTotal !== parsed?.totalDocuments) {
    issues.push(
      `Contagem total divergente: declarado ${parsed?.totalDocuments}, recontado ${recountedTotal}.`
    );
  }

  if (
    typeof parsed?.documentsWithoutFieldsCount === 'number' &&
    recountState.fieldlessCount !== parsed.documentsWithoutFieldsCount
  ) {
    issues.push(
      `Contagem de documentos sem campos próprios divergente: declarado ${parsed.documentsWithoutFieldsCount}, recontado ${recountState.fieldlessCount}.`
    );
  }

  for (const [colPath, count] of Object.entries(recountState.countsAccumulator)) {
    if ((parsed?.countsByCollection?.[colPath] ?? -1) !== count) {
      issues.push(
        `Contagem divergente em "${colPath}": declarado ${parsed?.countsByCollection?.[colPath]}, recontado ${count}.`
      );
    }
  }

  if (parsed?.subcollectionCountsByPath) {
    for (const [subPath, count] of Object.entries(recountState.subcollectionCountsAccumulator)) {
      if ((parsed.subcollectionCountsByPath[subPath] ?? -1) !== count) {
        issues.push(
          `Contagem de subcoleção divergente em "${subPath}": declarado ${parsed.subcollectionCountsByPath[subPath]}, recontado ${count}.`
        );
      }
    }
  }

  const { checksumSha256, ...unsigned } = parsed;
  const computedSha = computeManifestSha256(unsigned);
  const checksumMatch = Boolean(checksumSha256 && computedSha === checksumSha256);
  if (!checksumMatch) {
    issues.push('Checksum SHA-256 inválido: arquivo pode estar corrompido ou adulterado.');
  }

  const errorsCount = Array.isArray(parsed?.errors) ? parsed.errors.length : 0;
  if (errorsCount > 0) {
    issues.push(`Foram registrados ${errorsCount} erro(s) de leitura durante a exportação.`);
  }

  const warningsCount = Array.isArray(parsed?.warnings) ? parsed.warnings.length : 0;

  return {
    valid: issues.length === 0,
    status: issues.length === 0 ? 'SUCCESS' : 'FAILED',
    issues,
    summary: {
      version: String(parsed?.version || ''),
      projectId: parsed?.projectId || '',
      firestoreDatabaseId: parsed?.firestoreDatabaseId || '',
      workspaceId: parsed?.workspaceId || '',
      discoveredCollections: Array.isArray(parsed?.discoveredCollections)
        ? parsed.discoveredCollections.length
        : 0,
      emptyCollections: Array.isArray(parsed?.emptyCollections)
        ? parsed.emptyCollections.length
        : 0,
      totalDocuments: recountedTotal,
      subcollectionsCount: recountState.subcollectionsCount,
      documentsWithoutFieldsCount: recountState.fieldlessCount,
      preservedPathsCount: recountState.preservedPathsCount,
      maxDepth: recountState.maxDepth,
      errorsCount,
      warningsCount,
      checksumMatch,
      ndjsonFilesChecked: 0,
      ndjsonFilesValid: 0,
    },
  };
}

export function validateNdjsonFileContent(params: {
  filePath: string;
  fileName: string;
  collectionPath: string;
  expectedCount: number;
  expectedFieldlessCount: number;
  expectedSha256: string;
}): NdjsonFileValidationResult {
  const issues: string[] = [];
  const exists = fs.existsSync(params.filePath);
  if (!exists) {
    return {
      collectionPath: params.collectionPath,
      fileName: params.fileName,
      exists: false,
      readable: false,
      validJsonLines: false,
      pathsMatchCollection: false,
      expectedCount: params.expectedCount,
      actualCount: 0,
      expectedFieldlessCount: params.expectedFieldlessCount,
      actualFieldlessCount: 0,
      expectedSha256: params.expectedSha256,
      actualSha256: '',
      checksumMatch: false,
      issues: [`Arquivo NDJSON ausente em disco: ${params.fileName}`],
    };
  }

  let rawBuffer: Buffer;
  try {
    rawBuffer = fs.readFileSync(params.filePath);
  } catch (err) {
    return {
      collectionPath: params.collectionPath,
      fileName: params.fileName,
      exists: true,
      readable: false,
      validJsonLines: false,
      pathsMatchCollection: false,
      expectedCount: params.expectedCount,
      actualCount: 0,
      expectedFieldlessCount: params.expectedFieldlessCount,
      actualFieldlessCount: 0,
      expectedSha256: params.expectedSha256,
      actualSha256: '',
      checksumMatch: false,
      issues: [
        `Falha ao ler arquivo NDJSON "${params.fileName}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      ],
    };
  }

  const actualSha256 = crypto.createHash('sha256').update(rawBuffer).digest('hex');
  const checksumMatch = Boolean(params.expectedSha256 && actualSha256 === params.expectedSha256);
  if (!checksumMatch) {
    issues.push(
      `Checksum SHA-256 divergente no arquivo "${params.fileName}": esperado ${params.expectedSha256}, obtido ${actualSha256}.`
    );
  }

  const text = rawBuffer.toString('utf-8');
  const rawLines = text.split('\n').filter((line) => line.trim().length > 0);

  let validJsonLines = true;
  let pathsMatchCollection = true;
  let actualFieldlessCount = 0;

  rawLines.forEach((line, idx) => {
    let parsedLine: Record<string, unknown>;
    try {
      parsedLine = JSON.parse(line) as Record<string, unknown>;
    } catch {
      validJsonLines = false;
      issues.push(`Linha ${idx + 1} de "${params.fileName}" não é JSON válido.`);
      return;
    }

    if (
      !parsedLine ||
      typeof parsedLine !== 'object' ||
      typeof parsedLine.id !== 'string' ||
      !parsedLine.id ||
      typeof parsedLine.path !== 'string' ||
      !parsedLine.path ||
      !parsedLine.data ||
      typeof parsedLine.data !== 'object' ||
      Array.isArray(parsedLine.data)
    ) {
      validJsonLines = false;
      issues.push(
        `Linha ${idx + 1} de "${params.fileName}" não contém estrutura obrigatória (id, path, data).`
      );
      return;
    }

    const expectedPrefix = `${params.collectionPath}/`;
    const expectedExactPath = `${params.collectionPath}/${parsedLine.id}`;
    if (!parsedLine.path.startsWith(expectedPrefix) || parsedLine.path !== expectedExactPath) {
      pathsMatchCollection = false;
      issues.push(
        `Linha ${idx + 1} de "${params.fileName}" possui caminho "${parsedLine.path}" incompatível com a coleção esperada "${params.collectionPath}".`
      );
    }

    const hasOwnFields =
      typeof parsedLine.hasOwnFields === 'boolean'
        ? parsedLine.hasOwnFields
        : Object.keys(parsedLine.data as Record<string, unknown>).length > 0;
    if (!hasOwnFields) {
      actualFieldlessCount += 1;
    }
  });

  if (rawLines.length !== params.expectedCount) {
    issues.push(
      `Quantidade de documentos divergente em "${params.fileName}": esperado ${params.expectedCount}, encontrado ${rawLines.length}.`
    );
  }

  if (actualFieldlessCount !== params.expectedFieldlessCount) {
    issues.push(
      `Quantidade de documentos sem campos divergente em "${params.fileName}": esperado ${params.expectedFieldlessCount}, encontrado ${actualFieldlessCount}.`
    );
  }

  return {
    collectionPath: params.collectionPath,
    fileName: params.fileName,
    exists: true,
    readable: true,
    validJsonLines,
    pathsMatchCollection,
    expectedCount: params.expectedCount,
    actualCount: rawLines.length,
    expectedFieldlessCount: params.expectedFieldlessCount,
    actualFieldlessCount,
    expectedSha256: params.expectedSha256,
    actualSha256,
    checksumMatch,
    issues,
  };
}

export function validateBackupPackageOnDisk(
  outputDir: string,
  expected?: {
    projectId?: string;
    firestoreDatabaseId?: string;
    workspaceId?: string;
  }
): BackupValidationResult {
  const completeJsonPath = path.join(outputDir, 'backup_complete.json');
  if (!fs.existsSync(completeJsonPath)) {
    return {
      valid: false,
      status: 'FAILED',
      issues: [`Manifesto principal não encontrado em disco: ${completeJsonPath}`],
      summary: {
        version: '',
        projectId: '',
        firestoreDatabaseId: '',
        workspaceId: '',
        discoveredCollections: 0,
        emptyCollections: 0,
        totalDocuments: 0,
        subcollectionsCount: 0,
        documentsWithoutFieldsCount: 0,
        preservedPathsCount: 0,
        maxDepth: 0,
        errorsCount: 1,
        warningsCount: 0,
        checksumMatch: false,
        ndjsonFilesChecked: 0,
        ndjsonFilesValid: 0,
      },
      ndjsonResults: [],
    };
  }

  const rawManifestJson = fs.readFileSync(completeJsonPath, 'utf-8');
  const manifestValidation = validateRecursiveBackupManifest(rawManifestJson, expected);

  let parsedManifest: RecursiveBackupManifest | null = null;
  try {
    parsedManifest = JSON.parse(rawManifestJson) as RecursiveBackupManifest;
  } catch {
    parsedManifest = null;
  }

  const ndjsonResults: NdjsonFileValidationResult[] = [];
  const allIssues = [...manifestValidation.issues];

  if (parsedManifest) {
    const ndjsonDescriptors = parsedManifest.ndjsonFiles || [];
    const expectedCollectionMap = flattenCollectionsForNdjson(
      parsedManifest.workspaceId,
      parsedManifest.collections || {}
    );

    if (parsedManifest.version === '3.2-admin-recursive') {
      if (ndjsonDescriptors.length !== expectedCollectionMap.size) {
        allIssues.push(
          `Quantidade de registros NDJSON (${ndjsonDescriptors.length}) difere do total de coleções/subcoleções (${expectedCollectionMap.size}).`
        );
      }

      const seenFileNames = new Set<string>();
      for (const record of ndjsonDescriptors) {
        if (seenFileNames.has(record.fileName)) {
          allIssues.push(`Colisão de nome de arquivo NDJSON detectada: ${record.fileName}`);
        }
        seenFileNames.add(record.fileName);

        const nodes = expectedCollectionMap.get(record.collectionPath);
        if (!nodes) {
          allIssues.push(
            `Registro NDJSON aponta para coleção desconhecida no manifesto: ${record.collectionPath}`
          );
          continue;
        }

        const fieldlessInNodes = nodes.filter((n) => !n.hasOwnFields).length;
        const result = validateNdjsonFileContent({
          filePath: path.join(outputDir, record.fileName),
          fileName: record.fileName,
          collectionPath: record.collectionPath,
          expectedCount: nodes.length,
          expectedFieldlessCount: fieldlessInNodes,
          expectedSha256: record.sha256,
        });
        ndjsonResults.push(result);
        allIssues.push(...result.issues);
      }
    }
  }

  const ndjsonFilesValid = ndjsonResults.filter((r) => r.issues.length === 0).length;
  const isValid = allIssues.length === 0;

  return {
    valid: isValid,
    status: isValid ? 'SUCCESS' : 'FAILED',
    issues: allIssues,
    summary: {
      ...manifestValidation.summary,
      ndjsonFilesChecked: ndjsonResults.length,
      ndjsonFilesValid,
    },
    ndjsonResults,
  };
}

export function writeAndValidateBackupPackage(
  rawManifest: RecursiveBackupManifest,
  outputDir: string,
  expected?: {
    projectId?: string;
    firestoreDatabaseId?: string;
    workspaceId?: string;
  }
): {
  manifest: RecursiveBackupManifest;
  validation: BackupValidationResult;
  completeJsonPath: string;
  reportPath: string;
} {
  fs.mkdirSync(outputDir, { recursive: true });

  const completeJsonPath = path.join(outputDir, 'backup_complete.json');
  const reportPath = path.join(outputDir, 'validation_report.json');
  if (fs.existsSync(completeJsonPath) || fs.existsSync(reportPath)) {
    throw new Error(
      `Destino já contém arquivos de backup em "${outputDir}". Abortando para não sobrescrever.`
    );
  }

  const collectionsMap = flattenCollectionsForNdjson(
    rawManifest.workspaceId,
    rawManifest.collections
  );

  const usedFileNames = new Set<string>();
  const ndjsonFiles: NdjsonFileRecord[] = [];
  const generatedFiles: string[] = ['backup_complete.json'];

  const sortedPaths = Array.from(collectionsMap.keys()).sort((a, b) => a.localeCompare(b));
  for (const collectionPath of sortedPaths) {
    const nodes = collectionsMap.get(collectionPath)!;
    const fileName = buildDeterministicNdjsonFilename(collectionPath);
    if (usedFileNames.has(fileName)) {
      throw new Error(`Colisão de nome de arquivo NDJSON detectada para "${collectionPath}".`);
    }
    usedFileNames.add(fileName);

    const filePath = path.join(outputDir, fileName);
    if (fs.existsSync(filePath)) {
      throw new Error(`Arquivo NDJSON já existe no destino e não será sobrescrito: ${fileName}`);
    }

    const lines = nodes.map((n) =>
      JSON.stringify({
        id: n.id,
        path: n.path,
        exists: n.exists,
        hasOwnFields: n.hasOwnFields,
        data: n.data,
      })
    );
    const content = lines.join('\n') + (lines.length ? '\n' : '');
    const buffer = Buffer.from(content, 'utf-8');
    fs.writeFileSync(filePath, buffer);

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    ndjsonFiles.push({
      collectionPath,
      fileName,
      documentCount: nodes.length,
      fieldlessDocumentsCount: nodes.filter((n) => !n.hasOwnFields).length,
      sizeBytes: buffer.length,
      sha256,
    });
    generatedFiles.push(fileName);
  }

  generatedFiles.push('validation_report.json');

  const { checksumSha256: _ignoredOldSha, ...baseManifest } = rawManifest;
  const unsignedFinal: Omit<RecursiveBackupManifest, 'checksumSha256'> = {
    ...baseManifest,
    ndjsonFiles,
    generatedFiles,
  };
  const preCheck = validateRecursiveBackupManifest(
    {
      ...unsignedFinal,
      checksumSha256: computeManifestSha256(unsignedFinal),
    },
    expected
  );
  unsignedFinal.preWriteValidation = {
    valid: preCheck.valid,
    issues: preCheck.issues,
  };
  const finalChecksum = computeManifestSha256(unsignedFinal);
  const finalManifest: RecursiveBackupManifest = {
    ...unsignedFinal,
    checksumSha256: finalChecksum,
  };

  fs.writeFileSync(completeJsonPath, JSON.stringify(finalManifest, null, 2), 'utf-8');

  const validation = validateBackupPackageOnDisk(outputDir, expected);

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        validatedAt: new Date().toISOString(),
        outputDir,
        ...validation,
      },
      null,
      2
    ),
    'utf-8'
  );

  return {
    manifest: finalManifest,
    validation,
    completeJsonPath,
    reportPath,
  };
}
