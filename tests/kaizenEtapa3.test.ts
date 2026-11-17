import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECT_TEMPLATES,
  calculateProjectProgress,
  createProjectWithTemplateTasks,
  transitionProjectStatus,
} from '../src/services/projectService';
import {
  computeTaskSummary,
  filterTasks,
  isTaskOverdue,
  transitionTaskStatus,
} from '../src/services/taskService';
import {
  GOOGLE_CALENDAR_OAUTH_ARCHITECTURE,
  buildGoogleCalendarTemplateUrl,
  buildIntegratedAgendaItems,
  getWeekDatesForDate,
} from '../src/services/agendaService';
import {
  confirmSocialPostPublished,
  filterSocialEligibleClients,
  hasContractedSocialManagement,
  transitionSocialPostStage,
} from '../src/services/socialService';
import {
  parseAndValidateBackup,
  prepareBackupRestorePayload,
  serializeCompleteBackupJson,
} from '../src/services/backupService';
import {
  AgendaEvent,
  Client,
  Project,
  ProposalContract,
  SocialChannel,
  SocialPost,
  Task,
} from '../src/types/kaizen';
import { Lead, NicheCampaign } from '../src/types/crm';

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: overrides.id || 'cli-test-1',
    companyName: overrides.companyName || 'Clínica Exemplo',
    phone: overrides.phone || '5511999990000',
    displayPhone: overrides.displayPhone || '+55 (11) 99999-0000',
    status: overrides.status || 'ativo',
    timeline: overrides.timeline || [],
    createdAt: overrides.createdAt || '2026-11-10T10:00:00.000Z',
    ...overrides,
  };
}

test('Modelos de Projetos (Kaizen Start, Kaizen Performance 90d, Personalizado) copiam tarefas de forma totalmente independente', () => {
  const startWithIg = createProjectWithTemplateTasks({
    name: 'Site + GBP Clínica Alpha',
    clientId: 'cli-1',
    templateId: 'kaizen_start',
    ownerName: 'Ian',
    startDate: '2026-11-16',
    includePinnedInstagramPosts: true,
  });

  const startWithoutIg = createProjectWithTemplateTasks({
    name: 'Site + SEO Clínica Beta',
    clientId: 'cli-2',
    templateId: 'kaizen_start',
    ownerName: 'Ian',
    startDate: '2026-11-16',
    includePinnedInstagramPosts: false,
  });

  assert.equal(startWithIg.project.dueDate, '2026-11-30');
  assert.equal(startWithIg.initialTasks.length, 6);
  assert.equal(startWithoutIg.initialTasks.length, 5);
  assert.equal(
    startWithoutIg.initialTasks.some((t) => t.title.includes('Instagram')),
    false
  );

  // Mutating cloned tasks/phases must never alter PROJECT_TEMPLATES or sibling project
  startWithIg.initialTasks[0].title = 'TÍTULO ALTERADO NO PROJETO A';
  startWithIg.initialTasks[0].checklist[0].done = true;
  if (startWithIg.project.phases?.[0]) {
    startWithIg.project.phases[0].label = 'FASE ALTERADA';
  }

  assert.notEqual(
    PROJECT_TEMPLATES.kaizen_start.tasks[0].title,
    'TÍTULO ALTERADO NO PROJETO A'
  );
  assert.equal(PROJECT_TEMPLATES.kaizen_start.phases[0].label, 'Entrega Pontual');
  assert.notEqual(
    startWithoutIg.initialTasks[0].title,
    'TÍTULO ALTERADO NO PROJETO A'
  );

  const perf = createProjectWithTemplateTasks({
    name: 'Performance Q4 Clínica Alpha',
    clientId: 'cli-1',
    templateId: 'kaizen_performance',
    ownerName: 'Ian',
    startDate: '2026-11-01',
  });
  assert.equal(perf.project.phases?.length, 3);
  assert.deepEqual(
    perf.project.phases?.map((p) => p.rangeLabel),
    ['Dias 1–30', 'Dias 31–60', 'Dias 61–90']
  );
  assert.equal(perf.project.dueDate, '2027-01-30');
  assert.equal(perf.initialTasks.length, 7);

  const custom = createProjectWithTemplateTasks({
    name: 'Consultoria Sob Medida',
    clientId: 'cli-3',
    templateId: 'personalizado',
    ownerName: 'Ian',
    startDate: '2026-11-16',
  });
  assert.equal(custom.initialTasks.length, 0);
});

test('Progresso do Projeto é calculado pelas tarefas vinculadas e NÃO conclui projeto automaticamente sem confirmação do administrador', () => {
  const { project, initialTasks } = createProjectWithTemplateTasks({
    name: 'Entrega Start',
    clientId: 'cli-1',
    templateId: 'kaizen_start',
    ownerName: 'Ian',
    startDate: '2026-11-01',
  });

  let activeProject: Project = { ...project, status: 'em_andamento' };
  let progress = calculateProjectProgress(activeProject, initialTasks, '2026-11-16');
  assert.equal(progress.percent, 0);
  assert.equal(progress.allTasksCompleted, false);

  const halfDone = initialTasks.map((t, idx) =>
    idx < 3 ? transitionTaskStatus(t, 'concluida') : t
  );
  progress = calculateProjectProgress(activeProject, halfDone, '2026-11-16');
  assert.equal(progress.percent, 50);
  assert.equal(progress.allTasksCompleted, false);

  const allDone = initialTasks.map((t) => transitionTaskStatus(t, 'concluida'));
  progress = calculateProjectProgress(activeProject, allDone, '2026-11-16');
  assert.equal(progress.percent, 100);
  assert.equal(progress.allTasksCompleted, true);
  // Projeto continua em_andamento até confirmação explícita
  assert.equal(activeProject.status, 'em_andamento');

  activeProject = transitionProjectStatus(
    activeProject,
    'concluido',
    'Ian',
    'Entrega homologada com cliente.'
  );
  assert.equal(activeProject.status, 'concluido');
  assert.ok(activeProject.completedAt);
  assert.equal(activeProject.history[0].type, 'conclusao_confirmada');
});

test('Minhas Tarefas filtra filas (hoje, próximas, atrasadas, concluídas, sem prazo) e ordena por urgência sem duplicação', () => {
  const today = '2026-11-16';
  const tasks: Task[] = [
    {
      id: 't-late',
      title: 'Subir DNS atrasado',
      projectId: 'proj-1',
      clientId: 'cli-1',
      dueDate: '2026-11-14',
      priority: 'urgente',
      status: 'em_andamento',
      checklist: [],
      createdAt: '2026-11-10T10:00:00.000Z',
    },
    {
      id: 't-today',
      title: 'Revisar LP hoje',
      projectId: 'proj-1',
      clientId: 'cli-1',
      dueDate: '2026-11-16',
      priority: 'alta',
      status: 'a_fazer',
      checklist: [],
      createdAt: '2026-11-11T10:00:00.000Z',
    },
    {
      id: 't-next',
      title: 'Relatório futuro',
      projectId: 'proj-2',
      clientId: 'cli-2',
      dueDate: '2026-11-22',
      priority: 'media',
      status: 'aguardando',
      checklist: [],
      createdAt: '2026-11-12T10:00:00.000Z',
    },
    {
      id: 't-nodate',
      title: 'Pesquisa sem prazo',
      priority: 'baixa',
      status: 'a_fazer',
      checklist: [],
      createdAt: '2026-11-12T10:00:00.000Z',
    },
    {
      id: 't-done',
      title: 'Briefing já concluído',
      projectId: 'proj-1',
      dueDate: '2026-11-12',
      priority: 'alta',
      status: 'concluida',
      checklist: [],
      createdAt: '2026-11-09T10:00:00.000Z',
      completedAt: '2026-11-12T15:00:00.000Z',
    },
  ];

  assert.equal(isTaskOverdue(tasks[0], today), true);
  assert.equal(isTaskOverdue(tasks[4], today), false);

  const summary = computeTaskSummary(tasks, today);
  assert.deepEqual(summary, {
    total: 5,
    openCount: 4,
    todayCount: 1,
    upcomingCount: 1,
    overdueCount: 1,
    completedCount: 1,
    noDueDateCount: 1,
  });

  assert.deepEqual(
    filterTasks(tasks, { queue: 'atrasadas', todayStr: today }).map((t) => t.id),
    ['t-late']
  );
  assert.deepEqual(
    filterTasks(tasks, { queue: 'hoje', todayStr: today }).map((t) => t.id),
    ['t-today']
  );
  assert.deepEqual(
    filterTasks(tasks, { queue: 'proximas', todayStr: today }).map((t) => t.id),
    ['t-next']
  );
  assert.deepEqual(
    filterTasks(tasks, { queue: 'concluidas', todayStr: today }).map((t) => t.id),
    ['t-done']
  );
  assert.deepEqual(
    filterTasks(tasks, { queue: 'sem_prazo', todayStr: today }).map((t) => t.id),
    ['t-nodate']
  );
  assert.deepEqual(
    filterTasks(tasks, { queue: 'todas', projectId: 'proj-1', todayStr: today }).map(
      (t) => t.id
    ),
    ['t-late', 't-today', 't-done']
  );
});

test('Agenda Integrada unifica Eventos, Prazos de Projeto, Tarefas e Reuniões/Retornos de Leads sem duplicar nem fingir OAuth', () => {
  const client = makeClient({ id: 'cli-1', companyName: 'Clínica Sorriso' });
  const { project, initialTasks } = createProjectWithTemplateTasks({
    name: 'Site Sorriso',
    clientId: client.id,
    templateId: 'personalizado',
    ownerName: 'Ian',
    startDate: '2026-11-10',
    dueDate: '2026-11-25',
  });
  void initialTasks;

  const task: Task = {
    id: 'task-1',
    title: 'Enviar layout final',
    projectId: project.id,
    clientId: client.id,
    dueDate: '2026-11-20',
    priority: 'alta',
    status: 'a_fazer',
    checklist: [],
    createdAt: '2026-11-12T09:00:00.000Z',
  };

  const evt: AgendaEvent = {
    id: 'evt-1',
    title: 'Alinhamento semanal',
    date: '2026-11-18',
    startTime: '14:00',
    type: 'reuniao_cliente',
    status: 'agendado',
    clientId: client.id,
    projectId: project.id,
    createdAt: '2026-11-12T09:00:00.000Z',
  };

  const lead: Lead = {
    id: 'lead-1',
    nicheId: 'niche-1',
    companyName: 'Studio Bem Estar',
    phone: '5511977776666',
    displayPhone: '+55 (11) 97777-6666',
    city: 'São Paulo',
    stage: 'reuniao_marcada',
    scriptUsed: 's1',
    notes: [],
    createdAt: '2026-11-10T09:00:00.000Z',
    meetingDate: '2026-11-18',
    meetingTime: '10:00',
    meetingStatus: 'agendada',
    callbackDate: '2026-11-17',
    callbackTime: '15:30',
    callbackStatus: 'pendente',
  };

  const items = buildIntegratedAgendaItems({
    events: [evt],
    projects: [project],
    tasks: [task],
    leads: [lead],
    clients: [client],
    todayStr: '2026-11-16',
  });

  // 1 AgendaEvent + 1 Project deadline + 1 Task deadline + 1 Lead meeting + 1 Lead callback = 5 distinct items
  assert.equal(items.length, 5);
  assert.equal(new Set(items.map((i) => i.id)).size, 5);
  assert.equal(items[0].sourceKind, 'lead_callback');
  assert.equal(items[1].sourceKind, 'lead_meeting');
  assert.equal(items[2].sourceKind, 'agenda_event');
  assert.equal(items[3].sourceKind, 'task_deadline');
  assert.equal(items[4].sourceKind, 'project_deadline');

  const weekDates = getWeekDatesForDate('2026-11-18');
  assert.equal(weekDates.length, 7);
  assert.equal(weekDates[0], '2026-11-15');
  assert.equal(weekDates[6], '2026-11-21');

  assert.equal(GOOGLE_CALENDAR_OAUTH_ARCHITECTURE.oauthConfigured, false);
  const draftUrl = buildGoogleCalendarTemplateUrl({
    title: 'Alinhamento semanal',
    date: '2026-11-18',
    startTime: '14:00',
  });
  assert.match(draftUrl, /^https:\/\/calendar\.google\.com\/calendar\/render/);
});

test('Redes Sociais respeita escopo contratado por cliente e bloqueia promoção automática de Aprovado para Publicado', () => {
  const onlySiteClient = makeClient({
    id: 'cli-site',
    companyName: 'Clínica Só Site',
    serviceScope: 'Landing Page Institucional + Domínio',
  });
  const socialScopeClient = makeClient({
    id: 'cli-social',
    companyName: 'Clínica Com Social',
    serviceScope: 'Gestão de Redes Sociais e Calendário Editorial',
  });
  const explicitlyDisabledClient = makeClient({
    id: 'cli-disabled',
    companyName: 'Clínica Bloqueada',
    serviceScope: 'Instagram posts',
    socialManagementEnabled: false,
  });
  const proposalClient = makeClient({
    id: 'cli-prop',
    companyName: 'Clínica Via Proposta',
    serviceScope: 'Site',
  });

  const proposals: ProposalContract[] = [
    {
      id: 'prop-1',
      code: 'KZ-P-2026-001',
      kind: 'proposta',
      title: 'Gestão de Redes Sociais + Conteúdo Mensal',
      status: 'aprovada',
      clientId: 'cli-prop',
      recipientCompany: 'Clínica Via Proposta',
      issuerName: 'Agência Kaizen',
      items: [],
      discountValue: 0,
      setupTotal: 0,
      monthlyMrr: 1500,
      history: [],
      createdAt: '2026-11-10T10:00:00.000Z',
    },
  ];

  const channels: SocialChannel[] = [];
  assert.equal(hasContractedSocialManagement(onlySiteClient, proposals, channels), false);
  assert.equal(hasContractedSocialManagement(socialScopeClient, proposals, channels), true);
  assert.equal(
    hasContractedSocialManagement(explicitlyDisabledClient, proposals, channels),
    false
  );
  assert.equal(hasContractedSocialManagement(proposalClient, proposals, channels), true);

  const eligible = filterSocialEligibleClients(
    [onlySiteClient, socialScopeClient, explicitlyDisabledClient, proposalClient],
    proposals,
    channels
  );
  assert.deepEqual(
    eligible.map((c) => c.id),
    ['cli-social', 'cli-prop']
  );

  const draftPost: SocialPost = {
    id: 'post-1',
    title: 'Carrossel Autoridade',
    ownerType: 'kaizen',
    platform: 'instagram',
    format: 'carrossel',
    plannedDate: '2026-11-20',
    plannedTime: '18:00',
    assignee: 'Ian',
    status: 'revisao',
    createdAt: '2026-11-15T10:00:00.000Z',
  };

  const approved = transitionSocialPostStage(draftPost, 'aprovado');
  assert.equal(approved.status, 'aprovado');
  assert.equal(approved.publishedAt, undefined);

  assert.throws(() => transitionSocialPostStage(approved, 'publicado'));

  const published = confirmSocialPostPublished(approved, 'Ian');
  assert.equal(published.status, 'publicado');
  assert.equal(published.publishedConfirmedBy, 'Ian');
  assert.ok(published.publishedAt);
});

test('Backup v3.0 preserva e restaura todas as 10 coleções incluindo Projetos, Tarefas, Agenda Integrada e Redes Sociais', () => {
  const niche: NicheCampaign = {
    id: 'niche-1',
    name: 'Campanha Teste',
    segment: 'Clínicas',
    city: 'São Paulo',
    emoji: '🚀',
    targetMrr: 5000,
    scripts: {},
    createdAt: '2026-11-01T00:00:00.000Z',
  };
  const { project, initialTasks } = createProjectWithTemplateTasks({
    name: 'Projeto Backup',
    clientId: 'cli-1',
    templateId: 'personalizado',
    ownerName: 'Ian',
  });
  const extraTask: Task = {
    id: 'task-bkp-1',
    title: 'Tarefa Backup',
    projectId: project.id,
    priority: 'media',
    status: 'a_fazer',
    checklist: [],
    createdAt: '2026-11-16T00:00:00.000Z',
  };
  const event: AgendaEvent = {
    id: 'evt-bkp-1',
    title: 'Reunião Backup',
    date: '2026-11-20',
    type: 'reuniao_cliente',
    status: 'agendado',
    createdAt: '2026-11-16T00:00:00.000Z',
  };
  const channel: SocialChannel = {
    id: 'sch-bkp-1',
    ownerType: 'kaizen',
    platform: 'instagram',
    handle: '@agenciakaizen',
    active: true,
    createdAt: '2026-11-16T00:00:00.000Z',
  };
  const post: SocialPost = {
    id: 'post-bkp-1',
    title: 'Post Backup',
    ownerType: 'kaizen',
    channelId: channel.id,
    platform: 'instagram',
    format: 'post',
    plannedDate: '2026-11-21',
    assignee: 'Ian',
    status: 'planejamento',
    createdAt: '2026-11-16T00:00:00.000Z',
  };

  const json = serializeCompleteBackupJson({
    niches: [niche],
    leads: [],
    importedSheets: [],
    clients: [makeClient({ id: 'cli-1' })],
    proposals: [],
    projects: [project],
    tasks: [...initialTasks, extraTask],
    agendaEvents: [event],
    socialChannels: [channel],
    socialPosts: [post],
    userName: 'Ian',
  });

  const validated = parseAndValidateBackup(json);
  assert.equal(validated.ok, true);
  assert.equal(validated.data?.projects?.length, 1);
  assert.equal(validated.data?.tasks?.length, 1);
  assert.equal(validated.data?.agendaEvents?.length, 1);
  assert.equal(validated.data?.socialChannels?.length, 1);
  assert.equal(validated.data?.socialPosts?.length, 1);

  const tampered = json.replace('Post Backup', 'Post Adulterado');
  const tamperedValidation = parseAndValidateBackup(tampered);
  assert.equal(tamperedValidation.ok, false);

  const prepared = prepareBackupRestorePayload(
    validated.data!,
    { niches: [], leads: [], importedSheets: [] },
    'merge_by_id'
  );
  assert.equal(prepared.projectsToWrite[0].id, project.id);
  assert.equal(prepared.tasksToWrite[0].id, extraTask.id);
  assert.equal(prepared.agendaEventsToWrite[0].id, event.id);
  assert.equal(prepared.socialChannelsToWrite[0].id, channel.id);
  assert.equal(prepared.socialPostsToWrite[0].id, post.id);
});
