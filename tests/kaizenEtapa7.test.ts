import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { createApiRouter } from '../src/api/routes';
import { Lead, NicheCampaign } from '../src/types/crm';
import {
  AgendaEvent,
  Client,
  Project,
  ProposalContract,
  Task,
} from '../src/types/kaizen';
import {
  FinancialCategory,
  FinancialEntry,
  FinancialRecurrence,
  FinancialSettings,
  FinancialTransaction,
} from '../src/types/finance';
import {
  buildAssistantContextSummary,
  buildDefaultAutomationRules,
  buildDefaultSystemSettings,
  checkSystemIntegrationsStatus,
  computeSmartAiSuggestions,
  createSystemLogEntry,
  evaluateWorkspaceNotifications,
  getIssuerBrandingFromSettings,
  mergeAutomationRulesWithDefaults,
  normalizeSystemSettings,
  prepareConfirmedAssistantAction,
  runAutomationRules,
  sanitizeSensitiveText,
} from '../src/services/system';
import {
  parseAndValidateBackup,
  prepareBackupRestorePayload,
  serializeCompleteBackupJson,
} from '../src/services/backupService';

const TODAY = '2026-11-18';
const NOW_ISO = '2026-11-18T12:00:00.000Z';

const FIN_SETTINGS: FinancialSettings = {
  id: 'default',
  companyName: 'Agência Kaizen',
  currency: 'BRL',
  dateFormat: 'DD/MM/YYYY',
  timezone: 'America/Maceio',
  openingBalanceCents: 100000,
  openingBalanceDate: '2026-11-01',
  openingBalanceDescription: 'Saldo inicial',
  openingBalanceHistory: [],
  paymentMethods: [{ id: 'pix', label: 'Pix', active: true }],
  alertDaysAhead: 5,
  defaultDueDay: 10,
  updatedAt: NOW_ISO,
};

const FIN_CATEGORIES: FinancialCategory[] = [
  {
    id: 'cat-rec',
    name: 'Mensalidade',
    kind: 'receita',
    active: true,
    isDefault: true,
    createdAt: NOW_ISO,
  },
  {
    id: 'cat-desp',
    name: 'Ferramentas',
    kind: 'despesa',
    active: true,
    isDefault: true,
    createdAt: NOW_ISO,
  },
];

function buildTestWorkspace() {
  const niches: NicheCampaign[] = [
    {
      id: 'niche-1',
      name: 'Clínicas Médicas',
      segment: 'Saúde',
      city: 'Maceió',
      emoji: '🏥',
      targetMrr: 5000,
      scripts: {},
      createdAt: '2026-11-01T10:00:00.000Z',
    },
  ];

  const leads: Lead[] = [
    {
      id: 'lead-stale-1',
      nicheId: 'niche-1',
      companyName: 'Clínica Alpha',
      contactName: 'Dra. Marina',
      phone: '5582999990001',
      displayPhone: '+55 (82) 99999-0001',
      city: 'Maceió',
      stage: 'follow_up_1',
      scriptUsed: 'script1',
      notes: [],
      lastContactDate: '2026-11-10T10:00:00.000Z',
      callbackDate: '2026-11-17',
      callbackTime: '14:00',
      callbackStatus: 'pendente',
      createdAt: '2026-11-08T10:00:00.000Z',
    },
  ];

  const clients: Client[] = [
    {
      id: 'cli-1',
      companyName: 'Studio Beta',
      contactName: 'Carlos',
      status: 'ativo',
      phone: '5582999990002',
      displayPhone: '+55 (82) 99999-0002',
      segment: 'Estética',
      city: 'Maceió',
      monthlyMrr: 1500,
      timeline: [],
      createdAt: '2026-11-01T10:00:00.000Z',
    },
  ];

  const proposals: ProposalContract[] = [
    {
      id: 'prop-1',
      code: 'KZ-P-2026-001',
      kind: 'proposta',
      title: 'Site + SEO Local',
      status: 'enviada',
      clientId: 'cli-1',
      recipientCompany: 'Studio Beta',
      issuerName: 'Agência Kaizen — Ian',
      items: [],
      setupTotal: 3000,
      monthlyMrr: 900,
      sentAt: '2026-11-10T10:00:00.000Z',
      history: [],
      createdAt: '2026-11-10T10:00:00.000Z',
    },
  ];

  const projects: Project[] = [
    {
      id: 'proj-1',
      name: 'Site Institucional Studio Beta',
      clientId: 'cli-1',
      serviceType: 'Site Institucional',
      templateId: 'kaizen_start',
      status: 'em_andamento',
      ownerName: 'Ian',
      startDate: '2026-11-05',
      dueDate: '2026-11-17', // vencido
      documents: [],
      history: [],
      createdAt: '2026-11-05T10:00:00.000Z',
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-1',
      title: 'Publicar landing page Studio Beta',
      projectId: 'proj-1',
      clientId: 'cli-1',
      dueDate: '2026-11-16', // atrasada
      priority: 'alta',
      status: 'em_andamento',
      checklist: [],
      createdAt: '2026-11-10T10:00:00.000Z',
    },
  ];

  const agendaEvents: AgendaEvent[] = [
    {
      id: 'evt-1',
      title: 'Alinhamento quinzenal Studio Beta',
      type: 'reuniao_cliente',
      status: 'agendado',
      date: TODAY,
      startTime: '15:00',
      createdAt: NOW_ISO,
    },
  ];

  const financialEntries: FinancialEntry[] = [
    {
      id: 'fin-rec-paid',
      kind: 'receita',
      description: 'Mensalidade paga Studio Beta',
      clientId: 'cli-1',
      categoryId: 'cat-rec',
      amountCents: 150000,
      settledCents: 150000,
      competenceDate: '2026-11-05',
      dueDate: '2026-11-05',
      lastSettledDate: '2026-11-05',
      paymentMethod: 'pix',
      status: 'recebida',
      createdAt: '2026-11-01T10:00:00.000Z',
    },
    {
      id: 'fin-rec-overdue',
      kind: 'receita',
      description: 'Setup em atraso Alpha',
      categoryId: 'cat-rec',
      amountCents: 200000,
      settledCents: 0,
      competenceDate: '2026-11-10',
      dueDate: '2026-11-15',
      paymentMethod: 'pix',
      status: 'pendente',
      createdAt: '2026-11-01T10:00:00.000Z',
    },
    {
      id: 'fin-desp-due',
      kind: 'despesa',
      description: 'Hospedagem Cloud',
      categoryId: 'cat-desp',
      amountCents: 25000,
      settledCents: 0,
      competenceDate: '2026-11-18',
      dueDate: '2026-11-20',
      paymentMethod: 'pix',
      status: 'pendente',
      createdAt: '2026-11-01T10:00:00.000Z',
    },
  ];

  const financialTransactions: FinancialTransaction[] = [
    {
      id: 'ftx-1',
      entryId: 'fin-rec-paid',
      entryKind: 'receita',
      kind: 'recebimento',
      amountCents: 150000,
      date: '2026-11-05',
      paymentMethod: 'pix',
      createdBy: 'Ian',
      createdAt: '2026-11-05T14:00:00.000Z',
    },
  ];

  const financialRecurrences: FinancialRecurrence[] = [
    {
      id: 'frec-1',
      name: 'Contrato Recorrente Beta',
      kind: 'receita',
      amountCents: 150000,
      categoryId: 'cat-rec',
      clientId: 'cli-1',
      paymentMethod: 'pix',
      frequency: 'mensal',
      startDate: '2026-10-20',
      nextOccurrenceDate: '2026-11-20',
      status: 'ativa',
      createdAt: '2026-10-01T10:00:00.000Z',
    },
  ];

  return {
    niches,
    leads,
    clients,
    proposals,
    projects,
    tasks,
    agendaEvents,
    financialEntries,
    financialTransactions,
    financialRecurrences,
  };
}

test('SystemSettings preserva Premium Dark, trava padrões regionais e propaga branding do emissor', () => {
  const defaults = buildDefaultSystemSettings('Ian Gabriel');
  assert.equal(defaults.visualIdentity.appearanceMode, 'premium_dark');
  assert.equal(defaults.regional.currency, 'BRL');
  assert.equal(defaults.regional.dateFormat, 'DD/MM/YYYY');
  assert.equal(defaults.regional.timezone, 'America/Maceio');

  const normalized = normalizeSystemSettings({
    adminProfile: {
      displayName: 'Ian',
      contactEmail: 'contato@kaizen.ag',
      agencyName: 'Kaizen Digital Studio',
      commercialPhone: '82999998888',
      issuerDocument: '12.345.678/0001-99',
      websiteUrl: 'https://kaizen.ag',
    },
    visualIdentity: {
      brandName: 'Kaizen',
      primaryColor: 'javascript:alert(1)',
      secondaryColor: '#112233',
      appearanceMode: 'light_invalido' as unknown as 'premium_dark',
    },
    regional: {
      currency: 'USD' as unknown as 'BRL',
      dateFormat: 'MM/DD/YYYY' as unknown as 'DD/MM/YYYY',
      timezone: 'UTC' as unknown as 'America/Maceio',
      language: 'en-US' as unknown as 'pt-BR',
    },
  });

  assert.equal(normalized.visualIdentity.appearanceMode, 'premium_dark');
  assert.equal(normalized.visualIdentity.primaryColor, '#C6A15B');
  assert.equal(normalized.visualIdentity.secondaryColor, '#112233');
  assert.equal(normalized.regional.currency, 'BRL');
  assert.equal(normalized.regional.dateFormat, 'DD/MM/YYYY');
  assert.equal(normalized.regional.timezone, 'America/Maceio');

  const branding = getIssuerBrandingFromSettings(normalized);
  assert.equal(branding.agencyName, 'Kaizen Digital Studio');
  assert.equal(branding.issuerName, 'Kaizen Digital Studio — Ian');
  assert.equal(branding.issuerDocument, '12.345.678/0001-99');
  assert.equal(branding.contactEmail, 'contato@kaizen.ag');
});

test('logSanitizerService redige tokens, chaves Google AIza, sk- e credenciais sem truncar contexto útil', () => {
  const dirty =
    'Falha ao chamar endpoint com Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def, chave AIzaSyDummyKey1234567890, sk-proj-secret123456 e api_key=segredo123';
  const cleaned = sanitizeSensitiveText(dirty);
  assert.equal(cleaned.includes('eyJhbGciOi'), false);
  assert.equal(cleaned.includes('AIzaSyDummyKey'), false);
  assert.equal(cleaned.includes('sk-proj-secret'), false);
  assert.equal(cleaned.includes('segredo123'), false);
  assert.ok(cleaned.includes('[REDIGIDO]'));
  assert.ok(cleaned.includes('[CHAVE_GOOGLE_REDIGIDA]'));
  assert.ok(cleaned.includes('[CHAVE_SECRETA_REDIGIDA]'));

  const entry = createSystemLogEntry({
    level: 'error',
    source: 'gemini_ia',
    title: 'Erro controlado AIzaSyDummyKey1234567890',
    message: 'Falha com token=abc987xyz',
    createdAt: NOW_ISO,
  });
  assert.match(entry.id, /^syslog-\d+-[a-z0-9]+$/);
  assert.equal(entry.title.includes('AIza'), false);
  assert.equal(entry.message.includes('abc987xyz'), false);
});

test('checkSystemIntegrationsStatus reporta status honestos para Gemini ausente, Google Calendar OAuth e SMTP', () => {
  const items = checkSystemIntegrationsStatus({
    authUserEmail: 'ian@kaizen.ag',
    authUid: 'uid-admin-1',
    isCloudSynced: true,
    syncStatus: 'synced',
    geminiProbe: { reachable: true, configured: false },
    checkedAt: NOW_ISO,
  });

  const byId = new Map(items.map((i) => [i.id, i]));
  assert.equal(byId.get('firebase_auth')?.status, 'conectado');
  assert.equal(byId.get('cloud_firestore')?.status, 'conectado');
  assert.equal(byId.get('gemini_ai')?.status, 'nao_configurado');
  assert.equal(byId.get('google_calendar')?.status, 'nao_configurado');
  assert.equal(byId.get('email_smtp')?.status, 'nao_configurado');
});

test('evaluateWorkspaceNotifications gera alertas reais de todos os módulos, respeita preferências e deduplica sem mutar origem', () => {
  const ws = buildTestWorkspace();
  const leadsBefore = JSON.stringify(ws.leads);
  const finBefore = JSON.stringify(ws.financialEntries);

  const firstRun = evaluateWorkspaceNotifications({
    leads: ws.leads,
    proposals: ws.proposals,
    projects: ws.projects,
    tasks: ws.tasks,
    agendaEvents: ws.agendaEvents,
    financialEntries: ws.financialEntries,
    existingNotifications: [],
    settings: buildDefaultSystemSettings('Ian'),
    todayStr: TODAY,
    nowIso: NOW_ISO,
  });

  assert.ok(firstRun.notifications.length >= 6);
  assert.equal(firstRun.changedNotifications.length, firstRun.notifications.length);
  assert.ok(firstRun.notifications.some((n) => n.category === 'agenda' && n.entityType === 'lead'));
  assert.ok(firstRun.notifications.some((n) => n.category === 'comercial' && n.entityType === 'proposal'));
  assert.ok(firstRun.notifications.some((n) => n.category === 'operacional' && n.entityType === 'task'));
  assert.ok(firstRun.notifications.some((n) => n.category === 'operacional' && n.entityType === 'project'));
  assert.ok(firstRun.notifications.some((n) => n.category === 'financeiro' && n.entityId === 'fin-rec-overdue'));

  // Segunda execução com mesmas notificações existentes não duplica nem altera nada
  const secondRun = evaluateWorkspaceNotifications({
    leads: ws.leads,
    proposals: ws.proposals,
    projects: ws.projects,
    tasks: ws.tasks,
    agendaEvents: ws.agendaEvents,
    financialEntries: ws.financialEntries,
    existingNotifications: firstRun.notifications,
    settings: buildDefaultSystemSettings('Ian'),
    todayStr: TODAY,
    nowIso: NOW_ISO,
  });

  assert.equal(secondRun.changedNotifications.length, 0);
  assert.equal(secondRun.notifications.length, firstRun.notifications.length);

  // Desabilitar categoria financeiro oculta alertas financeiros
  const noFinSettings = normalizeSystemSettings({
    preferences: {
      enableNotifications: true,
      notifyComercial: true,
      notifyOperacional: true,
      notifyFinanceiro: false,
      notifyAgenda: true,
      autoRunAutomationsOnOpen: true,
      showAssistantSuggestions: true,
    },
  });
  const filteredRun = evaluateWorkspaceNotifications({
    leads: ws.leads,
    proposals: ws.proposals,
    projects: ws.projects,
    tasks: ws.tasks,
    agendaEvents: ws.agendaEvents,
    financialEntries: ws.financialEntries,
    existingNotifications: firstRun.notifications,
    settings: noFinSettings,
    todayStr: TODAY,
    nowIso: NOW_ISO,
  });
  assert.equal(filteredRun.notifications.some((n) => n.category === 'financeiro'), false);

  // Registros originais permanecem intactos
  assert.equal(JSON.stringify(ws.leads), leadsBefore);
  assert.equal(JSON.stringify(ws.financialEntries), finBefore);
});

test('automationEngineService define 11 regras em 3 categorias e executa sem efetuar baixas ou exclusões', () => {
  const ws = buildTestWorkspace();
  const finBefore = JSON.stringify(ws.financialEntries);
  const leadsBefore = JSON.stringify(ws.leads);

  const rules = buildDefaultAutomationRules(NOW_ISO);
  assert.equal(rules.length, 11);
  assert.equal(rules.filter((r) => r.category === 'comercial').length, 4);
  assert.equal(rules.filter((r) => r.category === 'operacional').length, 4);
  assert.equal(rules.filter((r) => r.category === 'financeiro').length, 3);

  const merged = mergeAutomationRulesWithDefaults([
    { ...rules[0], enabled: false },
  ]);
  assert.equal(merged.length, 11);
  assert.equal(merged[0].enabled, false);

  const result = runAutomationRules({
    rules,
    data: {
      leads: ws.leads,
      proposals: ws.proposals,
      projects: ws.projects,
      tasks: ws.tasks,
      agendaEvents: ws.agendaEvents,
      financialEntries: ws.financialEntries,
      financialRecurrences: ws.financialRecurrences,
      financialAlertDaysAhead: 5,
    },
    triggerType: 'manual',
    todayStr: TODAY,
    nowIso: NOW_ISO,
  });

  assert.equal(result.newLogs.length, 11);
  const overdueRecLog = result.newLogs.find((l) => l.ruleId === 'auto-fin-overdue-receivables');
  assert.ok(overdueRecLog);
  assert.equal(overdueRecLog.findingsCount, 1);
  assert.equal(overdueRecLog.status, 'sucesso');
  assert.ok(overdueRecLog.summary.includes('2.000,00'));

  const whatsappDraftLog = result.newLogs.find((l) => l.ruleId === 'auto-comm-whatsapp-draft');
  assert.ok(whatsappDraftLog);
  assert.equal(whatsappDraftLog.findingsCount, 1);
  assert.ok(whatsappDraftLog.details?.includes('Clínica Alpha'));

  assert.equal(JSON.stringify(ws.financialEntries), finBefore);
  assert.equal(JSON.stringify(ws.leads), leadsBefore);
});

test('aiContextService separa realizado vs em aberto e gera sugestões determinísticas; ações confirmadas rejeitam tipos inseguros', () => {
  const ws = buildTestWorkspace();
  const summary = buildAssistantContextSummary({
    ...ws,
    socialChannels: [],
    socialPosts: [],
    financialCategories: FIN_CATEGORIES,
    financialSettings: FIN_SETTINGS,
    financialAuditLogs: [],
    resourceFiles: [],
    todayStr: TODAY,
  });

  assert.equal(summary.commercial.totalLeads, 1);
  assert.equal(summary.clients.activeClients, 1);
  assert.equal(summary.operations.overdueTasksCount, 1);
  assert.equal(summary.operations.overdueProjectsCount, 1);
  assert.ok(summary.finance.receitaRecebidaNoMes.includes('1.500,00'));
  assert.ok(summary.finance.receitaPrevistaEmAberto.includes('2.000,00'));
  assert.ok(summary.finance.aReceberEmAtraso.includes('2.000,00'));
  assert.ok(summary.finance.despesaPrevistaEmAberto.includes('250,00'));
  assert.ok(summary.dataLimitations.length >= 2);

  const suggestions = computeSmartAiSuggestions({
    leads: ws.leads,
    proposals: ws.proposals,
    projects: ws.projects,
    tasks: ws.tasks,
    financialEntries: ws.financialEntries,
    todayStr: TODAY,
  });
  assert.ok(suggestions.some((s) => s.id === 'sug-overdue-tasks'));
  assert.ok(suggestions.some((s) => s.id === 'sug-overdue-rec'));
  assert.ok(suggestions.some((s) => s.id === 'sug-open-proposals'));

  // Ação segura: criar tarefa
  const taskAction = prepareConfirmedAssistantAction(
    {
      id: 'act-1',
      type: 'create_task',
      title: 'Cobrar Setup Alpha',
      description: 'Enviar revisão amigável',
      status: 'pending',
      taskTitle: 'Cobrar Setup Alpha',
      taskPriority: 'alta',
      taskDueDate: TODAY,
    },
    NOW_ISO
  );
  assert.equal(taskAction.kind, 'create_task');
  if (taskAction.kind === 'create_task') {
    assert.equal(taskAction.task.status, 'a_fazer');
    assert.equal(taskAction.task.priority, 'alta');
  }

  // Ação segura: rascunho WhatsApp gera URL manual wa.me
  const waAction = prepareConfirmedAssistantAction({
    id: 'act-2',
    type: 'whatsapp_draft',
    title: 'Follow-up Alpha',
    description: 'Follow-up',
    status: 'pending',
    targetName: 'Clínica Alpha',
    targetPhone: '5582999990001',
    draftText: 'Olá, Dra. Marina!',
  });
  assert.equal(waAction.kind, 'whatsapp_draft');
  if (waAction.kind === 'whatsapp_draft') {
    assert.ok(waAction.whatsappUrl?.startsWith('https://wa.me/5582999990001'));
  }

  // Política de segurança: tipos fora da lista permitida devem lançar erro
  assert.throws(() =>
    prepareConfirmedAssistantAction({
      id: 'act-bad',
      type: 'delete_all_records' as unknown as 'create_task',
      title: 'Proibido',
      description: 'Proibido',
      status: 'pending',
    })
  );
});

test('Rotas /api/gemini/status e /api/gemini/assistant-chat respeitam auth fail-closed e erro honesto 503 sem GEMINI_API_KEY', async () => {
  const prevUid = process.env.AUTHORIZED_ADMIN_UID;
  const prevProject = process.env.FIREBASE_PROJECT_ID;
  const prevGemini = process.env.GEMINI_API_KEY;

  process.env.AUTHORIZED_ADMIN_UID = 'uid-admin-1';
  process.env.FIREBASE_PROJECT_ID = 'gen-lang-client-test';
  delete process.env.GEMINI_API_KEY;

  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(
    createApiRouter({
      authorizedAdminUid: 'uid-admin-1',
      projectId: 'gen-lang-client-test',
      verifyToken: async (token: string) => {
        if (token === 'admin-ok') return { uid: 'uid-admin-1', email: 'ian@kaizen.ag' };
        throw new Error('INVALID_TOKEN');
      },
    })
  );

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Sem autenticação -> 401
    const unauthStatus = await fetch(`${baseUrl}/api/gemini/status`);
    assert.equal(unauthStatus.status, 401);

    const unauthChat = await fetch(`${baseUrl}/api/gemini/assistant-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Resumo do dia' }),
    });
    assert.equal(unauthChat.status, 401);

    // Autenticado sem GEMINI_API_KEY -> status configured: false e chat 503 GEMINI_NOT_CONFIGURED
    const okStatus = await fetch(`${baseUrl}/api/gemini/status`, {
      headers: { Authorization: 'Bearer admin-ok' },
    });
    assert.equal(okStatus.status, 200);
    const statusJson = (await okStatus.json()) as { configured: boolean; model: string };
    assert.equal(statusJson.configured, false);
    assert.equal(typeof statusJson.model, 'string');

    const missingKeyChat = await fetch(`${baseUrl}/api/gemini/assistant-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-ok',
      },
      body: JSON.stringify({ message: 'Resumo do dia' }),
    });
    assert.equal(missingKeyChat.status, 503);
    const chatJson = (await missingKeyChat.json()) as { code?: string };
    assert.equal(chatJson.code, 'GEMINI_NOT_CONFIGURED');
  } finally {
    if (prevUid !== undefined) process.env.AUTHORIZED_ADMIN_UID = prevUid;
    else delete process.env.AUTHORIZED_ADMIN_UID;
    if (prevProject !== undefined) process.env.FIREBASE_PROJECT_ID = prevProject;
    else delete process.env.FIREBASE_PROJECT_ID;
    if (prevGemini !== undefined) process.env.GEMINI_API_KEY = prevGemini;
    else delete process.env.GEMINI_API_KEY;
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
});

test('Backup v3.0 preserva e restaura systemSettings, automationSettings e notifications com checksum íntegro', () => {
  const ws = buildTestWorkspace();
  const sysSettings = buildDefaultSystemSettings('Ian');
  const autoRules = buildDefaultAutomationRules(NOW_ISO);
  const { notifications } = evaluateWorkspaceNotifications({
    leads: ws.leads,
    proposals: ws.proposals,
    projects: ws.projects,
    tasks: ws.tasks,
    agendaEvents: ws.agendaEvents,
    financialEntries: ws.financialEntries,
    existingNotifications: [],
    settings: sysSettings,
    todayStr: TODAY,
    nowIso: NOW_ISO,
  });

  const json = serializeCompleteBackupJson({
    niches: ws.niches,
    leads: ws.leads,
    importedSheets: [],
    clients: ws.clients,
    proposals: ws.proposals,
    projects: ws.projects,
    tasks: ws.tasks,
    agendaEvents: ws.agendaEvents,
    socialChannels: [],
    socialPosts: [],
    financialEntries: ws.financialEntries,
    financialTransactions: ws.financialTransactions,
    financialCategories: FIN_CATEGORIES,
    financialRecurrences: ws.financialRecurrences,
    financialSettings: FIN_SETTINGS,
    financialAuditLogs: [],
    resourceFiles: [],
    resourceFolders: [],
    resourceCategories: [],
    commercialScripts: [],
    modelTemplates: [],
    savedReports: [],
    systemSettings: sysSettings,
    notifications,
    automationSettings: autoRules,
    userName: 'Ian',
  });

  const parsed = parseAndValidateBackup(json);
  assert.equal(parsed.ok, true);
  assert.ok(parsed.data);
  assert.equal(parsed.data.systemSettings?.adminProfile.agencyName, 'Agência Kaizen');
  assert.equal(parsed.data.automationSettings?.length, 11);
  assert.ok((parsed.data.notifications?.length || 0) >= 6);

  const restored = prepareBackupRestorePayload(
    parsed.data,
    {
      niches: [],
      leads: [],
      importedSheets: [],
    },
    'skip_phone_duplicates'
  );

  assert.ok(restored.systemSettingsToWrite);
  assert.equal(restored.automationSettingsToWrite.length, 11);
  assert.equal(restored.notificationsToWrite.length, notifications.length);
});
