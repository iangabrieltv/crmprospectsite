import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NAVIGATION_GROUPS,
  NAVIGATION_ITEMS,
  getRouteMeta,
} from '../src/config/navigation';
import {
  computeDashboardMetrics,
  toLocalDateString,
} from '../src/utils/dashboardMetrics';
import { Lead } from '../src/types/crm';

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: overrides.id || 'lead-test-1',
    nicheId: overrides.nicheId || 'niche-1',
    companyName: overrides.companyName || 'Empresa Teste',
    phone: overrides.phone || '5511999990000',
    displayPhone: overrides.displayPhone || '+55 (11) 99999-0000',
    city: overrides.city || 'São Paulo',
    stage: overrides.stage || 'leads_sem_contato',
    scriptUsed: overrides.scriptUsed || 'script1',
    notes: overrides.notes || [],
    createdAt: overrides.createdAt || '2026-11-16T08:00:00.000Z',
    ...overrides,
  };
}

test('NAVIGATION_GROUPS define exatamente os 6 grupos estruturais do Kaizen', () => {
  assert.equal(NAVIGATION_GROUPS.length, 6);
  assert.deepEqual(
    NAVIGATION_GROUPS.map((g) => g.label),
    ['GERAL', 'COMERCIAL', 'OPERAÇÃO', 'RECURSOS', 'GESTÃO', 'SISTEMA']
  );
});

test('NAVIGATION_ITEMS define todos os 18 módulos implementados até a Etapa 7', () => {
  assert.equal(NAVIGATION_ITEMS.length, 18);

  const implementedIds = NAVIGATION_ITEMS.filter((i) => i.implemented).map((i) => i.id);
  assert.deepEqual(implementedIds, [
    'dashboard',
    'kanban',
    'clients',
    'proposals',
    'projects',
    'tasks',
    'agenda',
    'social',
    'documents',
    'scripts',
    'templates',
    'finance',
    'global',
    'productivity',
    'settings',
    'ai_assistant',
    'automations',
    'notifications',
  ]);

  const unimplemented = NAVIGATION_ITEMS.filter((i) => !i.implemented);
  assert.equal(unimplemented.length, 0);
});

test('getRouteMeta gera título, grupo e breadcrumbs corretos para CRM, Dashboard, Financeiro e módulos futuros', () => {
  const dash = getRouteMeta('dashboard');
  assert.equal(dash.title, 'Dashboard');
  assert.equal(dash.groupLabel, 'GERAL');
  assert.equal(dash.implemented, true);

  const listMeta = getRouteMeta('leads_list');
  assert.equal(listMeta.title, 'CRM — Lista de Leads');
  assert.equal(listMeta.implemented, true);
  assert.deepEqual(
    listMeta.breadcrumbs.map((b) => b.label),
    ['Kaizen', 'Comercial', 'CRM', 'Lista de Leads']
  );

  const importerMeta = getRouteMeta('importer');
  assert.equal(importerMeta.title, 'CRM — Importador de Planilhas');
  assert.equal(importerMeta.implemented, true);

  const clientsMeta = getRouteMeta('clients');
  assert.equal(clientsMeta.title, 'Clientes');
  assert.equal(clientsMeta.implemented, true);
  assert.equal(clientsMeta.groupLabel, 'COMERCIAL');

  const projectsMeta = getRouteMeta('projects');
  assert.equal(projectsMeta.title, 'Projetos');
  assert.equal(projectsMeta.implemented, true);
  assert.equal(projectsMeta.groupLabel, 'OPERAÇÃO');

  const documentsMeta = getRouteMeta('documents');
  assert.equal(documentsMeta.title, 'Materiais e Documentos');
  assert.equal(documentsMeta.implemented, true);
  assert.equal(documentsMeta.groupLabel, 'RECURSOS');

  const templatesMeta = getRouteMeta('templates');
  assert.equal(templatesMeta.title, 'Biblioteca de Modelos');
  assert.equal(templatesMeta.implemented, true);
  assert.equal(templatesMeta.groupLabel, 'RECURSOS');

  const financeMeta = getRouteMeta('finance');
  assert.equal(financeMeta.title, 'Financeiro');
  assert.equal(financeMeta.implemented, true);
  assert.equal(financeMeta.groupLabel, 'GESTÃO');
});

test('computeDashboardMetrics calcula indicadores reais mantendo compatibilidade sem Clientes/Financeiro informados e ativando Financeiro', () => {
  const refDate = new Date(2026, 10, 16, 14, 0, 0); // 2026-11-16 local
  const todayStr = toLocalDateString(refDate);
  const oldDateIso = new Date(Math.min(refDate.getTime(), Date.now()) - 72 * 60 * 60 * 1000).toISOString();
  const todayIso = new Date(2026, 10, 16, 10, 30, 0).toISOString();

  const leads: Lead[] = [
    // 1. Sem contato hoje
    makeLead({ id: 'l1', stage: 'leads_sem_contato', createdAt: todayIso }),
    // 2. Primeiro contato hoje
    makeLead({ id: 'l2', stage: 'primeiro_contato', lastContactDate: todayIso }),
    // 3. Follow-up 1 antigo (+48h inativo) + callback atrasado
    makeLead({
      id: 'l3',
      companyName: 'Clínica Atrasada',
      stage: 'follow_up_1',
      lastContactDate: oldDateIso,
      callbackDate: '2026-11-14',
      callbackTime: '15:00',
      callbackStatus: 'pendente',
    }),
    // 4. Follow-up 2 com callback hoje e inativo > 48h (sem callback duplicado)
    makeLead({
      id: 'l4',
      companyName: 'Studio Hoje',
      stage: 'follow_up_2',
      lastContactDate: oldDateIso,
      callbackDate: todayStr,
      callbackTime: '16:30',
      callbackStatus: 'pendente',
    }),
    // 5. Reunião marcada futura
    makeLead({
      id: 'l5',
      companyName: 'Odonto Reunião 2',
      stage: 'reuniao_marcada',
      lastContactDate: todayIso,
      meetingDate: '2026-11-18',
      meetingTime: '14:00',
      meetingStatus: 'agendada',
    }),
    // 6. Reunião marcada hoje (deve vir antes na lista)
    makeLead({
      id: 'l6',
      companyName: 'Odonto Reunião 1',
      stage: 'reuniao_marcada',
      lastContactDate: oldDateIso,
      meetingDate: todayStr,
      meetingTime: '17:00',
      meetingStatus: 'remarcada',
    }),
    // 7. Reunião cancelada (não deve entrar em upcomingMeetings)
    makeLead({
      id: 'l7',
      companyName: 'Reunião Cancelada',
      stage: 'primeiro_contato',
      lastContactDate: oldDateIso,
      meetingDate: '2026-11-19',
      meetingTime: '11:00',
      meetingStatus: 'cancelada',
    }),
    // 8. Fechado com setup e MRR
    makeLead({
      id: 'l8',
      companyName: 'Cliente Fechado A',
      stage: 'fechado',
      lastContactDate: oldDateIso,
      creationValue: 2500,
      monthlyMrr: 450,
    }),
  ];

  const result = computeDashboardMetrics(leads, refDate);
  const { kpis, pendingActivities, upcomingMeetings } = result;

  assert.equal(kpis.contactedToday, 2); // l2 e l5
  assert.equal(kpis.totalContacted, 7); // l2..l8
  assert.equal(kpis.interestedLeads, 4); // l3, l4, l5, l6
  assert.equal(kpis.scheduledMeetings, 2); // l5, l6 (l7 cancelada e não está no estágio reuniao_marcada)
  assert.equal(kpis.closedDeals, 1); // l8
  assert.equal(kpis.activeClientsConfigured, false);
  assert.equal(kpis.activeClientsCount, null);
  assert.equal(kpis.financialModuleConfigured, true);
  assert.equal(kpis.monthlyRevenueMrr, 450);
  assert.equal(kpis.totalSetupRevenue, 2500);
  assert.equal(kpis.pendingFollowUps, 2); // l3 e l4

  // Ordenação de pendências: callback_overdue -> callback_today -> inactive_48h
  assert.equal(pendingActivities[0].kind, 'callback_overdue');
  assert.equal(pendingActivities[0].lead.id, 'l3');
  assert.equal(pendingActivities[1].kind, 'callback_today');
  assert.equal(pendingActivities[1].lead.id, 'l4');
  assert.ok(pendingActivities.some((p) => p.kind === 'inactive_48h'));

  // Reuniões ordenadas cronologicamente, excluindo cancelada
  assert.equal(upcomingMeetings.length, 2);
  assert.deepEqual(
    upcomingMeetings.map((m) => m.lead.id),
    ['l6', 'l5']
  );
  assert.equal(upcomingMeetings[0].isToday, true);
});
