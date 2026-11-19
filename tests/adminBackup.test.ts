import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GeoPoint, Timestamp } from 'firebase-admin/firestore';
import {
  buildDeterministicNdjsonFilename,
  checkCredentialsAvailability,
  computeManifestSha256,
  exportWorkspaceTreeReadOnly,
  ReadableCollectionRef,
  ReadableDocRef,
  ReadableFirestore,
  RecursiveBackupManifest,
  serializeFirestoreValue,
  validateBackupPackageOnDisk,
  validateBackupTargetConfig,
  validateNdjsonFileContent,
  validateRecursiveBackupManifest,
  writeAndValidateBackupPackage,
} from '../src/services/adminBackupService';

interface MockDocNode {
  exists?: boolean; // false simulates a phantom container doc with subcollections only
  data?: Record<string, unknown>;
  subcollections?: Record<string, Record<string, MockDocNode>>;
}

function createMockReadOnlyFirestore(tree: {
  rootCollections: Record<string, Record<string, MockDocNode>>;
  forbiddenCollections?: Set<string>;
  forbiddenListDocuments?: Set<string>;
}): { db: ReadableFirestore; getWriteAttempts: () => number } {
  const state = { writeAttempts: 0 };

  const rejectWrite = (op: string) => {
    state.writeAttempts += 1;
    throw new Error(`Operação de escrita proibida no backup: ${op}`);
  };

  function makeCollection(
    colId: string,
    colPath: string,
    docsMap: Record<string, MockDocNode>
  ): ReadableCollectionRef & Record<string, unknown> {
    return {
      id: colId,
      path: colPath,
      doc(docId: string): ReadableDocRef {
        return makeDoc(docId, `${colPath}/${docId}`, docsMap[docId]);
      },
      async listDocuments(): Promise<ReadableDocRef[]> {
        if (tree.forbiddenListDocuments?.has(colPath)) {
          throw new Error(`READ_ERROR ao listar referências em ${colPath}`);
        }
        return Object.entries(docsMap).map(([id, node]) =>
          makeDoc(id, `${colPath}/${id}`, node)
        );
      },
      async get() {
        if (tree.forbiddenCollections?.has(colPath)) {
          throw new Error(`7 PERMISSION_DENIED ao ler ${colPath}`);
        }
        // Real Firestore QuerySnapshot omits phantom docs where exists === false
        const entries = Object.entries(docsMap)
          .filter(([, node]) => node.exists !== false)
          .map(([id, node]) => {
            const ref = makeDoc(id, `${colPath}/${id}`, node);
            return {
              id,
              exists: true,
              ref,
              data: () => node.data ?? {},
            };
          });
        return {
          docs: entries,
          forEach(cb) {
            entries.forEach(cb);
          },
        };
      },
      add: () => rejectWrite(`add(${colPath})`),
    };
  }

  function makeDoc(
    docId: string,
    docPath: string,
    node: MockDocNode | undefined
  ): ReadableDocRef & Record<string, unknown> {
    return {
      id: docId,
      path: docPath,
      async get() {
        const docExists = Boolean(node && node.exists !== false);
        return {
          id: docId,
          exists: docExists,
          ref: makeDoc(docId, docPath, node),
          data: () => (docExists ? node?.data ?? {} : undefined),
        };
      },
      collection(subName: string): ReadableCollectionRef {
        const subMap = node?.subcollections?.[subName] || {};
        return makeCollection(subName, `${docPath}/${subName}`, subMap);
      },
      async listCollections(): Promise<ReadableCollectionRef[]> {
        const sub = node?.subcollections || {};
        return Object.entries(sub).map(([subName, subMap]) =>
          makeCollection(subName, `${docPath}/${subName}`, subMap)
        );
      },
      set: () => rejectWrite(`set(${docPath})`),
      update: () => rejectWrite(`update(${docPath})`),
      delete: () => rejectWrite(`delete(${docPath})`),
    };
  }

  const db: ReadableFirestore & Record<string, unknown> = {
    collection(name: string): ReadableCollectionRef {
      const colMap = tree.rootCollections[name] || {};
      return makeCollection(name, name, colMap);
    },
    async listCollections(): Promise<ReadableCollectionRef[]> {
      return Object.entries(tree.rootCollections).map(([colName, colMap]) =>
        makeCollection(colName, colName, colMap)
      );
    },
    batch: () => rejectWrite('batch()'),
    runTransaction: () => rejectWrite('runTransaction()'),
  };

  return { db, getWriteAttempts: () => state.writeAttempts };
}

test('descoberta recursiva inclui coleções raiz, coleções vazias, docs sem campos próprios (phantom/vazios) e múltiplos níveis sem escrita', async () => {
  const { db, getWriteAttempts } = createMockReadOnlyFirestore({
    rootCollections: {
      __firestore_internal__: {
        'sys-1': { data: { internal: true } },
      },
      externalPublicLogs: {
        'log-1': { data: { event: 'ping' } },
      },
      workspaces: {
        outro_workspace_nao_escopo: {
          data: { owner: 'Outro' },
          subcollections: {
            leads: { 'should-not-export': { data: { companyName: 'Ignorar' } } },
          },
        },
        adm_equipeie: {
          data: { owner: 'Admin Teste', active: true },
          subcollections: {
            colecaoVazia: {},
            leads: {
              'lead-com-campos': {
                data: { companyName: 'Clínica Exemplo', phone: '5582999990000', stage: 'fechado' },
                subcollections: {
                  timeline: {
                    'evt-1': {
                      data: { type: 'call', note: 'Contato inicial' },
                      subcollections: {
                        attachments: {
                          'att-9': {
                            data: { fileName: 'proposta-ficticia.pdf' },
                          },
                        },
                      },
                    },
                  },
                },
              },
              'doc-sem-campos-existentes': {
                exists: true,
                data: {},
              },
              'doc-phantom-apenas-container': {
                exists: false,
                subcollections: {
                  notasInternas: {
                    'nota-1': { data: { text: 'Nota abaixo de doc fantasma' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const manifest = await exportWorkspaceTreeReadOnly(db, {
    projectId: 'gen-lang-client-0798002034',
    firestoreDatabaseId: 'ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea',
    workspaceId: 'adm_equipeie',
  });

  assert.equal(getWriteAttempts(), 0);
  assert.equal(manifest.version, '3.2-admin-recursive');
  assert.equal(manifest.readOnly, true);
  assert.equal(manifest.errors.length, 0);

  // Root inventory & scope separation
  assert.deepEqual(manifest.rootCollectionsDiscovered, [
    '__firestore_internal__',
    'externalPublicLogs',
    'workspaces',
  ]);
  const internalInv = manifest.rootCollectionsInventory?.find(
    (c) => c.name === '__firestore_internal__'
  );
  assert.equal(internalInv?.isInternalSystemCollection, true);
  assert.equal(internalInv?.inBackupScope, false);

  const externalExcl = manifest.excludedCollections?.find((c) => c.name === 'externalPublicLogs');
  assert.equal(externalExcl?.kind, 'external_root_collection');
  assert.equal(externalExcl?.estimatedDocCount, 1);

  const otherWsExcl = manifest.excludedCollections?.find(
    (c) => c.name === 'outro_workspace_nao_escopo'
  );
  assert.equal(otherWsExcl?.kind, 'other_workspace');
  assert.equal(JSON.stringify(manifest.collections).includes('should-not-export'), false);

  // Empty collection & docs count (lead-com-campos + evt-1 + att-9 + doc-sem-campos + doc-phantom + nota-1 = 6)
  assert.ok(manifest.emptyCollections?.includes('workspaces/adm_equipeie/colecaoVazia'));
  assert.equal(manifest.totalDocuments, 6);
  assert.equal(manifest.documentsWithoutFieldsCount, 2);
  assert.deepEqual(manifest.documentsWithoutFieldsPaths, [
    'workspaces/adm_equipeie/leads/doc-phantom-apenas-container',
    'workspaces/adm_equipeie/leads/doc-sem-campos-existentes',
  ]);

  const phantomNode = manifest.collections.leads.find(
    (n) => n.id === 'doc-phantom-apenas-container'
  );
  assert.ok(phantomNode);
  assert.equal(phantomNode.exists, false);
  assert.equal(phantomNode.hasOwnFields, false);
  assert.equal(
    phantomNode.subcollections.notasInternas[0].data.text,
    'Nota abaixo de doc fantasma'
  );
  assert.equal(manifest.maxDepth, 3);
});

test('serialização preserva Timestamp real, GeoPoint real, DocumentReference, Bytes, Date, null, arrays, mapas e NÃO converte objeto comum com latitude/longitude', () => {
  const realTs = Timestamp.fromMillis(1763300000123);
  const realGeo = new GeoPoint(-9.6498, -35.7089);
  const plainCoordsOnly = { latitude: -9.6498, longitude: -35.7089 };
  const plainCoordsWithLabel = { latitude: -23.5505, longitude: -46.6333, label: 'Matriz SP' };
  const mockDocRef = {
    id: 'niche-demo',
    path: 'workspaces/adm_equipeie/niches/niche-demo',
    firestore: {},
  };
  const bytesPayload = Buffer.from('kaizen-bytes-fixture', 'utf-8');
  const dt = new Date('2026-11-19T10:00:00.000Z');

  const serialized = serializeFirestoreValue({
    realTs,
    realGeo,
    plainCoordsOnly,
    plainCoordsWithLabel,
    mockDocRef,
    bytesPayload,
    dt,
    nullField: null,
    nestedArray: [1, null, { b: 2, a: 1 }, realGeo],
  }) as Record<string, unknown>;

  assert.deepEqual(serialized.realTs, {
    __firestoreType: 'Timestamp',
    seconds: realTs.seconds,
    nanoseconds: realTs.nanoseconds,
    iso: realTs.toDate().toISOString(),
  });
  assert.deepEqual(serialized.realGeo, {
    __firestoreType: 'GeoPoint',
    latitude: -9.6498,
    longitude: -35.7089,
  });
  // Plain objects must remain plain objects without __firestoreType: 'GeoPoint'
  assert.deepEqual(serialized.plainCoordsOnly, {
    latitude: -9.6498,
    longitude: -35.7089,
  });
  assert.deepEqual(serialized.plainCoordsWithLabel, {
    label: 'Matriz SP',
    latitude: -23.5505,
    longitude: -46.6333,
  });
  assert.deepEqual(serialized.mockDocRef, {
    __firestoreType: 'DocumentReference',
    path: 'workspaces/adm_equipeie/niches/niche-demo',
  });
  assert.deepEqual(serialized.bytesPayload, {
    __firestoreType: 'Bytes',
    base64: bytesPayload.toString('base64'),
  });
  assert.deepEqual(serialized.dt, {
    __firestoreType: 'Date',
    iso: '2026-11-19T10:00:00.000Z',
  });
  assert.equal(serialized.nullField, null);

  const nested = serialized.nestedArray as unknown[];
  assert.equal(nested[1], null);
  assert.deepEqual(Object.keys(nested[2] as Record<string, unknown>), ['a', 'b']);
  assert.deepEqual(nested[3], {
    __firestoreType: 'GeoPoint',
    latitude: -9.6498,
    longitude: -35.7089,
  });
});

test('prevenção de colisão de nomes NDJSON para caminhos distintos', () => {
  const pathA = 'workspaces/adm_equipeie/a/b';
  const pathB = 'workspaces/adm_equipeie/a_b';
  const pathC = 'workspaces/adm_equipeie/a.b';
  const pathD = 'workspaces/adm_equipeie/a-b';

  const nameA = buildDeterministicNdjsonFilename(pathA);
  const nameB = buildDeterministicNdjsonFilename(pathB);
  const nameC = buildDeterministicNdjsonFilename(pathC);
  const nameD = buildDeterministicNdjsonFilename(pathD);

  const uniqueNames = new Set([nameA, nameB, nameC, nameD]);
  assert.equal(uniqueNames.size, 4, 'Caminhos distintos nunca podem colidir no nome do arquivo');
  assert.equal(buildDeterministicNdjsonFilename(pathA), nameA, 'Nome deve ser determinístico');
});

test('gravação em disco e validação completa detectam pacote válido e falham em NDJSON inválido, incompleto, checksum adulterado e contagem divergente', async () => {
  const { db } = createMockReadOnlyFirestore({
    rootCollections: {
      workspaces: {
        adm_equipeie: {
          data: { owner: 'Admin' },
          subcollections: {
            leads: {
              'lead-1': { data: { companyName: 'Empresa Fictícia 1', phone: '111', stage: 'fechado' } },
              'lead-2': { data: { companyName: 'Empresa Fictícia 2', phone: '222', stage: 'novo' } },
            },
          },
        },
      },
    },
  });

  const targetCfg = {
    projectId: 'gen-lang-client-0798002034',
    firestoreDatabaseId: 'ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea',
    workspaceId: 'adm_equipeie',
  };

  const manifest = await exportWorkspaceTreeReadOnly(db, targetCfg);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaizen-backup-test-'));

  try {
    const written = writeAndValidateBackupPackage(manifest, tmpDir, targetCfg);
    assert.equal(written.validation.valid, true);
    assert.equal(written.validation.status, 'SUCCESS');
    assert.equal(written.validation.summary.ndjsonFilesChecked, 1);
    assert.equal(written.validation.summary.ndjsonFilesValid, 1);
    assert.equal(fs.existsSync(written.reportPath), true);

    // Must refuse overwrite if invoked again on same directory
    assert.throws(() => writeAndValidateBackupPackage(manifest, tmpDir, targetCfg));

    // Wrong workspace expectation must fail validation
    const wrongWs = validateBackupPackageOnDisk(tmpDir, {
      ...targetCfg,
      workspaceId: 'workspace_errado',
    });
    assert.equal(wrongWs.valid, false);
    assert.equal(wrongWs.status, 'FAILED');

    const ndjsonRecord = written.manifest.ndjsonFiles![0];
    const ndjsonFilePath = path.join(tmpDir, ndjsonRecord.fileName);
    const originalNdjsonContent = fs.readFileSync(ndjsonFilePath, 'utf-8');

    // 1. Tampered NDJSON checksum / incomplete content (drop one line)
    const firstLineOnly = originalNdjsonContent.split('\n')[0] + '\n';
    fs.writeFileSync(ndjsonFilePath, firstLineOnly, 'utf-8');
    const incompleteValidation = validateBackupPackageOnDisk(tmpDir, targetCfg);
    assert.equal(incompleteValidation.valid, false);
    assert.equal(incompleteValidation.status, 'FAILED');
    assert.ok(
      incompleteValidation.issues.some((i) => i.includes('Checksum SHA-256 divergente'))
    );
    assert.ok(
      incompleteValidation.issues.some((i) => i.includes('Quantidade de documentos divergente'))
    );

    // 2. Invalid JSON line in NDJSON
    fs.writeFileSync(ndjsonFilePath, '{not-valid-json\n', 'utf-8');
    const invalidJsonNdjson = validateNdjsonFileContent({
      filePath: ndjsonFilePath,
      fileName: ndjsonRecord.fileName,
      collectionPath: ndjsonRecord.collectionPath,
      expectedCount: 2,
      expectedFieldlessCount: 0,
      expectedSha256: ndjsonRecord.sha256,
    });
    assert.equal(invalidJsonNdjson.validJsonLines, false);
    assert.ok(invalidJsonNdjson.issues.some((i) => i.includes('não é JSON válido')));

    // 3. Mismatched path inside NDJSON line
    fs.writeFileSync(
      ndjsonFilePath,
      JSON.stringify({ id: 'lead-1', path: 'workspaces/outro/leads/lead-1', data: {} }) + '\n',
      'utf-8'
    );
    const badPathNdjson = validateNdjsonFileContent({
      filePath: ndjsonFilePath,
      fileName: ndjsonRecord.fileName,
      collectionPath: ndjsonRecord.collectionPath,
      expectedCount: 1,
      expectedFieldlessCount: 0,
      expectedSha256: 'deadbeef',
    });
    assert.equal(badPathNdjson.pathsMatchCollection, false);

    // 4. Missing NDJSON file on disk
    fs.unlinkSync(ndjsonFilePath);
    const missingNdjson = validateBackupPackageOnDisk(tmpDir, targetCfg);
    assert.equal(missingNdjson.valid, false);
    assert.ok(missingNdjson.issues.some((i) => i.includes('Arquivo NDJSON ausente em disco')));

    // Restore NDJSON, tamper manifest count/checksum
    fs.writeFileSync(ndjsonFilePath, originalNdjsonContent, 'utf-8');
    const rawManifest = fs.readFileSync(written.completeJsonPath, 'utf-8');
    const tamperedCountManifest = JSON.parse(rawManifest) as RecursiveBackupManifest;
    tamperedCountManifest.totalDocuments = 999;
    fs.writeFileSync(
      written.completeJsonPath,
      JSON.stringify(tamperedCountManifest, null, 2),
      'utf-8'
    );
    const badCount = validateBackupPackageOnDisk(tmpDir, targetCfg);
    assert.equal(badCount.valid, false);
    assert.ok(badCount.issues.some((i) => i.includes('Contagem total divergente')));
    assert.ok(badCount.issues.some((i) => i.includes('Checksum SHA-256 inválido')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('erros de leitura, permissão negada, credenciais ausentes e configuração inválida produzem falha explícita', async () => {
  // Missing credentials check
  const missingCred = checkCredentialsAvailability({
    googleApplicationCredentials: '/caminho/que/nao/existe/sa.json',
    homeDir: '/caminho/que/nao/existe',
  });
  assert.equal(missingCred.ok, false);
  assert.equal(missingCred.code, 'MISSING_CREDENTIALS');

  // Invalid workspace & invalid (default) DB check
  const invalidDb = validateBackupTargetConfig({
    projectId: 'gen-lang-client-0798002034',
    firestoreDatabaseId: '(default)',
    workspaceId: 'adm_equipeie',
  });
  assert.equal(invalidDb.ok, false);
  assert.equal(invalidDb.code, 'INVALID_DATABASE');

  const invalidWs = validateBackupTargetConfig({
    projectId: 'gen-lang-client-0798002034',
    firestoreDatabaseId: 'ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea',
    workspaceId: 'invalid space!',
  });
  assert.equal(invalidWs.ok, false);
  assert.equal(invalidWs.code, 'INVALID_WORKSPACE');

  // Permission denied & read error during export
  const { db } = createMockReadOnlyFirestore({
    rootCollections: {
      workspaces: {
        adm_equipeie: {
          data: { owner: 'Admin' },
          subcollections: {
            restrictedCol: { 'doc-1': { data: { ok: true } } },
            listFailCol: { 'doc-2': { data: { ok: true } } },
          },
        },
      },
    },
    forbiddenCollections: new Set(['workspaces/adm_equipeie/restrictedCol']),
    forbiddenListDocuments: new Set(['workspaces/adm_equipeie/listFailCol']),
  });

  const manifest = await exportWorkspaceTreeReadOnly(db, {
    projectId: 'gen-lang-client-0798002034',
    firestoreDatabaseId: 'ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea',
    workspaceId: 'adm_equipeie',
  });

  assert.equal(manifest.errors.length, 2);
  assert.ok(manifest.errors.some((e) => e.code === 'PERMISSION_DENIED'));
  assert.ok(manifest.errors.some((e) => e.code === 'READ_ERROR'));

  const validation = validateRecursiveBackupManifest(manifest);
  assert.equal(validation.valid, false);
  assert.equal(validation.status, 'FAILED');
});

test('validador mantém compatibilidade retroativa com manifesto v3.1-admin-recursive', () => {
  const legacyUnsigned: Omit<RecursiveBackupManifest, 'checksumSha256'> = {
    version: '3.1-admin-recursive',
    readOnly: true,
    exportedAt: '2026-11-16T00:00:00.000Z',
    projectId: 'gen-lang-client-0798002034',
    firestoreDatabaseId: 'ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea',
    workspaceId: 'adm_equipeie',
    rootCollectionsDiscovered: ['workspaces'],
    workspaceDocument: {
      exists: true,
      path: 'workspaces/adm_equipeie',
      data: { owner: 'Legacy' },
    },
    discoveredCollections: ['workspaces/adm_equipeie/leads'],
    countsByCollection: { 'workspaces/adm_equipeie/leads': 1 },
    totalDocuments: 1,
    subcollectionsCount: 0,
    preservedPathsCount: 1,
    maxDepth: 1,
    collections: {
      leads: [
        {
          id: 'lead-v31',
          path: 'workspaces/adm_equipeie/leads/lead-v31',
          exists: true,
          hasOwnFields: true,
          data: { companyName: 'Legado Ltda' },
          subcollections: {},
        },
      ],
    },
    errors: [],
  };

  const legacyManifest: RecursiveBackupManifest = {
    ...legacyUnsigned,
    checksumSha256: computeManifestSha256(legacyUnsigned),
  };

  const result = validateRecursiveBackupManifest(JSON.stringify(legacyManifest), {
    projectId: 'gen-lang-client-0798002034',
    firestoreDatabaseId: 'ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea',
    workspaceId: 'adm_equipeie',
  });

  assert.equal(result.valid, true);
  assert.equal(result.summary.version, '3.1-admin-recursive');
  assert.equal(result.summary.checksumMatch, true);
});
