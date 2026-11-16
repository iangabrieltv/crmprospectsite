import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadStoredNiches,
  loadStoredLeads,
} from '../src/utils/storage';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test('loadStoredNiches preserva nichos reais com palavras antes bloqueadas (advogados, carros, clínicas, estética)', () => {
  const mem = createMemoryStorage();
  (globalThis as unknown as { localStorage: ReturnType<typeof createMemoryStorage> }).localStorage = mem;

  const customNiches = [
    {
      id: 'niche-advogados-sp',
      name: 'Advogados Trabalhistas SP',
      segment: 'Advocacia',
      city: 'São Paulo - SP',
      emoji: '⚖️',
      targetMrr: 8000,
      createdAt: '2026-01-10T10:00:00.000Z',
      scripts: {
        script_custom_1: {
          id: 'script_custom_1',
          title: 'Abordagem Personalizada Kaizen Visual',
          subtitle: 'Subtítulo',
          description: 'Desc',
          structure: { hook: 'h', problem: 'p', solution: 's', cta: 'c' },
          template: 'Olá {NomeContato}, aqui é da Kaizen Visual, tem dois minutinhos?',
          followUp1: 'FU1',
          followUp2: 'FU2',
          objections: [],
        },
        script_custom_2: {
          id: 'script_custom_2',
          title: 'Ligação Direta',
          subtitle: 'Sub',
          description: 'Desc',
          structure: { hook: 'h', problem: 'p', solution: 's', cta: 'c' },
          template: 'Template 2',
          followUp1: 'FU1',
          followUp2: 'FU2',
          objections: [],
        },
        script_custom_3: {
          id: 'script_custom_3',
          title: 'Terceiro Roteiro Extra',
          subtitle: 'Sub',
          description: 'Desc',
          structure: { hook: 'h', problem: 'p', solution: 's', cta: 'c' },
          template: 'Template 3',
          followUp1: 'FU1',
          followUp2: 'FU2',
          objections: [],
        },
      },
    },
    {
      id: 'estetica-automotiva-2026',
      name: 'Estética Automotiva & Carros Premium',
      segment: 'Automotivo',
      city: 'Curitiba - PR',
      emoji: '🚗',
      targetMrr: 6000,
      createdAt: '2026-02-01T10:00:00.000Z',
      scripts: {},
    },
  ];

  mem.setItem('prospectflow_crm_niches_clean_v2', JSON.stringify(customNiches));

  const loaded = loadStoredNiches();
  assert.equal(loaded.length, 2, 'Nenhum nicho comercial pode ser filtrado por substring');
  assert.equal(loaded[0].id, 'niche-advogados-sp');
  assert.equal(loaded[1].id, 'estetica-automotiva-2026');
  assert.equal(
    Object.keys(loaded[0].scripts).length,
    3,
    'Scripts personalizados e quantidade customizada devem ser preservados intactos'
  );
  assert.equal(
    loaded[0].scripts.script_custom_1.template,
    'Olá {NomeContato}, aqui é da Kaizen Visual, tem dois minutinhos?',
    'Templates personalizados não devem ser sobrescritos'
  );
});

test('loadStoredLeads preserva todos os IDs legados sem remover por prefixo', () => {
  const mem = createMemoryStorage();
  (globalThis as unknown as { localStorage: ReturnType<typeof createMemoryStorage> }).localStorage = mem;

  const legacyLeads = [
    {
      id: 'lead-sp-101',
      nicheId: 'niche-advogados-sp',
      companyName: 'Escritório Silva',
      phone: '5511999991111',
      displayPhone: '+55 (11) 99999-1111',
      city: 'São Paulo - SP',
      stage: 'nao_iniciada',
      scriptUsed: 'script_mensagem',
      notes: [],
      createdAt: '2026-01-12T10:00:00.000Z',
    },
    {
      id: 'lead-frila-demo',
      nicheId: 'estetica-automotiva-2026',
      companyName: 'Auto Brilho',
      phone: '5541988882222',
      displayPhone: '+55 (41) 98888-2222',
      city: 'Curitiba - PR',
      stage: 'interessado',
      scriptUsed: 'script_ligacao',
      notes: [],
      createdAt: '2026-02-02T10:00:00.000Z',
    },
  ];

  mem.setItem('prospectflow_crm_leads_clean_v2', JSON.stringify(legacyLeads));

  const loaded = loadStoredLeads();
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].id, 'lead-sp-101');
  assert.equal(loaded[0].stage, 'leads_sem_contato', 'Normalização de leitura retrocompatível');
  assert.equal(loaded[1].id, 'lead-frila-demo');
  assert.equal(loaded[1].stage, 'reuniao_marcada');
});
