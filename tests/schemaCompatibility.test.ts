import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { INITIAL_NICHES } from '../src/utils/initialData';
import { sanitizeForFirestore } from '../src/utils/firebase';
import { FUNNEL_STAGES, normalizeStageId } from '../src/types/crm';
import {
  applyAdminUidToRulesContent,
  hasPendingUidPlaceholder,
} from '../scripts/configure-rules-uid';

const VALID_DOC_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

test('Todos os padrões de ID gerados pelo CRM respeitam ^[a-zA-Z0-9_\\-]+$ e tamanho <= 128', () => {
  const sampleIds = [
    INITIAL_NICHES[0].id,
    `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    `lead-imp-${Date.now()}-0`,
    `niche-${Date.now()}`,
    `sheet-${Date.now()}`,
    `cli-${Date.now()}-ab12c`,
    `prop-${Date.now()}-xy89z`,
    `proj-${Date.now()}-k9m2a`,
    `task-${Date.now()}-p4q7r`,
    `evt-${Date.now()}-u8v1w`,
    `sch-${Date.now()}-c3d4e`,
    `post-${Date.now()}-f5g6h`,
    `fin-${Date.now()}-m1n2o`,
    `fin-rec-frec-${Date.now()}-p3q4r-2026-11-17`,
    `ftx-${Date.now()}-s5t6u`,
    `fcat-${Date.now()}-v7w8x`,
    `frec-${Date.now()}-y9z0a`,
    `faud-${Date.now()}-b1c2d`,
    `rfile-${Date.now()}-e3f4g`,
    `rfold-${Date.now()}-h5i6j`,
    `rcat-doc-${Date.now()}-k7l8`,
    `cscr-${Date.now()}-m9n0p`,
    `tmpl-${Date.now()}-q1r2s`,
    `creport-${Date.now()}-z4x8c`,
    `syslog-${Date.now()}-a1b2c`,
    `ntf-cb-lead-1-2026-11-18`,
    `auto-comm-stale-leads`,
    `autolog-auto-comm-stale-leads-${Date.now()}-xy12`,
    `aiconv-${Date.now()}-m3n4p`,
    'default',
  ];

  for (const id of sampleIds) {
    assert.ok(id.length >= 1 && id.length <= 128, `Tamanho inválido para ${id}`);
    assert.match(id, VALID_DOC_ID_REGEX, `Caracteres inválidos em ${id}`);
  }
});

test('sanitizeForFirestore remove undefined recursivamente sem corromper nulos, arrays e mapas profundos', () => {
  const dirtyLead = {
    id: 'lead-1',
    nicheId: 'niche-nutri-padrao',
    companyName: 'Clínica Exemplo',
    contactName: undefined,
    phone: '5511999998888',
    stage: 'leads_sem_contato',
    creationValue: undefined,
    notes: [
      { id: 'n1', date: '16/11/2026', text: 'Teste', author: undefined },
      undefined,
    ],
    objection: null,
  };

  const cleaned = sanitizeForFirestore(dirtyLead) as Record<string, unknown>;
  assert.equal('contactName' in cleaned, false);
  assert.equal('creationValue' in cleaned, false);
  assert.equal(cleaned.objection, null);
  assert.equal(Array.isArray(cleaned.notes), true);
  assert.equal((cleaned.notes as unknown[]).length, 1);
  assert.equal('author' in ((cleaned.notes as Record<string, unknown>[])[0]), false);
});

test('Todas as etapas atuais e aliases legados normalizam dentro dos limites de firestore.rules', () => {
  const legacyAndCurrent = [
    ...FUNNEL_STAGES.map((s) => s.id),
    'nao_iniciada',
    'mockup_enviado',
    'nao_respondida',
    'nao_tem_contato',
    'interessado',
    'nao_interessado',
  ];

  for (const rawStage of legacyAndCurrent) {
    const normalized = normalizeStageId(rawStage);
    assert.ok(normalized.length >= 1 && normalized.length <= 60);
    assert.ok(rawStage.length >= 1 && rawStage.length <= 60);
  }
});

test('INITIAL_NICHES e scripts padrão são integralmente compatíveis com as regras de isValidNiche', () => {
  for (const niche of INITIAL_NICHES) {
    assert.ok(niche.name.length >= 1 && niche.name.length <= 200);
    assert.ok(niche.segment.length <= 200);
    assert.ok(niche.city.length <= 150);
    assert.ok(niche.emoji.length <= 32);
    assert.equal(typeof niche.targetMrr, 'number');
    assert.equal(typeof niche.scripts, 'object');
    assert.ok(Object.keys(niche.scripts).length >= 1);
  }
});

test('Isolamento de segredos: src/config/env.ts não importa nem referencia GEMINI_API_KEY ou GOOGLE_APPLICATION_CREDENTIALS', () => {
  const envFile = fs.readFileSync(path.resolve(process.cwd(), 'src/config/env.ts'), 'utf-8');
  assert.equal(envFile.includes('GEMINI_API_KEY'), false);
  assert.equal(envFile.includes('GOOGLE_APPLICATION_CREDENTIALS'), false);
  assert.equal(envFile.includes('process.env'), false);
});

test('configure-rules-uid aplica UID no return de authorizedAdminUid() preservando guarda hasValidAdminUidConfig()', () => {
  const realRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
  assert.match(realRules, /(?:authorizedAdminUid\(\)|uid)\s*!=\s*'REPLACE_WITH_YOUR_FIREBASE_UID'/);

  const fixtureTemplate = `
    function authorizedAdminUid() {
      return 'REPLACE_WITH_YOUR_FIREBASE_UID';
    }
    function hasValidAdminUidConfig() {
      let uid = authorizedAdminUid();
      return uid != 'REPLACE_WITH_YOUR_FIREBASE_UID';
    }
  `;
  assert.equal(hasPendingUidPlaceholder(fixtureTemplate), true);

  const configured = applyAdminUidToRulesContent(fixtureTemplate, 'RealAdminUid987654');
  assert.equal(hasPendingUidPlaceholder(configured), false);
  assert.match(configured, /return 'RealAdminUid987654';/);
  assert.match(configured, /(?:authorizedAdminUid\(\)|uid)\s*!=\s*'REPLACE_WITH_YOUR_FIREBASE_UID'/);
});

test('firebase-blueprint.json e firestore.rules declaram as 6 coleções financeiras da Etapa 4 com imutabilidade auditável', () => {
  const blueprintRaw = fs.readFileSync(
    path.resolve(process.cwd(), 'firebase-blueprint.json'),
    'utf-8'
  );
  const blueprint = JSON.parse(blueprintRaw) as {
    firestore?: Record<string, unknown>;
    entities?: Record<string, unknown>;
  };

  const firestorePaths = Object.keys(blueprint.firestore || {});
  const requiredPaths = [
    '/workspaces/{workspaceId}/financialEntries/{entryId}',
    '/workspaces/{workspaceId}/financialTransactions/{txId}',
    '/workspaces/{workspaceId}/financialCategories/{categoryId}',
    '/workspaces/{workspaceId}/financialRecurrences/{recurrenceId}',
    '/workspaces/{workspaceId}/financialSettings/{settingId}',
    '/workspaces/{workspaceId}/financialAuditLogs/{logId}',
  ];

  for (const reqPath of requiredPaths) {
    assert.ok(
      firestorePaths.includes(reqPath),
      `Caminho ausente em firebase-blueprint.json: ${reqPath}`
    );
  }

  const realRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
  assert.match(realRules, /match \/financialEntries\/\{entryId\}/);
  assert.match(realRules, /match \/financialTransactions\/\{txId\}/);
  assert.match(realRules, /match \/financialCategories\/\{categoryId\}/);
  assert.match(realRules, /match \/financialRecurrences\/\{recurrenceId\}/);
  assert.match(realRules, /match \/financialSettings\/\{settingId\}/);
  assert.match(realRules, /match \/financialAuditLogs\/\{logId\}/);
  assert.match(realRules, /allow delete, update: if false;/);
});

test('firebase-blueprint.json, firestore.rules e storage.rules cobrem as 5 coleções e Storage da Etapa 5', () => {
  const blueprintRaw = fs.readFileSync(
    path.resolve(process.cwd(), 'firebase-blueprint.json'),
    'utf-8'
  );
  const blueprint = JSON.parse(blueprintRaw) as {
    firestore?: Record<string, unknown>;
  };

  const firestorePaths = Object.keys(blueprint.firestore || {});
  const etapa5Paths = [
    '/workspaces/{workspaceId}/resourceFiles/{fileId}',
    '/workspaces/{workspaceId}/resourceFolders/{folderId}',
    '/workspaces/{workspaceId}/resourceCategories/{categoryId}',
    '/workspaces/{workspaceId}/commercialScripts/{scriptId}',
    '/workspaces/{workspaceId}/modelTemplates/{templateId}',
  ];

  for (const reqPath of etapa5Paths) {
    assert.ok(
      firestorePaths.includes(reqPath),
      `Caminho da Etapa 5 ausente em firebase-blueprint.json: ${reqPath}`
    );
  }

  const realRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
  assert.match(realRules, /match \/resourceFiles\/\{fileId\}/);
  assert.match(realRules, /match \/resourceFolders\/\{folderId\}/);
  assert.match(realRules, /match \/resourceCategories\/\{categoryId\}/);
  assert.match(realRules, /match \/commercialScripts\/\{scriptId\}/);
  assert.match(realRules, /match \/modelTemplates\/\{templateId\}/);

  const storageRules = fs.readFileSync(path.resolve(process.cwd(), 'storage.rules'), 'utf-8');
  assert.match(storageRules, /match \/workspaces\/\{workspaceId\}\/resources\/\{fileId\}\/\{fileName\}/);
  assert.match(storageRules, /authorizedAdminUid\(\)/);
  assert.match(storageRules, /26214400/);
});

test('firebase-blueprint.json e firestore.rules declaram as coleções da Etapa 6 (customReports e analyticsSettings)', () => {
  const blueprintRaw = fs.readFileSync(
    path.resolve(process.cwd(), 'firebase-blueprint.json'),
    'utf-8'
  );
  const blueprint = JSON.parse(blueprintRaw) as {
    firestore?: Record<string, unknown>;
    entities?: Record<string, unknown>;
  };

  const firestorePaths = Object.keys(blueprint.firestore || {});
  const etapa6Paths = [
    '/workspaces/{workspaceId}/customReports/{reportId}',
    '/workspaces/{workspaceId}/analyticsSettings/{settingId}',
  ];

  for (const reqPath of etapa6Paths) {
    assert.ok(
      firestorePaths.includes(reqPath),
      `Caminho da Etapa 6 ausente em firebase-blueprint.json: ${reqPath}`
    );
  }

  assert.ok(blueprint.entities?.SavedCustomReport);
  assert.ok(blueprint.entities?.AnalyticsPreferences);

  const realRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
  assert.match(realRules, /function isValidCustomReport\(/);
  assert.match(realRules, /function isValidAnalyticsPreferences\(/);
  assert.match(realRules, /match \/customReports\/\{reportId\}/);
  assert.match(realRules, /match \/analyticsSettings\/\{settingId\}/);
});

test('firebase-blueprint.json e firestore.rules declaram as 6 coleções da Etapa 7 com regras seguras', () => {
  const blueprintRaw = fs.readFileSync(
    path.resolve(process.cwd(), 'firebase-blueprint.json'),
    'utf-8'
  );
  const blueprint = JSON.parse(blueprintRaw) as {
    firestore?: Record<string, unknown>;
    entities?: Record<string, unknown>;
  };

  const firestorePaths = Object.keys(blueprint.firestore || {});
  const etapa7Paths = [
    '/workspaces/{workspaceId}/systemSettings/{settingId}',
    '/workspaces/{workspaceId}/notifications/{notificationId}',
    '/workspaces/{workspaceId}/automationSettings/{ruleId}',
    '/workspaces/{workspaceId}/automationLogs/{logId}',
    '/workspaces/{workspaceId}/aiConversations/{conversationId}',
    '/workspaces/{workspaceId}/systemLogs/{logId}',
  ];

  for (const reqPath of etapa7Paths) {
    assert.ok(
      firestorePaths.includes(reqPath),
      `Caminho da Etapa 7 ausente em firebase-blueprint.json: ${reqPath}`
    );
  }

  assert.ok(blueprint.entities?.SystemSettings);
  assert.ok(blueprint.entities?.SystemNotification);
  assert.ok(blueprint.entities?.AutomationRuleSetting);
  assert.ok(blueprint.entities?.AutomationExecutionLog);
  assert.ok(blueprint.entities?.AiConversation);
  assert.ok(blueprint.entities?.SystemLogEntry);

  const realRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
  assert.match(realRules, /function isValidSystemSettings\(/);
  assert.match(realRules, /function isValidSystemNotification\(/);
  assert.match(realRules, /function isValidAutomationRule\(/);
  assert.match(realRules, /function isValidAutomationLog\(/);
  assert.match(realRules, /function isValidAiConversation\(/);
  assert.match(realRules, /function isValidSystemLog\(/);
  assert.match(realRules, /match \/systemSettings\/\{settingId\}/);
  assert.match(realRules, /match \/notifications\/\{notificationId\}/);
  assert.match(realRules, /match \/automationSettings\/\{ruleId\}/);
  assert.match(realRules, /match \/automationLogs\/\{logId\}/);
  assert.match(realRules, /match \/aiConversations\/\{conversationId\}/);
  assert.match(realRules, /match \/systemLogs\/\{logId\}/);
});



