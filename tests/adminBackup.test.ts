import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportWorkspaceTreeReadOnly,
  validateRecursiveBackupManifest,
  ReadableFirestore,
  ReadableCollectionRef,
  ReadableDocRef,
} from '../src/services/adminBackupService';

interface MockDocNode {
  data: Record<string, unknown>;
  subcollections?: Record<string, Record<string, MockDocNode>>;
}

function createMockReadOnlyFirestore(tree: {
  rootCollections: Record<string, Record<string, MockDocNode>>;
  forbiddenCollections?: Set<string>;
}): { db: ReadableFirestore; writeAttempts: number } {
  const state = { writeAttempts: 0 };

  function makeCollection(
    colId: string,
    colPath: string,
    docsMap: Record<string, MockDocNode>
  ): ReadableCollectionRef {
    return {
      id: colId,
      path: colPath,
      doc(docId: string): ReadableDocRef {
        return makeDoc(docId, `${colPath}/${docId}`, docsMap[docId]);
      },
      async get() {
        if (tree.forbiddenCollections?.has(colPath)) {
          throw new Error(`PERMISSION_DENIED ao ler ${colPath}`);
        }
        const entries = Object.entries(docsMap).map(([id, node]) => {
          const ref = makeDoc(id, `${colPath}/${id}`, node);
          return {
            id,
            exists: true,
            ref,
            data: () => node.data,
          };
        });
        return {
          docs: entries,
          forEach(cb) {
            entries.forEach(cb);
          },
        };
      },
    };
  }

  function makeDoc(
    docId: string,
    docPath: string,
    node: MockDocNode | undefined
  ): ReadableDocRef {
    return {
      id: docId,
      path: docPath,
      async get() {
        return {
          id: docId,
          exists: Boolean(node),
          ref: makeDoc(docId, docPath, node),
          data: () => node?.data,
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
    };
  }

  const db: ReadableFirestore = {
    collection(name: string): ReadableCollectionRef {
      const colMap = tree.rootCollections[name] || {};
      return makeCollection(name, name, colMap);
    },
    async listCollections(): Promise<ReadableCollectionRef[]> {
      return Object.entries(tree.rootCollections).map(([colName, colMap]) =>
        makeCollection(colName, colName, colMap)
      );
    },
  };

  return { db, writeAttempts: state.writeAttempts };
}

test('exportWorkspaceTreeReadOnly descobre todas as coleções e percorre subcoleções recursivamente preservando IDs', async () => {
  const { db } = createMockReadOnlyFirestore({
    rootCollections: {
      workspaces: {
        adm_equipeie: {
          data: { owner: 'Ian', createdAt: '2026-01-01T00:00:00.000Z' },
          subcollections: {
            leads: {
              'lead-legado-1': {
                data: { companyName: 'Clínica A', phone: '5511999991111', stage: 'fechado' },
                subcollections: {
                  timeline: {
                    'evt-1': {
                      data: { type: 'call', note: 'Primeiro contato' },
                      subcollections: {
                        attachments: {
                          'att-9': {
                            data: { fileName: 'proposta.pdf' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            niches: {
              'niche-odonto': {
                data: { name: 'Odontologia', segment: 'Saúde', city: 'São Paulo' },
              },
            },
            importedSheets: {
              'sheet-01': {
                data: { name: 'sp.xlsx', nicheId: 'niche-odonto', totalLeads: 1 },
              },
            },
            extraCustomCollection: {
              'cfg-1': {
                data: { note: 'Coleção adicional descoberta dinamicamente' },
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

  assert.equal(manifest.readOnly, true);
  assert.equal(manifest.totalDocuments, 6);
  assert.equal(manifest.errors.length, 0);
  assert.ok(manifest.collections.extraCustomCollection, 'Deve descobrir coleções além das 3 padrão');
  assert.equal(
    manifest.collections.leads[0].id,
    'lead-legado-1',
    'Deve preservar ID original do documento'
  );
  assert.equal(
    manifest.collections.leads[0].subcollections.timeline[0].subcollections.attachments[0].id,
    'att-9',
    'Deve percorrer subcoleções recursivamente em múltiplos níveis'
  );

  const validation = validateRecursiveBackupManifest(JSON.stringify(manifest), {
    projectId: 'gen-lang-client-0798002034',
    firestoreDatabaseId: 'ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea',
    workspaceId: 'adm_equipeie',
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.summary.totalDocuments, 6);
  assert.equal(validation.summary.checksumMatch, true);
});

test('exportWorkspaceTreeReadOnly registra erros de leitura e validateRecursiveBackupManifest detecta adulteração', async () => {
  const { db } = createMockReadOnlyFirestore({
    rootCollections: {
      workspaces: {
        adm_equipeie: {
          data: { owner: 'Ian' },
          subcollections: {
            leads: {
              'lead-1': { data: { companyName: 'Empresa 1', phone: '123', stage: 'fechado' } },
            },
            restrictedCol: {
              'doc-1': { data: { secret: true } },
            },
          },
        },
      },
    },
    forbiddenCollections: new Set(['workspaces/adm_equipeie/restrictedCol']),
  });

  const manifest = await exportWorkspaceTreeReadOnly(db, {
    projectId: 'gen-lang-client-0798002034',
    firestoreDatabaseId: 'ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea',
    workspaceId: 'adm_equipeie',
  });

  assert.equal(manifest.errors.length, 1);
  assert.match(manifest.errors[0].message, /PERMISSION_DENIED/);

  const validationWithErrors = validateRecursiveBackupManifest(manifest);
  assert.equal(validationWithErrors.valid, false);
  assert.equal(validationWithErrors.summary.errorsCount, 1);

  // Tampering check on clean manifest
  const { db: cleanDb } = createMockReadOnlyFirestore({
    rootCollections: {
      workspaces: {
        adm_equipeie: {
          data: { owner: 'Ian' },
          subcollections: {
            leads: { 'lead-1': { data: { companyName: 'Empresa Original' } } },
          },
        },
      },
    },
  });
  const cleanManifest = await exportWorkspaceTreeReadOnly(cleanDb, {
    projectId: 'gen-lang-client-0798002034',
    firestoreDatabaseId: 'ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea',
    workspaceId: 'adm_equipeie',
  });

  const tampered = JSON.stringify(cleanManifest).replace('Empresa Original', 'Empresa Adulterada');
  const tamperedValidation = validateRecursiveBackupManifest(tampered);
  assert.equal(tamperedValidation.valid, false);
  assert.equal(tamperedValidation.summary.checksumMatch, false);
});
