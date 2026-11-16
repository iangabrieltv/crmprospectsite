/**
 * Testes automatizados das regras de segurança do Firestore (DRAFT_firestore.rules).
 *
 * Pré-requisito para execução real:
 *   firebase emulators:exec --only auth,firestore "npx tsx --test firestore.rules.test.ts"
 * (Requer Java instalado localmente para subir o Firestore Emulator).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const AUTH_EMULATOR_URL = process.env.FIREBASE_AUTH_EMULATOR_HOST
  ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`
  : 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR_URL = process.env.FIRESTORE_EMULATOR_HOST
  ? `http://${process.env.FIRESTORE_EMULATOR_HOST}`
  : 'http://127.0.0.1:8080';

const PROJECT_ID = 'kaizen-rules-test';
const DATABASE_ID = '(default)';
const WORKSPACE_ID = 'adm_equipeie';

async function areEmulatorsRunning(): Promise<boolean> {
  try {
    const [authRes, firestoreRes] = await Promise.all([
      fetch(`${AUTH_EMULATOR_URL}/`),
      fetch(`${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/databases`),
    ]);
    return authRes.status < 500 && firestoreRes.status < 500;
  } catch {
    return false;
  }
}

async function createEmulatorUser(email: string, password: string): Promise<{ uid: string; idToken: string }> {
  const res = await fetch(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = (await res.json()) as { localId: string; idToken: string };
  assert.ok(data.localId && data.idToken, 'Falha ao criar usuário de teste no Auth Emulator');
  return { uid: data.localId, idToken: data.idToken };
}

async function loadDraftRulesWithAdminUid(uid: string): Promise<void> {
  const draftPath = path.resolve(process.cwd(), 'DRAFT_firestore.rules');
  const raw = fs.readFileSync(draftPath, 'utf-8');
  const compiledRules = raw.replace('REPLACE_WITH_YOUR_FIREBASE_UID', uid);

  const res = await fetch(
    `${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/securityRules`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rules: {
          files: [{ name: 'firestore.rules', content: compiledRules }],
        },
      }),
    }
  );
  assert.equal(res.status, 200, 'Falha ao carregar DRAFT_firestore.rules no Firestore Emulator');
}

function docUrl(col: string, id: string): string {
  return `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/workspaces/${WORKSPACE_ID}/${col}/${id}`;
}

test('Firestore Rules (usuário único privado) contra Firebase Emulator', async (t) => {
  const running = await areEmulatorsRunning();
  if (!running) {
    t.skip(
      'Firestore/Auth Emulator não está rodando neste ambiente (Java ausente). Execute via firebase emulators:exec.'
    );
    return;
  }

  const adminUser = await createEmulatorUser('admin-test@example.com', 'test-pass-1234');
  const intruderUser = await createEmulatorUser('intruder-test@example.com', 'test-pass-1234');
  await loadDraftRulesWithAdminUid(adminUser.uid);

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

  // 1. Usuário não autenticado: acesso negado
  const anonWrite = await fetch(docUrl('leads', 'lead-test-1'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validLeadPayload),
  });
  assert.equal(anonWrite.status, 403, 'Escrita anônima deve ser negada');

  const anonRead = await fetch(docUrl('leads', 'lead-test-1'));
  assert.equal(anonRead.status, 403, 'Leitura anônima deve ser negada');

  // 2. Usuário autenticado com UID não autorizado: acesso negado
  const intruderWrite = await fetch(docUrl('leads', 'lead-test-1'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${intruderUser.idToken}`,
    },
    body: JSON.stringify(validLeadPayload),
  });
  assert.equal(intruderWrite.status, 403, 'Escrita por outro UID autenticado deve ser negada');

  const intruderRead = await fetch(docUrl('niches', 'niche-padrao'), {
    headers: { Authorization: `Bearer ${intruderUser.idToken}` },
  });
  assert.equal(intruderRead.status, 403, 'Leitura por outro UID autenticado deve ser negada');

  // 3, 4, 5. Usuário autorizado: escrita e leitura de leads permitidas
  const adminLeadWrite = await fetch(docUrl('leads', 'lead-test-1'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminUser.idToken}`,
    },
    body: JSON.stringify(validLeadPayload),
  });
  assert.equal(adminLeadWrite.status, 200, 'Admin autorizado deve gravar lead válido');

  const adminLeadRead = await fetch(docUrl('leads', 'lead-test-1'), {
    headers: { Authorization: `Bearer ${adminUser.idToken}` },
  });
  assert.equal(adminLeadRead.status, 200, 'Admin autorizado deve ler lead');

  // Shadow field deve falhar mesmo para admin (anti-corrupção)
  const shadowWrite = await fetch(docUrl('leads', 'lead-shadow-1'), {
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
  assert.equal(shadowWrite.status, 403, 'Campos não previstos no schema devem ser bloqueados');

  // 6. Acesso aos nichos permitido apenas ao autorizado
  const adminNicheWrite = await fetch(docUrl('niches', 'niche-padrao'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminUser.idToken}`,
    },
    body: JSON.stringify(validNichePayload),
  });
  assert.equal(adminNicheWrite.status, 200, 'Admin autorizado deve gravar nicho válido');

  // 7. Acesso ao histórico de planilhas permitido apenas ao autorizado
  const adminSheetWrite = await fetch(docUrl('importedSheets', 'sheet-test-1'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminUser.idToken}`,
    },
    body: JSON.stringify(validSheetPayload),
  });
  assert.equal(adminSheetWrite.status, 200, 'Admin autorizado deve gravar planilha válida');
});
