/**
 * Testes reais das regras de segurança (`firestore.rules`) no Firebase Emulator Suite.
 *
 * Banco de teste vs. Banco real:
 * - Projeto de produção real: `gen-lang-client-0798002034` (NUNCA acessado aqui).
 * - Projeto isolado de teste no Emulator: `kaizen-rules-test` (`PROJECT_ID`).
 * - Banco Firestore nomeado: lido de `firebase-applet-config.json` (`ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea`)
 *   ou via `TEST_FIRESTORE_DATABASE_ID` (não usa dados reais de produção).
 *
 * Execução obrigatória em ambiente com Java/JRE + Firebase CLI:
 *   firebase emulators:exec --only auth,firestore "npm run test:rules"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

interface AppletConfig {
  projectId: string;
  firestoreDatabaseId: string;
}

function readNamedDatabaseFromConfig(): string {
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(cfgPath, 'utf-8');
  const parsed = JSON.parse(raw) as AppletConfig;
  assert.ok(
    parsed.firestoreDatabaseId && parsed.firestoreDatabaseId.trim().length > 0,
    'firebase-applet-config.json precisa declarar firestoreDatabaseId.'
  );
  return parsed.firestoreDatabaseId.trim();
}

const AUTH_EMULATOR_URL = process.env.FIREBASE_AUTH_EMULATOR_HOST
  ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`
  : 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR_URL = process.env.FIRESTORE_EMULATOR_HOST
  ? `http://${process.env.FIRESTORE_EMULATOR_HOST}`
  : 'http://127.0.0.1:8080';

// Projeto isolado exclusivamente para Emulator (nunca aponta para produção)
const PROJECT_ID = 'kaizen-rules-test';
const DATABASE_ID = (
  process.env.TEST_FIRESTORE_DATABASE_ID || readNamedDatabaseFromConfig()
).trim();
const WORKSPACE_ID = 'adm_equipeie';

async function assertEmulatorsRunning(): Promise<void> {
  let authOk = false;
  let firestoreOk = false;

  try {
    const authRes = await fetch(`${AUTH_EMULATOR_URL}/`);
    authOk = authRes.status < 500;
  } catch {
    authOk = false;
  }

  try {
    const fsRes = await fetch(
      `${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/databases`
    );
    firestoreOk = fsRes.status < 500;
  } catch {
    firestoreOk = false;
  }

  if (!authOk || !firestoreOk) {
    assert.fail(
      `Firebase Auth/Firestore Emulator inacessível (auth=${authOk}, firestore=${firestoreOk}). ` +
        `Pré-requisito ausente neste ambiente: Java/JRE e execução via ` +
        `'firebase emulators:exec --only auth,firestore "npm run test:rules"'. ` +
        `Testes de regras NÃO podem ser aprovados ou ignorados silenciosamente sem o Emulator.`
    );
  }
}

async function createEmulatorUser(
  email: string,
  password: string
): Promise<{ uid: string; idToken: string }> {
  const res = await fetch(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  assert.equal(res.status, 200, 'Falha ao criar conta no Auth Emulator');
  const data = (await res.json()) as { localId: string; idToken: string };
  assert.ok(data.localId && data.idToken, 'Resposta inválida ao criar usuário no Auth Emulator');
  return { uid: data.localId, idToken: data.idToken };
}

async function loadRulesFromFile(replacementUid: string | null): Promise<void> {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const raw = fs.readFileSync(rulesPath, 'utf-8');
  const rulesContent =
    replacementUid === null
      ? raw
      : raw.replace('REPLACE_WITH_YOUR_FIREBASE_UID', replacementUid);

  const payload = JSON.stringify({
    rules: {
      files: [{ name: 'firestore.rules', content: rulesContent }],
    },
  });

  // Tenta carregar especificamente no banco nomeado; se a versão do Emulator aceitar apenas a rota por projeto, aplica nela também
  const dbScopedRes = await fetch(
    `${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/securityRules`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }
  );

  if (dbScopedRes.status === 200) {
    return;
  }

  const projectRes = await fetch(
    `${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/securityRules`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }
  );
  assert.equal(
    projectRes.status,
    200,
    `Falha ao carregar firestore.rules no Firestore Emulator (dbScoped=${dbScopedRes.status}, projectScoped=${projectRes.status})`
  );
}

function docUrl(workspaceId: string, col: string, id: string): string {
  return `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/workspaces/${workspaceId}/${col}/${id}`;
}

function colUrl(workspaceId: string, col: string): string {
  return `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/workspaces/${workspaceId}/${col}`;
}

test('Firestore Rules (usuário único privado) no banco nomeado via Firebase Emulator', async (t) => {
  await assertEmulatorsRunning();

  const adminUser = await createEmulatorUser('admin-rules@example.com', 'test-pass-1234');
  const intruderUser = await createEmulatorUser('intruder-rules@example.com', 'test-pass-1234');

  const validLeadPayload = {
    fields: {
      id: { stringValue: 'lead-test-1' },
      nicheId: { stringValue: 'niche-padrao' },
      companyName: { stringValue: 'Empresa Teste' },
      phone: { stringValue: '5511999998888' },
      stage: { stringValue: 'leads_sem_contato' },
    },
  };

  const validNichePayload = {
    fields: {
      id: { stringValue: 'niche-padrao' },
      name: { stringValue: 'Prospecção Geral' },
      segment: { stringValue: 'Sites' },
      city: { stringValue: 'Brasil' },
    },
  };

  const validSheetPayload = {
    fields: {
      id: { stringValue: 'sheet-test-1' },
      name: { stringValue: 'planilha.xlsx' },
      nicheId: { stringValue: 'niche-padrao' },
      totalLeads: { integerValue: '10' },
    },
  };

  // Cenário 10: Configuração de UID ausente (placeholder não substituído) resulta em bloqueio total
  await t.test('10. Configuração de UID ausente bloqueia inclusive usuário autenticado', async () => {
    await loadRulesFromFile(null);

    const writeBlocked = await fetch(docUrl(WORKSPACE_ID, 'leads', 'lead-unconfigured'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(validLeadPayload),
    });
    assert.equal(writeBlocked.status, 403);

    const readBlocked = await fetch(colUrl(WORKSPACE_ID, 'leads'), {
      headers: { Authorization: `Bearer ${adminUser.idToken}` },
    });
    assert.equal(readBlocked.status, 403);
  });

  // Carrega regras com o UID real do administrador de teste para os cenários 1..9
  await loadRulesFromFile(adminUser.uid);

  await t.test('5 e 6. UID autorizado consegue escrever e ler leads, nichos e importedSheets', async () => {
    const writeLead = await fetch(docUrl(WORKSPACE_ID, 'leads', 'lead-test-1'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(validLeadPayload),
    });
    assert.equal(writeLead.status, 200);

    const readLead = await fetch(docUrl(WORKSPACE_ID, 'leads', 'lead-test-1'), {
      headers: { Authorization: `Bearer ${adminUser.idToken}` },
    });
    assert.equal(readLead.status, 200);

    const writeNiche = await fetch(docUrl(WORKSPACE_ID, 'niches', 'niche-padrao'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(validNichePayload),
    });
    assert.equal(writeNiche.status, 200);

    const readNiche = await fetch(colUrl(WORKSPACE_ID, 'niches'), {
      headers: { Authorization: `Bearer ${adminUser.idToken}` },
    });
    assert.equal(readNiche.status, 200);

    const writeSheet = await fetch(docUrl(WORKSPACE_ID, 'importedSheets', 'sheet-test-1'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(validSheetPayload),
    });
    assert.equal(writeSheet.status, 200);

    const readSheet = await fetch(docUrl(WORKSPACE_ID, 'importedSheets', 'sheet-test-1'), {
      headers: { Authorization: `Bearer ${adminUser.idToken}` },
    });
    assert.equal(readSheet.status, 200);
  });

  await t.test('1 e 2. Usuário anônimo não consegue ler nem escrever', async () => {
    const anonGet = await fetch(docUrl(WORKSPACE_ID, 'leads', 'lead-test-1'));
    assert.equal(anonGet.status, 403);

    const anonList = await fetch(colUrl(WORKSPACE_ID, 'leads'));
    assert.equal(anonList.status, 403);

    const anonWrite = await fetch(docUrl(WORKSPACE_ID, 'leads', 'lead-anon'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validLeadPayload),
    });
    assert.equal(anonWrite.status, 403);
  });

  await t.test('3 e 4. UID diferente não consegue ler nem escrever', async () => {
    const otherRead = await fetch(docUrl(WORKSPACE_ID, 'leads', 'lead-test-1'), {
      headers: { Authorization: `Bearer ${intruderUser.idToken}` },
    });
    assert.equal(otherRead.status, 403);

    const otherList = await fetch(colUrl(WORKSPACE_ID, 'niches'), {
      headers: { Authorization: `Bearer ${intruderUser.idToken}` },
    });
    assert.equal(otherList.status, 403);

    const otherWrite = await fetch(docUrl(WORKSPACE_ID, 'leads', 'lead-intruder'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${intruderUser.idToken}`,
      },
      body: JSON.stringify(validLeadPayload),
    });
    assert.equal(otherWrite.status, 403);
  });

  await t.test('7. Campos não permitidos são bloqueados mesmo para o UID autorizado', async () => {
    const shadowFieldWrite = await fetch(docUrl(WORKSPACE_ID, 'leads', 'lead-shadow-1'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify({
        fields: {
          ...validLeadPayload.fields,
          isAdmin: { booleanValue: true },
        },
      }),
    });
    assert.equal(shadowFieldWrite.status, 403);
  });

  await t.test('8. Coleções não autorizadas são bloqueadas', async () => {
    const unknownSubcol = await fetch(docUrl(WORKSPACE_ID, 'secrets', 'secret-1'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify({ fields: { key: { stringValue: 'x' } } }),
    });
    assert.equal(unknownSubcol.status, 403);

    const rootCol = await fetch(
      `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users/${adminUser.uid}`,
      {
        headers: { Authorization: `Bearer ${adminUser.idToken}` },
      }
    );
    assert.equal(rootCol.status, 403);
  });

  await t.test('9. Workspace diferente é bloqueado', async () => {
    const legacyWorkspaceWrite = await fetch(docUrl('kaizenvisual123', 'leads', 'lead-x'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(validLeadPayload),
    });
    assert.equal(legacyWorkspaceWrite.status, 403);

    const otherWorkspaceRead = await fetch(colUrl('outro_workspace', 'leads'), {
      headers: { Authorization: `Bearer ${adminUser.idToken}` },
    });
    assert.equal(otherWorkspaceRead.status, 403);
  });
});
