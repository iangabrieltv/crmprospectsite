import crypto from 'crypto';

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
}

export interface ReadableFirestore {
  collection(name: string): ReadableCollectionRef;
  listCollections(): Promise<ReadableCollectionRef[]>;
}

export interface RecursiveBackupDocNode {
  id: string;
  path: string;
  data: Record<string, unknown>;
  subcollections: Record<string, RecursiveBackupDocNode[]>;
}

export interface BackupReadError {
  path: string;
  stage: 'root_list' | 'workspace_doc' | 'collection_list' | 'collection_get' | 'subcollection_list';
  message: string;
}

export interface RecursiveBackupManifest {
  version: '3.1-admin-recursive';
  readOnly: true;
  exportedAt: string;
  projectId: string;
  firestoreDatabaseId: string;
  workspaceId: string;
  rootCollectionsDiscovered: string[];
  workspaceDocument: {
    exists: boolean;
    path: string;
    data: Record<string, unknown> | null;
  };
  discoveredCollections: string[];
  countsByCollection: Record<string, number>;
  totalDocuments: number;
  subcollectionsCount: number;
  preservedPathsCount: number;
  maxDepth: number;
  collections: Record<string, RecursiveBackupDocNode[]>;
  errors: BackupReadError[];
  checksumSha256: string;
}

export interface BackupValidationResult {
  valid: boolean;
  issues: string[];
  summary: {
    projectId: string;
    firestoreDatabaseId: string;
    workspaceId: string;
    discoveredCollections: number;
    totalDocuments: number;
    subcollectionsCount: number;
    preservedPathsCount: number;
    maxDepth: number;
    errorsCount: number;
    checksumMatch: boolean;
  };
}

export function serializeFirestoreValue(value: unknown): unknown {
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

  // Firestore Timestamp compatibility (preserves seconds, nanoseconds, and ISO)
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    try {
      const tsObj = value as {
        seconds?: number;
        nanoseconds?: number;
        _seconds?: number;
        _nanoseconds?: number;
        toDate: () => Date;
      };
      const date = tsObj.toDate();
      const seconds =
        typeof tsObj.seconds === 'number'
          ? tsObj.seconds
          : typeof tsObj._seconds === 'number'
          ? tsObj._seconds
          : Math.floor(date.getTime() / 1000);
      const nanoseconds =
        typeof tsObj.nanoseconds === 'number'
          ? tsObj.nanoseconds
          : typeof tsObj._nanoseconds === 'number'
          ? tsObj._nanoseconds
          : (date.getTime() % 1000) * 1_000_000;
      return {
        __firestoreType: 'Timestamp',
        seconds,
        nanoseconds,
        iso: date.toISOString(),
      };
    } catch {
      return String(value);
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeFirestoreValue(item));
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    // Firestore DocumentReference compatibility
    if (
      typeof obj.path === 'string' &&
      typeof obj.id === 'string' &&
      ('firestore' in obj || typeof obj.collection === 'function')
    ) {
      return {
        __firestoreType: 'DocumentReference',
        path: obj.path,
      };
    }

    // Firestore GeoPoint compatibility
    if (
      typeof obj.latitude === 'number' &&
      typeof obj.longitude === 'number' &&
      Object.keys(obj).length <= 3
    ) {
      return {
        __firestoreType: 'GeoPoint',
        latitude: obj.latitude,
        longitude: obj.longitude,
      };
    }

    const serialized: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const val = obj[key];
      if (val !== undefined) {
        serialized[key] = serializeFirestoreValue(val);
      }
    }
    return serialized;
  }

  return value;
}

export function computeManifestSha256(
  payload: Omit<RecursiveBackupManifest, 'checksumSha256'>
): string {
  const canonical = JSON.stringify(payload);
  return crypto.createHash('sha256').update(canonical).digest('hex');
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
  const discoveredCollectionsSet = new Set<string>();
  const countsByCollection: Record<string, number> = {};
  let totalDocuments = 0;

  // 1. Discover root collections (diagnostic, read-only)
  const rootCollectionsDiscovered: string[] = [];
  try {
    const rootCols = await db.listCollections();
    for (const col of rootCols) {
      rootCollectionsDiscovered.push(col.id);
    }
    rootCollectionsDiscovered.sort();
  } catch (err) {
    errors.push({
      path: '/',
      stage: 'root_list',
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Read target workspace document itself
  const workspaceRef = db.collection('workspaces').doc(workspaceId);
  let workspaceDocData: Record<string, unknown> | null = null;
  let workspaceDocExists = false;
  try {
    const wsSnap = await workspaceRef.get();
    workspaceDocExists = Boolean(wsSnap.exists);
    workspaceDocData = wsSnap.exists
      ? ((serializeFirestoreValue(wsSnap.data() || {}) as Record<string, unknown>) || {})
      : null;
  } catch (err) {
    errors.push({
      path: workspaceRef.path,
      stage: 'workspace_doc',
      message: err instanceof Error ? err.message : String(err),
    });
  }

  let maxDepth = 0;
  let subcollectionsCount = 0;
  let preservedPathsCount = 0;

  // Recursive collection reader (depth 1 = direct workspace subcollection)
  async function dumpCollectionRecursive(
    colRef: ReadableCollectionRef,
    depth: number
  ): Promise<RecursiveBackupDocNode[]> {
    const colPath = colRef.path;
    discoveredCollectionsSet.add(colPath);
    if (depth > 1) {
      subcollectionsCount += 1;
    }

    let snap: ReadableQuerySnapshot;
    try {
      snap = await colRef.get();
    } catch (err) {
      errors.push({
        path: colPath,
        stage: 'collection_get',
        message: err instanceof Error ? err.message : String(err),
      });
      countsByCollection[colPath] = countsByCollection[colPath] ?? 0;
      return [];
    }

    const docsList: ReadableDocSnapshot[] = [];
    snap.forEach((docSnap) => {
      docsList.push(docSnap);
    });

    countsByCollection[colPath] = (countsByCollection[colPath] || 0) + docsList.length;
    totalDocuments += docsList.length;
    if (docsList.length > 0 && depth > maxDepth) {
      maxDepth = depth;
    }

    const nodes: RecursiveBackupDocNode[] = [];
    for (const docSnap of docsList) {
      preservedPathsCount += 1;
      const serializedData = (serializeFirestoreValue(docSnap.data() || {}) ||
        {}) as Record<string, unknown>;

      const nestedSubcollections: Record<string, RecursiveBackupDocNode[]> = {};
      try {
        const subCols = await docSnap.ref.listCollections();
        const sortedSubCols = [...subCols].sort((a, b) => a.id.localeCompare(b.id));
        for (const subCol of sortedSubCols) {
          nestedSubcollections[subCol.id] = await dumpCollectionRecursive(subCol, depth + 1);
        }
      } catch (err) {
        errors.push({
          path: docSnap.ref.path,
          stage: 'subcollection_list',
          message: err instanceof Error ? err.message : String(err),
        });
      }

      nodes.push({
        id: docSnap.id,
        path: docSnap.ref.path,
        data: serializedData,
        subcollections: nestedSubcollections,
      });
    }

    nodes.sort((a, b) => a.id.localeCompare(b.id));
    return nodes;
  }

  // 3. Discover ALL subcollections directly under the workspace document
  const topCollectionsMap = new Map<string, ReadableCollectionRef>();
  try {
    const listedCols = await workspaceRef.listCollections();
    for (const col of listedCols) {
      topCollectionsMap.set(col.id, col);
    }
  } catch (err) {
    errors.push({
      path: workspaceRef.path,
      stage: 'collection_list',
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Ensure standard known CRM collection references are also checked if listCollections failed or skipped empty paths
  for (const fallbackCol of ['leads', 'niches', 'importedSheets']) {
    if (!topCollectionsMap.has(fallbackCol)) {
      topCollectionsMap.set(fallbackCol, workspaceRef.collection(fallbackCol));
    }
  }

  const collections: Record<string, RecursiveBackupDocNode[]> = {};
  const sortedTopNames = Array.from(topCollectionsMap.keys()).sort();
  for (const colName of sortedTopNames) {
    const colRef = topCollectionsMap.get(colName)!;
    collections[colName] = await dumpCollectionRecursive(colRef, 1);
  }

  const unsignedManifest: Omit<RecursiveBackupManifest, 'checksumSha256'> = {
    version: '3.1-admin-recursive',
    readOnly: true,
    exportedAt: new Date().toISOString(),
    projectId,
    firestoreDatabaseId,
    workspaceId,
    rootCollectionsDiscovered,
    workspaceDocument: {
      exists: workspaceDocExists,
      path: workspaceRef.path,
      data: workspaceDocData,
    },
    discoveredCollections: Array.from(discoveredCollectionsSet).sort(),
    countsByCollection,
    totalDocuments,
    subcollectionsCount,
    preservedPathsCount,
    maxDepth,
    collections,
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
    subcollectionsCount: number;
    preservedPathsCount: number;
    maxDepth: number;
  }
): number {
  let subtotal = nodes.length;
  state.countsAccumulator[collectionPath] =
    (state.countsAccumulator[collectionPath] || 0) + nodes.length;
  if (depth > 1) {
    state.subcollectionsCount += 1;
  }
  if (nodes.length > 0 && depth > state.maxDepth) {
    state.maxDepth = depth;
  }

  for (const node of nodes) {
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
        issues: [
          `JSON inválido: ${err instanceof Error ? err.message : 'erro de parse'}`,
        ],
        summary: {
          projectId: '',
          firestoreDatabaseId: '',
          workspaceId: '',
          discoveredCollections: 0,
          totalDocuments: 0,
          subcollectionsCount: 0,
          preservedPathsCount: 0,
          maxDepth: 0,
          errorsCount: 1,
          checksumMatch: false,
        },
      };
    }
  } else {
    parsed = rawOrManifest;
  }

  if (!parsed || typeof parsed !== 'object') {
    issues.push('Manifesto de backup vazio ou malformado.');
  }

  if (parsed?.version !== '3.1-admin-recursive') {
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
    subcollectionsCount: 0,
    preservedPathsCount: 0,
    maxDepth: 0,
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

  for (const [colPath, count] of Object.entries(recountState.countsAccumulator)) {
    if ((parsed?.countsByCollection?.[colPath] ?? -1) !== count) {
      issues.push(
        `Contagem divergente em "${colPath}": declarado ${parsed?.countsByCollection?.[colPath]}, recontado ${count}.`
      );
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

  return {
    valid: issues.length === 0,
    issues,
    summary: {
      projectId: parsed?.projectId || '',
      firestoreDatabaseId: parsed?.firestoreDatabaseId || '',
      workspaceId: parsed?.workspaceId || '',
      discoveredCollections: Array.isArray(parsed?.discoveredCollections)
        ? parsed.discoveredCollections.length
        : 0,
      totalDocuments: recountedTotal,
      subcollectionsCount: recountState.subcollectionsCount,
      preservedPathsCount: recountState.preservedPathsCount,
      maxDepth: recountState.maxDepth,
      errorsCount,
      checksumMatch,
    },
  };
}
