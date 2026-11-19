import test from 'node:test';
import assert from 'node:assert/strict';
import { Lead, NicheCampaign } from '../src/types/crm';
import { Client, Project, ProposalContract, Task } from '../src/types/kaizen';
import {
  FinancialCategory,
  FinancialEntry,
  FinancialSettings,
  FinancialTransaction,
} from '../src/types/finance';
import { SystemNotification } from '../src/types/system';
import {
  buildClientFromLead,
  findDuplicateClient,
  mergeClientWithProposalAcceptance,
} from '../src/services/clientService';
import {
  buildProposalFromSource,
  calculateProposalTotals,
  transitionProposalStatus,
} from '../src/services/proposalService';
import {
  calculateProjectProgress,
  createProjectWithTemplateTasks,
  transitionProjectStatus,
} from '../src/services/projectService';
import { transitionTaskStatus } from '../src/services/taskService';
import { buildIntegratedAgendaItems } from '../src/services/agendaService';
import {
  createFinancialEntryRecord,
  formatBrlFromCents,
  getEffectiveEntryStatus,
  getEntryPendingCents,
  KAIZEN_TIMEZONE,
  registerSettlement,
} from '../src/services/finance';
import { computeDashboardMetrics } from '../src/utils/dashboardMetrics';
import { computeExecutiveDashboardSnapshot } from '../src/services/analytics';
import { buildProposalPdfDocument } from '../src/services/pdfService';
import {
  clearMemoryBlobStoreForTests,
  createUploadedResourceFile,
  getFilesForClientContext,
  validateUploadFile,
} from '../src/services/resources';
import {
  buildDefaultSystemSettings,
  getIssuerBrandingFromSettings,
} from '../src/services/system/settingsService';
import { evaluateWorkspaceNotifications } from '../src/services/system/notificationCenterService';
import {
  buildAssistantContextSummary,
  computeSmartAiSuggestions,
} from '../src/services/system/aiContextService';
import { prepareConfirmedAssistantAction } from '../src/services/system/aiAssistantService';

const BASE_NICHE: NicheCampaign = {
  id: 'niche-e8',
  name: 'Clinicas de Estetica',
  segment: 'Estetica & Saude',
  city: 'Maceio',
  emoji: '✨',
  targetMrr: 10000,
  scripts: {},
  createdAt: '2026-11-01T10:00:00.000Z',
};

const FINANCE_SETTINGS: FinancialSettings = {
  id: 'default',
  companyName: 'Agencia Kaizen',
  currency: 'BRL',
  dateFormat: 'DD/MM/YYYY',
  timezone: KAIZEN_TIMEZONE,
  openingBalanceCents: 200000, // R$ 2.000,00 — jamais deve contar como receita
  openingBalanceDate: '2026-11-01',
  openingBalanceDescription: 'Saldo inicial de caixa',
  openingBalanceHistory: [],
  paymentMethods: [{ id: 'pix', label: 'Pix', active: true }],
  alertDaysAhead: 5,
  defaultDueDay: 10,
  updatedAt: '2026-11-01T10:00:00.000Z',
};

const FINANCE_CATEGORIES: FinancialCategory[] = [
  {
    id: 'fcat-rec-setup',
    name: 'Setup / Implantacao',
    kind: 'receita',
    active: true,
    isDefault: true,
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'fcat-rec-mrr',
    name: 'Mensalidade / MRR',
    kind: 'receita',
    active: true,
    isDefault: true,
    createdAt: '2026-11-01T10:00:00.000Z',
  },
];

// ============================================================================
// FLUXO 1: Comercial -> Cliente (preservacao de notas e anti-duplicidade)
// ============================================================================
test('Fluxo 1 E2E: Lead -> Cliente preserva historico e previne duplicacao no aceite de proposta', () => {
  const lead: Lead = {
    id: 'lead-e8-1',
    nicheId: BASE_NICHE.id,
    companyName: 'Instituto Lumina',
    contactName: 'Dra. Camila Souza',
    phone: '82999887766',
    displayPhone: '(82) 99988-7766',
    city: 'Maceio',
    category: 'Estetica',
    stage: 'reuniao_marcada',
    scriptUsed: 'script1',
    notes: [
      {
        id: 'n-1',
        date: '10/11/2026',
        text: 'Solicitou integracao com agenda online.',
        author: 'Ian',
      },
    ],
    creationValue: 2500,
    monthlyMrr: 1200,
    meetingDate: '2026-11-12',
    meetingTime: '14:30',
    meetingNotes: 'Apresentar plano Kaizen Performance.',
    createdAt: '2026-11-10T12:00:00.000Z',
  };

  // Avanco de etapa e conversao em cliente
  const closedLead: Lead = { ...lead, stage: 'fechado' };
  const client = buildClientFromLead(closedLead, BASE_NICHE, 'Ian');

  assert.equal(client.originLeadId, lead.id);
  assert.equal(client.companyName, 'Instituto Lumina');
  assert.ok(
    client.timeline.some((evt) =>
      (evt.description || '').includes('Solicitou integracao com agenda online')
    ),
    'Notas do lead devem ser migradas integralmente para a timeline do cliente'
  );
  assert.ok(
    client.timeline.some((evt) => evt.title.includes('Reunião comercial registrada')),
    'Reuniao registrada no lead deve permanecer visivel na timeline'
  );

  // Tentar localizar duplicata por leadId, telefone formatado diferente e nome com acento/caixa diferente
  const dupByLead = findDuplicateClient([client], { originLeadId: lead.id });
  assert.equal(dupByLead?.reason, 'originLeadId');
  assert.equal(dupByLead?.existingClient.id, client.id);

  const dupByPhone = findDuplicateClient([client], { phone: '(82) 9 9988-7766' });
  assert.equal(dupByPhone?.reason, 'phone');

  const dupByName = findDuplicateClient([client], { companyName: '  instituto   lumina ' });
  assert.equal(dupByName?.reason, 'companyName');

  // Aceite de nova proposta deve atualizar e enriquecer o cliente existente sem criar registro duplicado
  const draftProp = buildProposalFromSource({
    kind: 'contrato',
    existingProposals: [],
    issuerName: 'Agencia Kaizen',
    client,
    niche: BASE_NICHE,
  });
  const prop: ProposalContract = {
    ...draftProp,
    id: 'prop-e8-1',
    createdAt: '2026-11-12T15:00:00.000Z',
    setupTotal: 3200,
    monthlyMrr: 1500,
  };
  const signedProp = transitionProposalStatus(prop, 'assinada', 'Ian', 'Assinado via PDF');
  const merged = mergeClientWithProposalAcceptance(client, signedProp, 'Ian');

  assert.equal(merged.id, client.id);
  assert.equal(merged.setupValue, 3200);
  assert.equal(merged.monthlyMrr, 1500);
  assert.equal(merged.timeline[0].type, 'contrato_assinado');
});

// ============================================================================
// FLUXO 2: Cliente -> Projeto via Modelo -> Tarefas -> Agenda Integrada
// ============================================================================
test('Fluxo 2 E2E: Projeto por modelo e independente, atualiza progresso e reflete na Agenda Integrada', () => {
  const client: Client = {
    id: 'cli-e8-2',
    companyName: 'Clinica Harmonia',
    phone: '82988887777',
    displayPhone: '(82) 98888-7777',
    status: 'ativo',
    setupValue: 2000,
    monthlyMrr: 1000,
    timeline: [],
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  const projA = createProjectWithTemplateTasks({
    name: 'Performance Q4 — Harmonia',
    clientId: client.id,
    templateId: 'kaizen_performance',
    ownerName: 'Ian',
    startDate: '2026-11-10',
  });
  const projB = createProjectWithTemplateTasks({
    name: 'Start LP — Outro Cliente',
    clientId: 'cli-other',
    templateId: 'kaizen_start',
    ownerName: 'Ian',
    startDate: '2026-11-10',
  });

  assert.equal(projA.project.phases?.length, 3);
  assert.equal(projA.initialTasks.length, 7);

  // Editar tarefa do projeto A nunca afeta projeto B
  let tasksA = projA.initialTasks.map((t, idx) =>
    idx === 0 ? { ...transitionTaskStatus(t, 'concluida'), title: 'Tarefa editada isolada' } : t
  );
  assert.ok(projB.initialTasks.every((t) => t.title !== 'Tarefa editada isolada'));

  let progress = calculateProjectProgress(projA.project, tasksA, '2026-11-19');
  assert.equal(progress.completedTasks, 1);
  assert.equal(progress.totalTasks, 7);
  assert.equal(progress.percent, Math.round((1 / 7) * 100));
  assert.equal(progress.allTasksCompleted, false);

  // Concluir todas as tarefas atualiza progresso para 100%, mas nao auto-conclui o projeto
  tasksA = tasksA.map((t) => transitionTaskStatus(t, 'concluida'));
  progress = calculateProjectProgress(projA.project, tasksA, '2026-11-19');
  assert.equal(progress.percent, 100);
  assert.equal(progress.allTasksCompleted, true);
  assert.equal(projA.project.status, 'nao_iniciado');

  // Confirmacao explicita do administrador conclui o projeto
  const completedProjA = transitionProjectStatus(projA.project, 'concluido', 'Ian', 'Entrega aprovada');
  assert.equal(completedProjA.status, 'concluido');
  assert.ok(completedProjA.completedAt);

  // Reagendar prazo de projeto e tarefa na Agenda Integrada reflete a nova data sem duplicacao
  const rescheduledTask: Task = { ...projB.initialTasks[0], dueDate: '2026-11-25' };
  const rescheduledProjB: Project = { ...projB.project, dueDate: '2026-12-05' };

  const agendaFeed = buildIntegratedAgendaItems({
    events: [],
    projects: [completedProjA, rescheduledProjB],
    tasks: [rescheduledTask],
    leads: [],
    clients: [client],
    todayStr: '2026-11-19',
  });

  const taskItem = agendaFeed.filter(
    (item) => item.sourceKind === 'task_deadline' && item.sourceId === rescheduledTask.id
  );
  const projBItem = agendaFeed.filter(
    (item) => item.sourceKind === 'project_deadline' && item.sourceId === rescheduledProjB.id
  );
  assert.equal(taskItem.length, 1);
  assert.equal(taskItem[0].date, '2026-11-25');
  assert.equal(projBItem.length, 1);
  assert.equal(projBItem[0].date, '2026-12-05');

  // Projetos cancelados nao devem permanecer ativos na Agenda
  const cancelledProj: Project = { ...rescheduledProjB, status: 'cancelado' };
  const feedAfterCancel = buildIntegratedAgendaItems({
    events: [],
    projects: [cancelledProj],
    tasks: [],
    leads: [],
    clients: [client],
    todayStr: '2026-11-19',
  });
  assert.equal(feedAfterCancel.length, 0);
});

// ============================================================================
// FLUXO 3: Financeiro -> Dashboard -> Relatorios Executivos (Realizado vs Previsto)
// ============================================================================
test('Fluxo 3 E2E: Baixa parcial e total refletem com precisao no saldo, Dashboard e Relatorios Executivos', () => {
  const { entry } = createFinancialEntryRecord(
    {
      kind: 'receita',
      description: 'Setup Portal Odontologia',
      clientId: 'cli-fin-1',
      categoryId: 'fcat-rec-setup',
      amountCents: 300000, // R$ 3.000,00
      competenceDate: '2026-11-10',
      dueDate: '2026-11-25',
      paymentMethod: 'pix',
    },
    'Ian'
  );

  // Baixa parcial de R$ 1.200,00 em 15/11/2026
  const partial = registerSettlement({
    entry,
    existingTransactions: [],
    amountCents: 120000,
    date: '2026-11-15',
    paymentMethod: 'pix',
    actor: 'Ian',
  });
  assert.equal(partial.updatedEntry.status, 'parcialmente_recebida');
  assert.equal(getEntryPendingCents(partial.updatedEntry), 180000);

  let txs: FinancialTransaction[] = [...partial.createdTransactions];
  let entries: FinancialEntry[] = [partial.updatedEntry];

  const nowNov = new Date('2026-11-19T12:00:00.000Z');
  const dashPartial = computeDashboardMetrics([], nowNov, [], entries, txs);
  assert.equal(dashPartial.kpis.monthlyRealizedRevenueCents, 120000);
  assert.equal(dashPartial.kpis.openReceivablesCents, 180000);

  // Baixa do saldo restante (R$ 1.800,00) em 18/11/2026
  const finalSettle = registerSettlement({
    entry: partial.updatedEntry,
    existingTransactions: txs,
    amountCents: 180000,
    date: '2026-11-18',
    paymentMethod: 'pix',
    actor: 'Ian',
  });
  assert.equal(finalSettle.updatedEntry.status, 'recebida');
  assert.equal(getEntryPendingCents(finalSettle.updatedEntry), 0);
  assert.equal(getEffectiveEntryStatus(finalSettle.updatedEntry, '2026-11-19'), 'recebida');

  txs = [...txs, ...finalSettle.createdTransactions];
  entries = [finalSettle.updatedEntry];

  const dashFull = computeDashboardMetrics([], nowNov, [], entries, txs);
  assert.equal(dashFull.kpis.monthlyRealizedRevenueCents, 300000);
  assert.equal(dashFull.kpis.openReceivablesCents, 0);

  const execSnap = computeExecutiveDashboardSnapshot({
    leads: [],
    niches: [BASE_NICHE],
    clients: [],
    proposals: [],
    projects: [],
    tasks: [],
    agendaEvents: [],
    socialChannels: [],
    socialPosts: [],
    financialEntries: entries,
    financialTransactions: txs,
    financialCategories: FINANCE_CATEGORIES,
    financialRecurrences: [],
    financialSettings: FINANCE_SETTINGS,
    financialAuditLogs: [],
    resourceFiles: [],
    preset: 'este_mes',
    todayStr: '2026-11-19',
  });

  // Saldo inicial de R$ 2.000,00 NAO deve inflar receita operacional realizada (R$ 3.000,00)
  assert.equal(execSnap.financial.current.receivedRevenueCents, 300000);
  assert.equal(execSnap.financial.current.accountsReceivableCents, 0);
});

// ============================================================================
// FLUXO 4: Propostas e Contratos -> Mudanca de Status -> Geracao de PDF
// ============================================================================
test('Fluxo 4 E2E: Proposta enviada -> aprovada -> assinada gera PDF valido com branding sem pular assinatura', () => {
  const client: Client = {
    id: 'cli-prop-1',
    companyName: 'Clinica Vita',
    contactName: 'Roberto Lima',
    phone: '82991112222',
    displayPhone: '(82) 99111-2222',
    status: 'ativo',
    setupValue: 1800,
    monthlyMrr: 750,
    timeline: [],
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  const settings = buildDefaultSystemSettings('Ian');
  settings.adminProfile.agencyName = 'Kaizen Digital Studio';
  settings.adminProfile.issuerDocument = '12.345.678/0001-90';
  const branding = getIssuerBrandingFromSettings(settings);

  const base = buildProposalFromSource({
    kind: 'contrato',
    existingProposals: [],
    issuerName: branding.issuerName,
    client,
    niche: BASE_NICHE,
  });
  const prop: ProposalContract = {
    ...base,
    id: 'prop-e8-pdf',
    createdAt: '2026-11-15T10:00:00.000Z',
    discountValue: 200,
    ...calculateProposalTotals(base.items, 200),
  };

  assert.equal(prop.setupTotal, 1600);
  assert.equal(prop.monthlyMrr, 750);

  const sent = transitionProposalStatus(prop, 'enviada', 'Ian');
  assert.ok(sent.sentAt);
  assert.equal(sent.signedAt, undefined);

  const approved = transitionProposalStatus(sent, 'aprovada', 'Ian');
  assert.ok(approved.approvedAt);
  assert.equal(approved.signedAt, undefined, 'Aprovacao nao deve marcar contrato como assinado');

  const signed = transitionProposalStatus(approved, 'assinada', 'Ian');
  assert.ok(signed.signedAt);
  assert.equal(signed.history.length, 4);

  const pdfDoc = buildProposalPdfDocument(signed, branding);
  const pdfOutput = pdfDoc.output('datauristring');
  assert.ok(pdfOutput.startsWith('data:application/pdf'));
  const rawPdfText = pdfDoc.output();
  assert.ok(rawPdfText.startsWith('%PDF-'));
  assert.ok(rawPdfText.includes('KZ-C-'));
});

// ============================================================================
// FLUXO 5: Materiais e Documentos -> Heranca de Vinculo e Bloqueio de Risco
// ============================================================================
test('Fluxo 5 E2E: Validacao rigorosa de upload, heranca Projeto->Cliente sem duplicacao e sem URL publica', async () => {
  clearMemoryBlobStoreForTests();

  const blockedExe = validateUploadFile({ name: 'instalador.exe', size: 1024 });
  assert.equal(blockedExe.ok, false);

  const blockedDoubleExt = validateUploadFile({ name: 'proposta.pdf.exe', size: 1024 });
  assert.equal(blockedDoubleExt.ok, false);

  const blockedTooBig = validateUploadFile({ name: 'video.mp4', size: 26 * 1024 * 1024 });
  assert.equal(blockedTooBig.ok, false);

  const project: Project = {
    id: 'proj-e8-mat',
    name: 'Landing Page Premium',
    clientId: 'cli-e8-mat',
    serviceType: 'Landing Page',
    templateId: 'kaizen_start',
    status: 'em_andamento',
    ownerName: 'Ian',
    startDate: '2026-11-10',
    documents: [],
    history: [],
    createdAt: '2026-11-10T10:00:00.000Z',
  };

  const payload = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // %PDF-1.4
  const uploadResult = await createUploadedResourceFile({
    file: {
      name: 'Briefing Oficial Clínica!.pdf',
      size: payload.byteLength,
      type: 'application/pdf',
      data: payload,
    },
    categoryId: 'cat-doc-comercial',
    tags: ['briefing', 'Clinica', 'briefing'],
    projectId: project.id,
    projectSection: 'documentos',
    uploadedBy: 'Ian',
  });

  assert.equal(uploadResult.ok, true);
  assert.ok(uploadResult.file);
  const savedFile = uploadResult.file!;

  // Arquivo vinculado ao projeto sem clientId direto deve aparecer no contexto do cliente sem copia
  assert.equal(savedFile.clientId, undefined);
  assert.equal(savedFile.projectId, project.id);
  assert.deepEqual(savedFile.tags, ['briefing', 'clinica']);
  assert.equal(savedFile.downloadUrl, undefined, 'Fallback local nao deve expor URL publica');

  const clientFiles = getFilesForClientContext([savedFile], 'cli-e8-mat', [project]);
  assert.equal(clientFiles.length, 1);
  assert.equal(clientFiles[0].id, savedFile.id);
});

// ============================================================================
// FLUXO 6: Notificacoes -> Deduplicacao -> Assistente IA e Guardrails
// ============================================================================
test('Fluxo 6 E2E: Notificacoes deduplicadas preservam leitura e Assistente IA bloqueia acoes destrutivas', () => {
  const settings = buildDefaultSystemSettings('Ian');
  const { entry: overdueEntry } = createFinancialEntryRecord(
    {
      id: 'fin-e8-overdue',
      kind: 'receita',
      description: 'Mensalidade Clinica Alfa',
      categoryId: 'fcat-rec-mrr',
      amountCents: 150000,
      competenceDate: '2026-11-01',
      dueDate: '2026-11-10',
      paymentMethod: 'pix',
    },
    'Ian'
  );

  const overdueTask: Task = {
    id: 'task-e8-overdue',
    title: 'Publicar LP de campanha',
    dueDate: '2026-11-15',
    priority: 'urgente',
    status: 'a_fazer',
    checklist: [],
    createdAt: '2026-11-10T10:00:00.000Z',
  };

  // Primeira avaliacao gera alertas financeiros e operacionais
  const firstRun = evaluateWorkspaceNotifications({
    leads: [],
    proposals: [],
    projects: [],
    tasks: [overdueTask],
    agendaEvents: [],
    financialEntries: [overdueEntry],
    existingNotifications: [],
    settings,
    todayStr: '2026-11-19',
  });
  assert.equal(firstRun.notifications.length, 2);

  // Marcar a primeira notificacao como lida e reavaliar nao pode duplicar nem resetar read=true
  const readNotifications: SystemNotification[] = firstRun.notifications.map((n, idx) =>
    idx === 0 ? { ...n, read: true, readAt: '2026-11-19T12:00:00.000Z' } : n
  );

  const secondRun = evaluateWorkspaceNotifications({
    leads: [],
    proposals: [],
    projects: [],
    tasks: [overdueTask],
    agendaEvents: [],
    financialEntries: [overdueEntry],
    existingNotifications: readNotifications,
    settings,
    todayStr: '2026-11-19',
  });
  assert.equal(secondRun.notifications.length, 2);
  assert.equal(secondRun.changedNotifications.length, 0);
  assert.equal(
    secondRun.notifications.filter((n) => n.read).length,
    1,
    'Estado de leitura deve ser preservado entre reavaliacoes'
  );

  // Contexto resumido do Assistente IA + Sugestoes deterministicas
  const context = buildAssistantContextSummary({
    leads: [],
    niches: [BASE_NICHE],
    clients: [],
    proposals: [],
    projects: [],
    tasks: [overdueTask],
    agendaEvents: [],
    socialChannels: [],
    socialPosts: [],
    financialEntries: [overdueEntry],
    financialTransactions: [],
    financialCategories: FINANCE_CATEGORIES,
    financialRecurrences: [],
    financialSettings: FINANCE_SETTINGS,
    financialAuditLogs: [],
    resourceFiles: [],
    todayStr: '2026-11-19',
  });
  assert.equal(context.operations.overdueTasksCount, 1);
  assert.equal(context.finance.aReceberEmAtraso, formatBrlFromCents(150000));

  const suggestions = computeSmartAiSuggestions({
    leads: [],
    proposals: [],
    projects: [],
    tasks: [overdueTask],
    financialEntries: [overdueEntry],
    todayStr: '2026-11-19',
  });
  assert.ok(suggestions.some((s) => s.id === 'sug-overdue-tasks'));
  assert.ok(suggestions.some((s) => s.id === 'sug-overdue-rec'));

  // Acao confirmada segura cria tarefa; acao proibida e rejeitada explicitamente
  const safeTaskResult = prepareConfirmedAssistantAction({
    id: 'act-1',
    type: 'create_task',
    title: 'Cobrar Clinica Alfa',
    description: 'Gerar tarefa de acompanhamento financeiro',
    status: 'pending',
    taskTitle: 'Cobrar Clinica Alfa referente a 10/11',
    taskPriority: 'alta',
    taskDueDate: '2026-11-20',
  });
  assert.equal(safeTaskResult.kind, 'create_task');
  if (safeTaskResult.kind === 'create_task') {
    assert.equal(safeTaskResult.task.status, 'a_fazer');
    assert.equal(safeTaskResult.task.priority, 'alta');
  }

  assert.throws(() => {
    prepareConfirmedAssistantAction({
      id: 'act-bad',
      type: 'delete_finance' as never,
      title: 'Apagar financeiro',
      description: 'Tentativa nao permitida',
      status: 'pending',
    });
  }, /não permitido por política de segurança/i);
});
