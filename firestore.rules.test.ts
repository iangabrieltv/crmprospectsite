/**
 * Testes reais das regras de segurança (`firestore.rules`) e compatibilidade de schema
 * no Firebase Auth + Firestore Emulator Suite.
 *
 * Banco de teste vs. Banco real:
 * - Projeto de produção real: `gen-lang-client-0798002034` (NUNCA acessado aqui).
 * - Projeto isolado de teste no Emulator: `kaizen-rules-test` (`PROJECT_ID`).
 * - Banco Firestore nomeado: lido de `firebase-applet-config.json` (`ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea`)
 *   ou via `TEST_FIRESTORE_DATABASE_ID` (não usa dados reais de produção).
 *
 * Execução obrigatória em ambiente com Java >= 21 + Firebase CLI:
 *   firebase emulators:exec --project kaizen-rules-test --only auth,firestore "npm run test:rules"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertEmulatorsRunning } from './src/services/emulatorHealthCheck';
import { INITIAL_NICHES } from './src/utils/initialData';

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
  : 'http://127.0.0.1:8088';

// Projeto isolado exclusivamente para Emulator (nunca aponta para produção)
const PROJECT_ID = 'kaizen-rules-test';
const DATABASE_ID = (
  process.env.TEST_FIRESTORE_DATABASE_ID || readNamedDatabaseFromConfig()
).trim();
const WORKSPACE_ID = 'adm_equipeie';

type FirestoreRestValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreRestValue[] } }
  | { mapValue: { fields: Record<string, FirestoreRestValue> } };

function toFirestoreValue(val: unknown): FirestoreRestValue {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.filter((v) => v !== undefined).map((v) => toFirestoreValue(v)),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreRestValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreDoc(obj: Record<string, unknown>): { fields: Record<string, FirestoreRestValue> } {
  const fields: Record<string, FirestoreRestValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return { fields };
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
      : raw.replace(
          /return\s+['"]REPLACE_WITH_YOUR_FIREBASE_UID['"]\s*;/,
          `return '${replacementUid}';`
        );

  const payload = JSON.stringify({
    database: `projects/${PROJECT_ID}/databases/${DATABASE_ID}`,
    rules: {
      files: [{ name: 'firestore.rules', content: rulesContent }],
    },
  });

  // Rota oficial do Firestore Emulator v1.x+ com escopo explícito no banco nomeado
  const dbColonRes = await fetch(
    `${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}:securityRules`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }
  );

  if (dbColonRes.status === 200) {
    return;
  }

  // Fallback para endpoint a nível de projeto passando `database` no corpo JSON
  const projectRes = await fetch(
    `${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}:securityRules`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }
  );
  assert.equal(
    projectRes.status,
    200,
    `Falha ao carregar firestore.rules no Firestore Emulator para banco ${DATABASE_ID} (dbColon=${dbColonRes.status}, projectScoped=${projectRes.status})`
  );
}

function workspaceDocUrl(workspaceId: string): string {
  return `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/workspaces/${workspaceId}`;
}

function docUrl(workspaceId: string, col: string, id: string): string {
  return `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/workspaces/${workspaceId}/${col}/${encodeURIComponent(id)}`;
}

function colUrl(workspaceId: string, col: string): string {
  return `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/workspaces/${workspaceId}/${col}`;
}

function buildExpiredEmulatorStyleJwt(uid: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      aud: PROJECT_ID,
      auth_time: now - 7200,
      user_id: uid,
      sub: uid,
      iat: now - 7200,
      exp: now - 3600,
      firebase: { sign_in_provider: 'password' },
    })
  ).toString('base64url');
  return `${header}.${payload}.`;
}

test('Suite Real Firebase Emulator — Segurança (10 Cenários) + Compatibilidade Total de Schema', async (t) => {
  await assertEmulatorsRunning({
    authBaseUrl: AUTH_EMULATOR_URL,
    firestoreBaseUrl: FIRESTORE_EMULATOR_URL,
    projectId: PROJECT_ID,
  });

  const adminUser = await createEmulatorUser('admin-rules@example.com', 'test-pass-1234');
  const intruderUser = await createEmulatorUser('intruder-rules@example.com', 'test-pass-1234');

  const validLeadPayload = toFirestoreDoc({
    id: 'lead-test-1',
    nicheId: 'niche-padrao',
    companyName: 'Empresa Teste',
    phone: '5511999998888',
    stage: 'leads_sem_contato',
    notes: [],
    schemaVersion: 1,
    updatedAt: '2026-11-16T12:00:00.000Z',
  });

  const validNichePayload = toFirestoreDoc({
    id: 'niche-padrao',
    name: 'Prospecção Geral',
    segment: 'Sites',
    city: 'Brasil',
    emoji: '🚀',
    targetMrr: 5000,
    scripts: {},
    schemaVersion: 1,
    updatedAt: '2026-11-16T12:00:00.000Z',
  });

  const validSheetPayload = toFirestoreDoc({
    id: 'sheet-test-1',
    name: 'planilha.xlsx',
    nicheId: 'niche-padrao',
    totalLeads: 10,
    schemaVersion: 1,
    updatedAt: '2026-11-16T12:00:00.000Z',
  });

  // =========================================================================
  // FASE 3 — 10 CENÁRIOS OBRIGATÓRIOS DE SEGURANÇA NO EMULATOR REAL
  // =========================================================================

  await t.test('Segurança 6: Configuração ausente / placeholder (fail-closed) bloqueia inclusive usuário autenticado', async () => {
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

  // Carrega regras com o UID do administrador de teste para os demais cenários
  await loadRulesFromFile(adminUser.uid);

  await t.test('Segurança 1 e 2: Admin único autorizado lê, cria, atualiza e exclui leads, nichos e importedSheets (mas não lista/altera workspaces)', async () => {
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

    // Leitura do documento raiz do workspace (testFirestoreConnection) permitida (200 se existir, 404 se vazio)
    const getWs = await fetch(workspaceDocUrl(WORKSPACE_ID), {
      headers: { Authorization: `Bearer ${adminUser.idToken}` },
    });
    assert.ok(
      getWs.status === 200 || getWs.status === 404,
      `Admin get em workspaces/${WORKSPACE_ID} deveria passar pelas regras (200/404), recebeu ${getWs.status}`
    );

    const intruderGetWs = await fetch(workspaceDocUrl(WORKSPACE_ID), {
      headers: { Authorization: `Bearer ${intruderUser.idToken}` },
    });
    assert.equal(intruderGetWs.status, 403);

    // Escrita direta no documento raiz do workspace negada ao cliente
    const writeWs = await fetch(workspaceDocUrl(WORKSPACE_ID), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(toFirestoreDoc({ owner: 'hacked' })),
    });
    assert.equal(writeWs.status, 403);

    // Exclusão autorizada pelo admin (cria e exclui registro temporário sem afetar os seguintes)
    const delTempLead = await fetch(docUrl(WORKSPACE_ID, 'leads', 'lead-del-check'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(validLeadPayload),
    });
    assert.equal(delTempLead.status, 200);
    const delRes = await fetch(docUrl(WORKSPACE_ID, 'leads', 'lead-del-check'), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminUser.idToken}` },
    });
    assert.equal(delRes.status, 200);
  });

  await t.test('Segurança 3: Outro UID autenticado é negado em leitura e escrita', async () => {
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

    const otherDelete = await fetch(docUrl(WORKSPACE_ID, 'leads', 'lead-test-1'), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${intruderUser.idToken}` },
    });
    assert.equal(otherDelete.status, 403);
  });

  await t.test('Segurança 4: Usuário não autenticado (anônimo) é negado em leitura e escrita', async () => {
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

  await t.test('Segurança 5: Outro workspace (inclusive legado kaizenvisual123) é negado', async () => {
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

  await t.test('Segurança 7: Schema inválido, campos extras não permitidos e tipos errados são negados', async () => {
    const shadowFieldWrite = await fetch(docUrl(WORKSPACE_ID, 'leads', 'lead-shadow-1'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'lead-shadow-1',
          companyName: 'Empresa Teste',
          phone: '5511999998888',
          stage: 'leads_sem_contato',
          isAdmin: true,
        })
      ),
    });
    assert.equal(shadowFieldWrite.status, 403);

    const wrongTypeSheet = await fetch(docUrl(WORKSPACE_ID, 'importedSheets', 'sheet-bad-type'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify({
        fields: {
          name: { stringValue: 'planilha.csv' },
          nicheId: { stringValue: 'niche-padrao' },
          totalLeads: { stringValue: 'dez' }, // deveria ser number
        },
      }),
    });
    assert.equal(wrongTypeSheet.status, 403);

    const emptyCompanyLead = await fetch(docUrl(WORKSPACE_ID, 'leads', 'lead-empty-name'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          companyName: '',
          phone: '5511999998888',
          stage: 'leads_sem_contato',
        })
      ),
    });
    assert.equal(emptyCompanyLead.status, 403);
  });

  await t.test('Segurança 8: IDs de documentos inválidos (espaços, caracteres especiais, >128 chars) são negados', async () => {
    const invalidIds = [
      'lead com espaco',
      'lead.com.ponto',
      'lead$invalido',
      'x'.repeat(129),
    ];

    for (const badId of invalidIds) {
      const writeBadId = await fetch(docUrl(WORKSPACE_ID, 'leads', badId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminUser.idToken}`,
        },
        body: JSON.stringify(validLeadPayload),
      });
      assert.equal(writeBadId.status, 403, `ID inválido "${badId}" deve ser negado (403)`);

      const getBadId = await fetch(docUrl(WORKSPACE_ID, 'leads', badId), {
        headers: { Authorization: `Bearer ${adminUser.idToken}` },
      });
      assert.equal(getBadId.status, 403, `GET em ID inválido "${badId}" deve ser negado (403)`);
    }
  });

  await t.test('Segurança 9: Coleções, subcoleções e caminhos não autorizados são negados', async () => {
    const unknownSubcol = await fetch(docUrl(WORKSPACE_ID, 'secrets', 'secret-1'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(toFirestoreDoc({ key: 'x' })),
    });
    assert.equal(unknownSubcol.status, 403);

    const nestedUnauthorized = await fetch(
      `${docUrl(WORKSPACE_ID, 'leads', 'lead-test-1')}/privateNotes/note-1`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminUser.idToken}`,
        },
        body: JSON.stringify(toFirestoreDoc({ text: 'secret' })),
      }
    );
    assert.equal(nestedUnauthorized.status, 403);

    const rootCol = await fetch(
      `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users/${adminUser.uid}`,
      {
        headers: { Authorization: `Bearer ${adminUser.idToken}` },
      }
    );
    assert.equal(rootCol.status, 403);
  });

  await t.test('Segurança 10: Token inválido, malformado, sem sub ou com sub adulterado é bloqueado (400/401/403)', async () => {
    // 1. Token não-JWT malformado
    const malformedTokenRes = await fetch(colUrl(WORKSPACE_ID, 'leads'), {
      headers: { Authorization: 'Bearer not-a-valid-jwt' },
    });
    assert.ok(
      malformedTokenRes.status === 400 ||
        malformedTokenRes.status === 401 ||
        malformedTokenRes.status === 403,
      `Token malformado retornou ${malformedTokenRes.status}`
    );

    // 2. Esquema de autenticação inválido e Header Bearer vazio (nunca retornam 200)
    const wrongSchemeRes = await fetch(colUrl(WORKSPACE_ID, 'leads'), {
      headers: { Authorization: 'Basic aW52YWxpZA==' },
    });
    assert.ok(
      wrongSchemeRes.status >= 400 && wrongSchemeRes.status < 600,
      `Esquema Basic inválido não pode autorizar (retornou ${wrongSchemeRes.status})`
    );

    const emptyBearerRes = await fetch(colUrl(WORKSPACE_ID, 'leads'), {
      headers: { Authorization: 'Bearer ' },
    });
    assert.ok(
      emptyBearerRes.status >= 400 && emptyBearerRes.status < 600,
      `Bearer vazio não pode autorizar (retornou ${emptyBearerRes.status})`
    );

    // 3. JWT com payload JSON corrompido
    const badJsonPayloadToken = `eyJhbGciOiJub25lIn0.not_valid_json.${crypto.randomBytes(4).toString('base64url')}`;
    const badJsonRes = await fetch(colUrl(WORKSPACE_ID, 'leads'), {
      headers: { Authorization: `Bearer ${badJsonPayloadToken}` },
    });
    assert.ok(
      badJsonRes.status === 400 || badJsonRes.status === 401 || badJsonRes.status === 403,
      `Token com payload inválido retornou ${badJsonRes.status}`
    );

    const parts = adminUser.idToken.split('.');

    // 4. JWT com payload sem sub/user_id (tratado pelas Rules como não autenticado -> 403)
    const noSubToken = `${parts[0]}.${Buffer.from(
      JSON.stringify({ aud: PROJECT_ID, iss: `https://securetoken.google.com/${PROJECT_ID}` })
    ).toString('base64url')}.`;
    const noSubRes = await fetch(colUrl(WORKSPACE_ID, 'leads'), {
      headers: { Authorization: `Bearer ${noSubToken}` },
    });
    assert.equal(noSubRes.status, 403);

    // 5. JWT adulterado com sub/user_id diferente do admin configurado é barrado pelas rules (403)
    const tamperedSubToken = `${parts[0]}.${Buffer.from(
      JSON.stringify({ sub: intruderUser.uid, user_id: intruderUser.uid, aud: PROJECT_ID })
    ).toString('base64url')}.`;
    const tamperedSubRes = await fetch(docUrl(WORKSPACE_ID, 'leads', 'lead-tampered'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tamperedSubToken}`,
      },
      body: JSON.stringify(validLeadPayload),
    });
    assert.equal(tamperedSubRes.status, 403);

    // Nota: o Firestore Emulator Suite não verifica assinatura criptográfica nem claim `exp`
    // de JWTs locais (conforme aviso oficial do Auth Emulator: "does not validate JWTs").
    // Em produção, assinatura RS256 e expiração são validadas pelo Google Identity Toolkit e
    // pelo middleware backend (`tests/apiSecurity.test.ts`).
    void buildExpiredEmulatorStyleJwt;
  });

  // =========================================================================
  // FASE 6 — TESTES REAIS DE COMPATIBILIDADE TOTAL DE SCHEMA NO EMULATOR
  // =========================================================================

  await t.test('Compatibilidade 1: Lead completo real (NewLeadModal + LeadModal + Agenda + AI Pitch + Notas) grava e atualiza sem rejeição', async () => {
    const leadId = 'lead-1763300000000-ab12c';
    const fullLead = toFirestoreDoc({
      id: leadId,
      nicheId: 'niche-nutri-padrao',
      companyName: 'Clínica NutriVida Avançada',
      contactName: 'Dra. Camila Mendes',
      phone: '5511988887777',
      displayPhone: '+55 (11) 98888-7777',
      address: 'Av. Paulista, 1000 - Bela Vista',
      city: 'São Paulo - SP',
      category: 'Nutricionista',
      googleRating: 4.9,
      googleReviewsCount: 142,
      googleMapsUrl:
        'https://www.google.com/maps/place/Clinica+NutriVida/@-23.5614,-46.6558,17z/data=!3m1!4b1!4m6!3m5!1s0x94ce59c8da0aa315:0xd59f9431f2c9776a!8m2!3d-23.5614!4d-46.6558!16s%2Fg%2F11c48j9z7x',
      websiteUrl: 'https://nutrivida.com.br',
      mockupUrl: 'https://previa-nutri.framer.website',
      stage: 'reuniao_marcada',
      scriptUsed: 'script_nutri_mensagens',
      creationValue: 697,
      monthlyMrr: 200,
      lastContactDate: '2026-11-16T10:15:00.000Z',
      notes: [
        {
          id: 'note-1',
          date: '16/11/2026 10:15',
          text: 'Reunião confirmada pelo WhatsApp.',
          author: 'Ian',
        },
      ],
      objection: 'Sem objeções',
      createdAt: '2026-11-10T09:00:00.000Z',
      aiPitch: 'Olá Dra. Camila! Preparamos uma demonstração personalizada.',
      opportunityAngle: 'Site profissional com agendamento direto',
      meetingDate: '2026-11-20',
      meetingTime: '14:30',
      meetingNotes: 'Apresentar protótipo responsivo e plano de recorrência.',
      meetingLink: 'https://meet.google.com/abc-defg-hij',
      meetingStatus: 'agendada',
      callbackDate: '2026-11-18',
      callbackTime: '15:00',
      callbackNotes: 'Confirmar presença 2h antes',
      callbackStatus: 'pendente',
      schemaVersion: 1,
      updatedAt: '2026-11-16T10:20:00.000Z',
    });

    const res = await fetch(docUrl(WORKSPACE_ID, 'leads', leadId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(fullLead),
    });
    assert.equal(res.status, 200);
  });

  await t.test('Compatibilidade 2: Lead legado com campos opcionais nulos/vazios (notes: null, phone: "") e merge parcial reassignLeadsNicheInFirestore', async () => {
    const legacyId = 'lead-imp-1763300000123-0';
    const legacyLead = toFirestoreDoc({
      id: legacyId,
      nicheId: 'niche-origem',
      companyName: 'Consultório Legado',
      phone: '',
      stage: 'nao_iniciada',
      notes: null,
      creationValue: null,
      monthlyMrr: null,
    });

    const createRes = await fetch(docUrl(WORKSPACE_ID, 'leads', legacyId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(legacyLead),
    });
    assert.equal(createRes.status, 200);

    // Simula reassignLeadsNicheInFirestore (`set(..., { nicheId, updatedAt }, { merge: true })`)
    const mergeRes = await fetch(
      `${docUrl(WORKSPACE_ID, 'leads', legacyId)}?updateMask.fieldPaths=nicheId&updateMask.fieldPaths=updatedAt`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminUser.idToken}`,
        },
        body: JSON.stringify(
          toFirestoreDoc({
            nicheId: 'niche-destino',
            updatedAt: '2026-11-16T12:30:00.000Z',
          })
        ),
      }
    );
    assert.equal(mergeRes.status, 200);
  });

  await t.test('Compatibilidade 3: NicheCampaign real completo (INITIAL_NICHES + scripts profundos + targetCities) e variações legadas nulas', async () => {
    const realNiche = INITIAL_NICHES[0];
    const nichePayload = toFirestoreDoc({
      ...realNiche,
      targetCities: ['Arapiraca - AL', 'Maceió - AL'],
      schemaVersion: 1,
      updatedAt: '2026-11-16T12:00:00.000Z',
    });

    const res = await fetch(docUrl(WORKSPACE_ID, 'niches', realNiche.id), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(nichePayload),
    });
    assert.equal(res.status, 200);

    const nullableNiche = toFirestoreDoc({
      id: 'niche-1763300000999',
      name: 'Clínicas Médicas',
      segment: '',
      city: 'Brasil',
      targetCities: null,
      scripts: null,
      targetMrr: null,
    });
    const nullRes = await fetch(docUrl(WORKSPACE_ID, 'niches', 'niche-1763300000999'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(nullableNiche),
    });
    assert.equal(nullRes.status, 200);
  });

  await t.test('Compatibilidade 4: ImportedSheet real completo (leadsSummary + format + size) e nulos', async () => {
    const sheetId = 'sheet-1763300000555';
    const sheetPayload = toFirestoreDoc({
      id: sheetId,
      name: 'dentistas-arapiraca.xlsx',
      nicheId: 'niche-nutri-padrao',
      nicheName: 'Nutrição & Saúde',
      importedAt: '2026-11-16T11:00:00.000Z',
      totalLeads: 25,
      format: 'Excel (.xlsx)',
      size: 48120,
      leadsSummary: Array.from({ length: 10 }, (_, idx) => ({
        companyName: `Clínica ${idx + 1}`,
        phone: `558299999000${idx}`,
        city: 'Arapiraca - AL',
        category: 'Clínica',
      })),
      schemaVersion: 1,
      updatedAt: '2026-11-16T11:00:00.000Z',
    });

    const res = await fetch(docUrl(WORKSPACE_ID, 'importedSheets', sheetId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(sheetPayload),
    });
    assert.equal(res.status, 200);

    const nullSummaryRes = await fetch(docUrl(WORKSPACE_ID, 'importedSheets', 'sheet-null-sum'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'sheet-null-sum',
          name: 'manual.csv',
          nicheId: 'niche-nutri-padrao',
          totalLeads: 0,
          leadsSummary: null,
        })
      ),
    });
    assert.equal(nullSummaryRes.status, 200);

    // Excluir registro de teste como na interface (handleDeleteImportedSheet)
    const delRes = await fetch(docUrl(WORKSPACE_ID, 'importedSheets', 'sheet-null-sum'), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminUser.idToken}` },
    });
    assert.equal(delRes.status, 200);
  });

  await t.test('Compatibilidade 5: Client real completo (Etapa 2) grava, valida campos permitidos e rejeita campo extra', async () => {
    const clientId = 'cli-1763300000100-abcde';
    const validClient = toFirestoreDoc({
      id: clientId,
      originLeadId: 'lead-1763300000000-ab12c',
      originNicheId: 'niche-nutri-padrao',
      companyName: 'Clínica NutriVida Avançada',
      contactName: 'Dra. Camila Mendes',
      document: '12.345.678/0001-99',
      email: 'contato@nutrivida.com.br',
      phone: '5511988887777',
      displayPhone: '+55 (11) 98888-7777',
      city: 'São Paulo - SP',
      status: 'ativo',
      setupValue: 1200,
      monthlyMrr: 350,
      billingDay: 10,
      contractStartDate: '2026-11-16',
      serviceScope: 'Criação de Site e Suporte Mensal',
      timeline: [
        {
          id: 'evt-1',
          date: '2026-11-16T10:00:00.000Z',
          type: 'conversao_lead',
          title: 'Lead convertido em cliente',
          author: 'Ian',
        },
      ],
      createdAt: '2026-11-16T10:00:00.000Z',
      schemaVersion: 1,
      updatedAt: '2026-11-16T10:00:00.000Z',
    });

    const writeRes = await fetch(docUrl(WORKSPACE_ID, 'clients', clientId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(validClient),
    });
    assert.equal(writeRes.status, 200);

    const shadowClient = await fetch(docUrl(WORKSPACE_ID, 'clients', 'cli-shadow'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'cli-shadow',
          companyName: 'Cliente Shadow',
          status: 'ativo',
          extraFieldBlocked: true,
        })
      ),
    });
    assert.equal(shadowClient.status, 403);
  });

  await t.test('Compatibilidade 6: ProposalContract real completo (Etapa 2) grava e respeita regras rígidas', async () => {
    const propId = 'prop-1763300000200-fghij';
    const validProposal = toFirestoreDoc({
      id: propId,
      code: 'KZ-P-2026-001',
      kind: 'proposta',
      title: 'Proposta Comercial — Clínica NutriVida',
      status: 'enviada',
      clientId: 'cli-1763300000100-abcde',
      leadId: 'lead-1763300000000-ab12c',
      recipientCompany: 'Clínica NutriVida Avançada',
      recipientContact: 'Dra. Camila Mendes',
      recipientPhone: '5511988887777',
      issuerName: 'Agência Kaizen',
      items: [
        {
          id: 'item-1',
          title: 'Desenvolvimento de Site Profissional',
          billingType: 'setup',
          quantity: 1,
          unitPrice: 1200,
        },
      ],
      discountValue: 0,
      setupTotal: 1200,
      monthlyMrr: 350,
      deliveryDeadlineDays: 7,
      history: [
        {
          id: 'hist-1',
          date: '2026-11-16T10:30:00.000Z',
          status: 'enviada',
          title: 'Proposta enviada',
          author: 'Ian',
        },
      ],
      createdAt: '2026-11-16T10:30:00.000Z',
      schemaVersion: 1,
      updatedAt: '2026-11-16T10:30:00.000Z',
    });

    const writeRes = await fetch(docUrl(WORKSPACE_ID, 'proposals', propId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(validProposal),
    });
    assert.equal(writeRes.status, 200);
  });

  await t.test('Compatibilidade 7: Coleções da Etapa 3 (projects, tasks, agendaEvents, socialChannels, socialPosts) gravam e bloqueiam campo extra', async () => {
    const projectRes = await fetch(docUrl(WORKSPACE_ID, 'projects', 'proj-1763300000300-a1b2c'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'proj-1763300000300-a1b2c',
          name: 'Landing Page + GBP NutriVida',
          clientId: 'cli-1763300000100-abcde',
          serviceType: 'Kaizen Start',
          templateId: 'kaizen_start',
          status: 'em_andamento',
          ownerName: 'Ian',
          startDate: '2026-11-16',
          dueDate: '2026-11-30',
          documents: [],
          history: [],
          createdAt: '2026-11-16T12:00:00.000Z',
          schemaVersion: 1,
          updatedAt: '2026-11-16T12:00:00.000Z',
        })
      ),
    });
    assert.equal(projectRes.status, 200);

    const taskRes = await fetch(docUrl(WORKSPACE_ID, 'tasks', 'task-1763300000301-d3e4f'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'task-1763300000301-d3e4f',
          title: 'Publicar Landing Page',
          projectId: 'proj-1763300000300-a1b2c',
          clientId: 'cli-1763300000100-abcde',
          dueDate: '2026-11-22',
          priority: 'alta',
          status: 'a_fazer',
          checklist: [{ id: 'chk-1', title: 'Testar mobile', done: false }],
          createdAt: '2026-11-16T12:00:00.000Z',
          schemaVersion: 1,
          updatedAt: '2026-11-16T12:00:00.000Z',
        })
      ),
    });
    assert.equal(taskRes.status, 200);

    const eventRes = await fetch(docUrl(WORKSPACE_ID, 'agendaEvents', 'evt-1763300000302-g5h6i'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'evt-1763300000302-g5h6i',
          title: 'Alinhamento quinzenal',
          date: '2026-11-18',
          startTime: '14:00',
          endTime: '14:45',
          type: 'reuniao_cliente',
          status: 'agendado',
          clientId: 'cli-1763300000100-abcde',
          createdAt: '2026-11-16T12:00:00.000Z',
          schemaVersion: 1,
          updatedAt: '2026-11-16T12:00:00.000Z',
        })
      ),
    });
    assert.equal(eventRes.status, 200);

    const channelRes = await fetch(docUrl(WORKSPACE_ID, 'socialChannels', 'sch-1763300000303-j7k8l'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'sch-1763300000303-j7k8l',
          ownerType: 'kaizen',
          platform: 'instagram',
          handle: '@agenciakaizen',
          active: true,
          createdAt: '2026-11-16T12:00:00.000Z',
          schemaVersion: 1,
          updatedAt: '2026-11-16T12:00:00.000Z',
        })
      ),
    });
    assert.equal(channelRes.status, 200);

    const postRes = await fetch(docUrl(WORKSPACE_ID, 'socialPosts', 'post-1763300000304-m9n0p'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'post-1763300000304-m9n0p',
          title: 'Bastidores entrega Kaizen Start',
          ownerType: 'kaizen',
          channelId: 'sch-1763300000303-j7k8l',
          platform: 'instagram',
          format: 'carrossel',
          plannedDate: '2026-11-21',
          plannedTime: '18:00',
          assignee: 'Ian',
          status: 'planejamento',
          createdAt: '2026-11-16T12:00:00.000Z',
          schemaVersion: 1,
          updatedAt: '2026-11-16T12:00:00.000Z',
        })
      ),
    });
    assert.equal(postRes.status, 200);

    const shadowPost = await fetch(docUrl(WORKSPACE_ID, 'socialPosts', 'post-shadow-bad'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'post-shadow-bad',
          title: 'Shadow Post',
          ownerType: 'kaizen',
          platform: 'instagram',
          format: 'post',
          plannedDate: '2026-11-21',
          assignee: 'Ian',
          status: 'ideias',
          extraFieldBlocked: true,
        })
      ),
    });
    assert.equal(shadowPost.status, 403);
  });

  await t.test('Compatibilidade 8: Coleções financeiras da Etapa 4 validam schemas, bloqueiam campo extra e preservam imutabilidade', async () => {
    const entryRes = await fetch(docUrl(WORKSPACE_ID, 'financialEntries', 'fin-1763300000401-abcd'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'fin-1763300000401-abcd',
          kind: 'receita',
          description: 'Mensalidade Clínica NutriVida',
          clientId: 'cli-1763300000100-abcde',
          categoryId: 'fcat-rec-mrr',
          amountCents: 150000,
          settledCents: 0,
          competenceDate: '2026-11-01',
          dueDate: '2026-11-10',
          paymentMethod: 'pix',
          status: 'pendente',
          createdAt: '2026-11-01T10:00:00.000Z',
          schemaVersion: 1,
          updatedAt: '2026-11-01T10:00:00.000Z',
        })
      ),
    });
    assert.equal(entryRes.status, 200);

    const txRes = await fetch(docUrl(WORKSPACE_ID, 'financialTransactions', 'ftx-1763300000402-efgh'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'ftx-1763300000402-efgh',
          entryId: 'fin-1763300000401-abcd',
          entryKind: 'receita',
          kind: 'recebimento',
          amountCents: 150000,
          date: '2026-11-10',
          paymentMethod: 'pix',
          createdBy: 'Ian',
          createdAt: '2026-11-10T14:00:00.000Z',
          schemaVersion: 1,
          updatedAt: '2026-11-10T14:00:00.000Z',
        })
      ),
    });
    assert.equal(txRes.status, 200);

    const deleteTxBlocked = await fetch(docUrl(WORKSPACE_ID, 'financialTransactions', 'ftx-1763300000402-efgh'), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminUser.idToken}` },
    });
    assert.equal(deleteTxBlocked.status, 403);

    const catRes = await fetch(docUrl(WORKSPACE_ID, 'financialCategories', 'fcat-rec-mrr'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'fcat-rec-mrr',
          name: 'Mensalidade / Recorrência (MRR)',
          kind: 'receita',
          active: true,
          isDefault: true,
          createdAt: '2026-11-01T10:00:00.000Z',
          schemaVersion: 1,
          updatedAt: '2026-11-01T10:00:00.000Z',
        })
      ),
    });
    assert.equal(catRes.status, 200);

    const recRes = await fetch(docUrl(WORKSPACE_ID, 'financialRecurrences', 'frec-1763300000403-ijkl'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'frec-1763300000403-ijkl',
          name: 'Servidor Vercel Pro',
          kind: 'despesa',
          amountCents: 12000,
          categoryId: 'fcat-desp-hospedagem',
          paymentMethod: 'cartao_credito',
          frequency: 'mensal',
          startDate: '2026-11-05',
          nextOccurrenceDate: '2026-12-05',
          status: 'ativa',
          createdAt: '2026-11-01T10:00:00.000Z',
          schemaVersion: 1,
          updatedAt: '2026-11-01T10:00:00.000Z',
        })
      ),
    });
    assert.equal(recRes.status, 200);

    const settingsRes = await fetch(docUrl(WORKSPACE_ID, 'financialSettings', 'default'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'default',
          companyName: 'Agência Kaizen',
          currency: 'BRL',
          dateFormat: 'DD/MM/YYYY',
          timezone: 'America/Maceio',
          openingBalanceCents: 500000,
          openingBalanceDate: '2026-11-01',
          openingBalanceDescription: 'Saldo inicial validado',
          alertDaysAhead: 5,
          defaultDueDay: 10,
          schemaVersion: 1,
          updatedAt: '2026-11-01T10:00:00.000Z',
        })
      ),
    });
    assert.equal(settingsRes.status, 200);

    const auditCreateRes = await fetch(docUrl(WORKSPACE_ID, 'financialAuditLogs', 'faud-1763300000404-mnop'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'faud-1763300000404-mnop',
          entityType: 'entry',
          entityId: 'fin-1763300000401-abcd',
          action: 'criacao',
          description: 'Receita criada em teste de regras',
          amountCents: 150000,
          actor: 'Ian',
          createdAt: '2026-11-01T10:00:00.000Z',
          schemaVersion: 1,
          updatedAt: '2026-11-01T10:00:00.000Z',
        })
      ),
    });
    assert.equal(auditCreateRes.status, 200);

    const auditUpdateBlocked = await fetch(docUrl(WORKSPACE_ID, 'financialAuditLogs', 'faud-1763300000404-mnop'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'faud-1763300000404-mnop',
          entityType: 'entry',
          entityId: 'fin-1763300000401-abcd',
          action: 'criacao',
          description: 'Tentativa de adulteração',
          actor: 'Ian',
        })
      ),
    });
    assert.equal(auditUpdateBlocked.status, 403);

    const shadowEntryBlocked = await fetch(docUrl(WORKSPACE_ID, 'financialEntries', 'fin-shadow-bad'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminUser.idToken}`,
      },
      body: JSON.stringify(
        toFirestoreDoc({
          id: 'fin-shadow-bad',
          kind: 'receita',
          description: 'Lançamento Shadow',
          categoryId: 'fcat-rec-mrr',
          amountCents: 10000,
          settledCents: 0,
          competenceDate: '2026-11-01',
          dueDate: '2026-11-10',
          paymentMethod: 'pix',
          status: 'pendente',
          extraFieldBlocked: true,
        })
      ),
    });
    assert.equal(shadowEntryBlocked.status, 403);
  });
});

