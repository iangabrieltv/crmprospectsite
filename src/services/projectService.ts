import {
  Project,
  ProjectDocumentLink,
  ProjectHistoryEvent,
  ProjectPhase,
  ProjectStatus,
  ProjectTemplateId,
  Task,
  TaskPriority,
  getProjectStatusMeta,
} from '../types/kaizen';

export interface ProjectTemplateTaskBlueprint {
  title: string;
  description: string;
  phaseLabel?: string;
  offsetDaysFromStart: number;
  priority: TaskPriority;
  checklist: string[];
  optionalKey?: 'instagram_pinned_posts';
}

export interface ProjectTemplateDefinition {
  id: ProjectTemplateId;
  name: string;
  shortLabel: string;
  description: string;
  defaultServiceType: string;
  defaultDurationDays: number;
  phases: ProjectPhase[];
  tasks: ProjectTemplateTaskBlueprint[];
}

export const PROJECT_TEMPLATES: Record<ProjectTemplateId, ProjectTemplateDefinition> = {
  kaizen_start: {
    id: 'kaizen_start',
    name: 'Kaizen Start',
    shortLabel: 'Kaizen Start',
    description:
      'Estrutura para entregas pontuais: Landing Page, Google Business Profile, SEO inicial e posts fixados para Instagram (conforme escopo).',
    defaultServiceType: 'Kaizen Start (Landing Page + GBP + SEO)',
    defaultDurationDays: 14,
    phases: [
      {
        id: 'start-entrega',
        label: 'Entrega Pontual',
        rangeLabel: 'Ciclo Start (14 dias)',
        description: 'Setup completo de presença digital e publicação.',
      },
    ],
    tasks: [
      {
        title: 'Briefing estratégico, coleta de acessos e identidade visual',
        description:
          'Validar paleta, logo, fotos reais da empresa, proposta de valor e acessos de domínio/hospedagem.',
        phaseLabel: 'Entrega Pontual',
        offsetDaysFromStart: 1,
        priority: 'alta',
        checklist: [
          'Receber briefing e materiais do cliente',
          'Confirmar domínio e apontamento DNS',
          'Definir oferta principal e CTA de conversão',
        ],
      },
      {
        title: 'Copywriting, estrutura e desenvolvimento da Landing Page',
        description:
          'Desenvolver página responsiva de alta conversão focada em WhatsApp/formulário e carregamento rápido.',
        phaseLabel: 'Entrega Pontual',
        offsetDaysFromStart: 5,
        priority: 'alta',
        checklist: [
          'Estruturar dobra inicial com proposta clara',
          'Implementar prova social e seção de serviços',
          'Testar responsividade em mobile e desktop',
        ],
      },
      {
        title: 'Otimização do Google Business Profile (Perfil da Empresa)',
        description:
          'Atualizar categorias, descrição com palavras-chave locais, horários, link do site e fotos.',
        phaseLabel: 'Entrega Pontual',
        offsetDaysFromStart: 8,
        priority: 'media',
        checklist: [
          'Revisar categoria principal e secundárias',
          'Inserir descrição otimizada e link rastreável',
          'Publicar fotos de capa, fachada e equipe',
        ],
      },
      {
        title: 'SEO on-page, tags semânticas e indexação Google',
        description:
          'Configurar meta title, meta description, OpenGraph, sitemap e submissão no Search Console.',
        phaseLabel: 'Entrega Pontual',
        offsetDaysFromStart: 10,
        priority: 'media',
        checklist: [
          'Configurar title/description e headings H1-H3',
          'Validar compressão de imagens e Core Web Vitals',
          'Solicitar indexação e validar SSL ativo',
        ],
      },
      {
        title: 'Posts fixados estratégicos para Instagram (conforme escopo)',
        description:
          'Produzir e alinhar os 3 posts fixados de apresentação, autoridade e chamada comercial no perfil.',
        phaseLabel: 'Entrega Pontual',
        offsetDaysFromStart: 12,
        priority: 'media',
        optionalKey: 'instagram_pinned_posts',
        checklist: [
          'Post 1: Posicionamento e quem somos',
          'Post 2: Solução/serviços e diferenciais',
          'Post 3: Prova social e CTA para contato',
        ],
      },
      {
        title: 'Revisão final, aprovação do cliente e Go-Live',
        description:
          'Homologação completa de links, WhatsApp, formulários e entrega formal do projeto.',
        phaseLabel: 'Entrega Pontual',
        offsetDaysFromStart: 14,
        priority: 'urgente',
        checklist: [
          'Testar todos os botões e links de WhatsApp',
          'Apresentar entrega ao cliente',
          'Registrar documentação e links finais',
        ],
      },
    ],
  },

  kaizen_performance: {
    id: 'kaizen_performance',
    name: 'Kaizen Performance',
    shortLabel: 'Kaizen Performance (90 dias)',
    description:
      'Programa contínuo de 90 dias estruturado em 3 ciclos independentes: Estruturação (1–30), Execução (31–60) e Otimização & Relatório (61–90).',
    defaultServiceType: 'Kaizen Performance (Programa 90 Dias)',
    defaultDurationDays: 90,
    phases: [
      {
        id: 'perf-1-30',
        label: 'Estruturação',
        rangeLabel: 'Dias 1–30',
        description: 'Diagnóstico, base técnica, posicionamento e preparação de canais.',
      },
      {
        id: 'perf-31-60',
        label: 'Execução',
        rangeLabel: 'Dias 31–60',
        description: 'Operação de entregas, campanhas, cadência de conteúdo e captação.',
      },
      {
        id: 'perf-61-90',
        label: 'Otimização & Relatório',
        rangeLabel: 'Dias 61–90',
        description: 'Refinamento por métricas, CRO e relatório executivo de resultados.',
      },
    ],
    tasks: [
      {
        title: '[Dias 1–30] Diagnóstico inicial, acessos e plano de 90 dias',
        description:
          'Mapear presença digital atual, metas comerciais e organizar acessos de domínio, analytics e canais.',
        phaseLabel: 'Dias 1–30 · Estruturação',
        offsetDaysFromStart: 5,
        priority: 'alta',
        checklist: [
          'Reunião de kickoff e alinhamento de metas',
          'Checklist de acessos e ativos digitais',
        ],
      },
      {
        title: '[Dias 1–30] Estruturação de páginas, funil de conversão e rastreamento',
        description:
          'Publicar ou otimizar Landing Page, eventos de conversão e integração de captura de leads.',
        phaseLabel: 'Dias 1–30 · Estruturação',
        offsetDaysFromStart: 18,
        priority: 'alta',
        checklist: [
          'Otimizar fluxo de conversão e WhatsApp',
          'Validar tags de acompanhamento e SEO base',
        ],
      },
      {
        title: '[Dias 1–30] Entrega da base estruturada e validação do ciclo 1',
        description:
          'Revisar todos os entregáveis de estruturação antes de iniciar a escala na fase de execução.',
        phaseLabel: 'Dias 1–30 · Estruturação',
        offsetDaysFromStart: 30,
        priority: 'media',
        checklist: [
          'Checklist técnico de 30 dias validado',
          'Alinhamento rápido de transição para Execução',
        ],
      },
      {
        title: '[Dias 31–60] Execução de frentes de aquisição e posicionamento',
        description:
          'Rodar ações planejadas de presença digital, melhorias de oferta e cadência de conteúdo.',
        phaseLabel: 'Dias 31–60 · Execução',
        offsetDaysFromStart: 42,
        priority: 'alta',
        checklist: [
          'Publicar ativos e melhorias programadas',
          'Acompanhar geração de contatos e leads',
        ],
      },
      {
        title: '[Dias 31–60] Revisão intermediária e ajustes de taxa de conversão',
        description:
          'Analisar métricas dos primeiros 45 dias e ajustar copy, CTAs ou segmentação.',
        phaseLabel: 'Dias 31–60 · Execução',
        offsetDaysFromStart: 55,
        priority: 'media',
        checklist: [
          'Comparar performance de páginas e canais',
          'Aplicar ajustes rápidos de conversão',
        ],
      },
      {
        title: '[Dias 61–90] Otimização avançada de performance e SEO local',
        description:
          'Refinar gargalos identificados na fase de execução e consolidar autoridade orgânica.',
        phaseLabel: 'Dias 61–90 · Otimização & Relatório',
        offsetDaysFromStart: 74,
        priority: 'alta',
        checklist: [
          'Auditoria de velocidade e SEO',
          'Otimização final das páginas de maior tráfego',
        ],
      },
      {
        title: '[Dias 61–90] Relatório executivo de 90 dias e reunião de próximos passos',
        description:
          'Consolidar resultados do trimestre, aprendizados e plano de continuidade ou expansão.',
        phaseLabel: 'Dias 61–90 · Otimização & Relatório',
        offsetDaysFromStart: 90,
        priority: 'urgente',
        checklist: [
          'Compilar métricas e entregas dos 90 dias',
          'Apresentar relatório e proposta de próximo ciclo',
        ],
      },
    ],
  },

  personalizado: {
    id: 'personalizado',
    name: 'Personalizado',
    shortLabel: 'Projeto Personalizado',
    description:
      'Projeto flexível criado sob medida sem tarefas pré-preenchidas. Você define escopo, datas e tarefas livremente.',
    defaultServiceType: 'Projeto Personalizado',
    defaultDurationDays: 15,
    phases: [],
    tasks: [],
  },
};

export function generateProjectId(): string {
  const rand = Math.random().toString(36).substring(2, 7);
  return `proj-${Date.now()}-${rand}`;
}

export function generateProjectHistoryId(prefix: string = 'phist'): string {
  const rand = Math.random().toString(36).substring(2, 6);
  return `${prefix}-${Date.now()}-${rand}`;
}

export function generateProjectDocumentId(): string {
  const rand = Math.random().toString(36).substring(2, 6);
  return `pdoc-${Date.now()}-${rand}`;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const base = isoDate ? new Date(`${isoDate}T12:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setDate(base.getDate() + days);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface CreateProjectFromTemplateParams {
  name: string;
  clientId: string;
  proposalId?: string;
  templateId: ProjectTemplateId;
  serviceType?: string;
  description?: string;
  ownerName: string;
  status?: ProjectStatus;
  startDate?: string;
  dueDate?: string;
  notes?: string;
  includePinnedInstagramPosts?: boolean;
  documents?: ProjectDocumentLink[];
}

/**
 * Instantiates a Project and independent cloned Tasks from the chosen template.
 * Modifying the resulting project or tasks never mutates PROJECT_TEMPLATES or sibling projects.
 */
export function createProjectWithTemplateTasks(
  params: CreateProjectFromTemplateParams
): { project: Project; initialTasks: Task[] } {
  const template = PROJECT_TEMPLATES[params.templateId] || PROJECT_TEMPLATES.personalizado;
  const nowIso = new Date().toISOString();
  const startDate = params.startDate || getTodayIsoDate();
  const dueDate =
    params.dueDate || addDaysToIsoDate(startDate, template.defaultDurationDays);
  const projectId = generateProjectId();

  const clonedPhases: ProjectPhase[] = template.phases.map((phase, idx) => ({
    id: `${projectId}-ph-${idx + 1}`,
    label: phase.label,
    rangeLabel: phase.rangeLabel,
    description: phase.description,
  }));

  const includeIgPosts = params.includePinnedInstagramPosts ?? true;
  const templateTasksToCopy = template.tasks.filter(
    (t) => t.optionalKey !== 'instagram_pinned_posts' || includeIgPosts
  );

  const initialTasks: Task[] = templateTasksToCopy.map((blueprint, index) => {
    const taskDueDate = addDaysToIsoDate(startDate, blueprint.offsetDaysFromStart);
    const taskId = `task-${Date.now()}-${index}-${Math.random()
      .toString(36)
      .substring(2, 6)}`;

    return {
      id: taskId,
      title: blueprint.title,
      description: blueprint.description,
      projectId,
      clientId: params.clientId,
      phaseLabel: blueprint.phaseLabel,
      startDate,
      dueDate: taskDueDate,
      priority: blueprint.priority,
      status: 'a_fazer',
      checklist: blueprint.checklist.map((itemTitle, cIdx) => ({
        id: `${taskId}-chk-${cIdx + 1}`,
        title: itemTitle,
        done: false,
      })),
      createdAt: nowIso,
      schemaVersion: 1,
      updatedAt: nowIso,
    };
  });

  const history: ProjectHistoryEvent[] = [
    {
      id: generateProjectHistoryId('pinit'),
      date: nowIso,
      type: 'criacao',
      title: `Projeto criado (${template.name})`,
      description:
        initialTasks.length > 0
          ? `${initialTasks.length} tarefas iniciais copiadas de forma independente do modelo ${template.name}.`
          : 'Projeto personalizado criado sem tarefas de modelo.',
      author: params.ownerName,
    },
  ];

  const project: Project = {
    id: projectId,
    name: params.name.trim(),
    clientId: params.clientId,
    proposalId: params.proposalId || undefined,
    serviceType: (params.serviceType || template.defaultServiceType).trim(),
    description: params.description?.trim() || undefined,
    templateId: params.templateId,
    status: params.status || 'nao_iniciado',
    ownerName: params.ownerName.trim() || 'Ian',
    startDate,
    dueDate,
    phases: clonedPhases.length > 0 ? clonedPhases : undefined,
    documents: (params.documents || []).map((d) => ({ ...d })),
    history,
    notes: params.notes?.trim() || undefined,
    createdAt: nowIso,
    schemaVersion: 1,
    updatedAt: nowIso,
  };

  return { project, initialTasks };
}

export interface ProjectProgressMetrics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  percent: number;
  allTasksCompleted: boolean;
}

/**
 * Calculates real execution progress strictly from linked Task records (single source of truth).
 */
export function calculateProjectProgress(
  project: Project,
  tasks: Task[],
  todayStr: string = getTodayIsoDate()
): ProjectProgressMetrics {
  const linked = tasks.filter((t) => t.projectId === project.id);
  const totalTasks = linked.length;
  const completedTasks = linked.filter((t) => t.status === 'concluida').length;
  const pendingTasks = totalTasks - completedTasks;
  const overdueTasks = linked.filter(
    (t) =>
      Boolean(t.dueDate) &&
      t.status !== 'concluida' &&
      (t.dueDate as string) < todayStr
  ).length;

  const percent =
    totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : project.status === 'concluido'
      ? 100
      : 0;

  return {
    totalTasks,
    completedTasks,
    pendingTasks,
    overdueTasks,
    percent,
    allTasksCompleted: totalTasks > 0 && completedTasks === totalTasks,
  };
}

export function transitionProjectStatus(
  project: Project,
  nextStatus: ProjectStatus,
  author: string,
  note?: string
): Project {
  const nowIso = new Date().toISOString();
  const nextLabel = getProjectStatusMeta(nextStatus).label;
  const isConcluding = nextStatus === 'concluido';

  const event: ProjectHistoryEvent = {
    id: generateProjectHistoryId('pst'),
    date: nowIso,
    type: isConcluding ? 'conclusao_confirmada' : 'status_alterado',
    title: isConcluding
      ? 'Projeto confirmado como concluído pelo administrador'
      : `Status alterado para ${nextLabel}`,
    description: note?.trim() || undefined,
    author,
  };

  return {
    ...project,
    status: nextStatus,
    completedAt: isConcluding ? project.completedAt || nowIso : project.completedAt,
    history: [event, ...(project.history || [])].slice(0, 200),
    updatedAt: nowIso,
  };
}

export function appendProjectHistory(
  project: Project,
  event: Omit<ProjectHistoryEvent, 'id' | 'date'>
): Project {
  const nowIso = new Date().toISOString();
  const fullEvent: ProjectHistoryEvent = {
    id: generateProjectHistoryId('pevt'),
    date: nowIso,
    ...event,
  };
  return {
    ...project,
    history: [fullEvent, ...(project.history || [])].slice(0, 200),
    updatedAt: nowIso,
  };
}
