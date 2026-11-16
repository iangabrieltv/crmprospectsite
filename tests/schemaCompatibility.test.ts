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
  const rawRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
  assert.equal(hasPendingUidPlaceholder(rawRules), true);

  const configured = applyAdminUidToRulesContent(rawRules, 'RealAdminUid987654');
  assert.equal(hasPendingUidPlaceholder(configured), false);
  assert.match(configured, /return 'RealAdminUid987654';/);
  assert.match(configured, /(?:authorizedAdminUid\(\)|uid)\s*!=\s*'REPLACE_WITH_YOUR_FIREBASE_UID'/);
});

