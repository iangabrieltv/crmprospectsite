import { AppTab } from '../types/crm';

export type SidebarGroupId =
  | 'geral'
  | 'comercial'
  | 'operacao'
  | 'recursos'
  | 'gestao'
  | 'sistema';

export interface NavigationItem {
  id: AppTab;
  /** Additional AppTab routes that belong to this sidebar entry (e.g. CRM sub-views) */
  matchTabs?: AppTab[];
  label: string;
  group: SidebarGroupId;
  iconName:
    | 'LayoutDashboard'
    | 'Kanban'
    | 'Users'
    | 'FileSignature'
    | 'FolderKanban'
    | 'CheckSquare'
    | 'Calendar'
    | 'Share2'
    | 'FolderOpen'
    | 'FileText'
    | 'Library'
    | 'Wallet'
    | 'BarChart3'
    | 'Gauge'
    | 'Settings'
    | 'Bot'
    | 'Zap'
    | 'Bell';
  implemented: boolean;
  description: string;
  plannedFeatures?: string[];
  targetStageLabel?: string;
}

export interface NavigationGroup {
  id: SidebarGroupId;
  label: string;
}

export const NAVIGATION_GROUPS: NavigationGroup[] = [
  { id: 'geral', label: 'GERAL' },
  { id: 'comercial', label: 'COMERCIAL' },
  { id: 'operacao', label: 'OPERAÇÃO' },
  { id: 'recursos', label: 'RECURSOS' },
  { id: 'gestao', label: 'GESTÃO' },
  { id: 'sistema', label: 'SISTEMA' },
];

export const NAVIGATION_ITEMS: NavigationItem[] = [
  // GERAL
  {
    id: 'dashboard',
    label: 'Dashboard',
    group: 'geral',
    iconName: 'LayoutDashboard',
    implemented: true,
    description: 'Painel executivo da agência, indicadores comerciais, pendências e desempenho do funil.',
  },

  // COMERCIAL
  {
    id: 'kanban',
    matchTabs: ['kanban', 'leads_list', 'importer'],
    label: 'CRM',
    group: 'comercial',
    iconName: 'Kanban',
    implemented: true,
    description: 'Pipeline sequencial de prospecção, listagem de leads, busca, filtros e importador de planilhas.',
  },
  {
    id: 'clients',
    label: 'Clientes',
    group: 'comercial',
    iconName: 'Users',
    implemented: true,
    targetStageLabel: 'Etapa 2 — Gestão Comercial',
    description: 'Base centralizada de clientes ativos, conversão direta do CRM, contratos, histórico e relacionamentos.',
  },
  {
    id: 'proposals',
    label: 'Propostas e Contratos',
    group: 'comercial',
    iconName: 'FileSignature',
    implemented: true,
    targetStageLabel: 'Etapa 2 — Gestão Comercial',
    description: 'Elaboração, acompanhamento de status, envio e geração de PDF profissional de propostas e contratos.',
  },

  // OPERAÇÃO
  {
    id: 'projects',
    label: 'Projetos',
    group: 'operacao',
    iconName: 'FolderKanban',
    implemented: true,
    targetStageLabel: 'Etapa 3 — Operação & Entregas',
    description: 'Administração de projetos da agência com modelos Kaizen Start, Kaizen Performance (90 dias) e entregas vinculadas.',
  },
  {
    id: 'tasks',
    label: 'Minhas Tarefas',
    group: 'operacao',
    iconName: 'CheckSquare',
    implemented: true,
    targetStageLabel: 'Etapa 3 — Operação & Entregas',
    description: 'Central unificada de tarefas com visão de hoje, próximas, atrasadas, lista, quadro Kanban e checklists.',
  },
  {
    id: 'agenda',
    label: 'Agenda Integrada',
    group: 'operacao',
    iconName: 'Calendar',
    implemented: true,
    description: 'Calendário mensal, semanal, diário e pauta unificada de reuniões, prazos de projetos, tarefas e compromissos.',
  },
  {
    id: 'social',
    label: 'Redes Sociais',
    group: 'operacao',
    iconName: 'Share2',
    implemented: true,
    targetStageLabel: 'Etapa 3 — Conteúdo & Presença',
    description: 'Canais sociais da Kaizen e clientes elegíveis, calendário editorial, Kanban de produção e confirmação manual de publicação.',
  },

  // RECURSOS
  {
    id: 'documents',
    label: 'Materiais e Documentos',
    group: 'recursos',
    iconName: 'FolderOpen',
    implemented: true,
    targetStageLabel: 'Etapa 5 — Central de Materiais',
    description: 'Central de materiais, documentos internos, arquivos de clientes e projetos, scripts comerciais, biblioteca de modelos e categorias.',
  },
  {
    id: 'scripts',
    label: 'Scripts',
    group: 'recursos',
    iconName: 'FileText',
    implemented: true,
    description: 'Roteiros de prospecção ativa, quebra de objeções, simulador de variáveis e melhoria com IA.',
  },
  {
    id: 'templates',
    label: 'Biblioteca de Modelos',
    group: 'recursos',
    iconName: 'Library',
    implemented: true,
    targetStageLabel: 'Etapa 5 — Biblioteca de Modelos',
    description: 'Acervo reutilizável de modelos de propostas, contratos, projetos, tarefas, briefings, mensagens e gestão da Kaizen.',
  },

  // GESTÃO
  {
    id: 'finance',
    label: 'Financeiro',
    group: 'gestao',
    iconName: 'Wallet',
    implemented: true,
    targetStageLabel: 'Etapa 4 — Gestão Financeira',
    description: 'Controle completo de receitas, despesas, contas a receber/pagar, fluxo de caixa real vs previsto, recorrências e 15 relatórios gerenciais.',
  },
  {
    id: 'global',
    label: 'Relatórios',
    group: 'gestao',
    iconName: 'BarChart3',
    implemented: true,
    description: 'Relatórios comparativos entre campanhas/nichos, métricas consolidadas e governança de dados.',
  },
  {
    id: 'productivity',
    label: 'Relatórios e Produtividade',
    group: 'gestao',
    iconName: 'Gauge',
    implemented: true,
    targetStageLabel: 'Etapa 6 — Inteligência & Produtividade',
    description:
      'Central gerencial consolidada com análises comerciais, financeiras, operacionais, carteira de clientes, projetos, redes sociais, produtividade e construtor personalizado.',
  },

  // SISTEMA
  {
    id: 'settings',
    label: 'Configurações',
    group: 'sistema',
    iconName: 'Settings',
    implemented: true,
    targetStageLabel: 'Etapa 7 — Governança & Sistema',
    description:
      'Perfil do administrador, identidade visual Premium Dark, preferências regionais, integrações, logs e backup.',
  },
  {
    id: 'ai_assistant',
    label: 'Assistente IA',
    group: 'sistema',
    iconName: 'Bot',
    implemented: true,
    targetStageLabel: 'Etapa 7 — Assistente IA Contextual',
    description:
      'Assistente conectado aos dados reais do Kaizen, sugestões inteligentes e ações assistidas com confirmação obrigatória.',
  },
  {
    id: 'automations',
    label: 'Automações',
    group: 'sistema',
    iconName: 'Zap',
    implemented: true,
    targetStageLabel: 'Etapa 7 — Regras & Automações',
    description:
      'Regras comerciais, operacionais e financeiras de monitoramento, alertas e rascunhos sob execução manual ou na abertura.',
  },
  {
    id: 'notifications',
    label: 'Notificações',
    group: 'sistema',
    iconName: 'Bell',
    implemented: true,
    targetStageLabel: 'Etapa 7 — Central de Notificações',
    description:
      'Alertas reais de leads, reuniões, tarefas, projetos e vencimentos financeiros com leitura controlada e deep links.',
  },
];

export interface RouteMeta {
  title: string;
  subtitle: string;
  groupLabel: string;
  breadcrumbs: { label: string; tab?: AppTab }[];
  implemented: boolean;
}

export function getRouteMeta(activeTab: AppTab): RouteMeta {
  if (activeTab === 'leads_list') {
    return {
      title: 'CRM — Lista de Leads',
      subtitle: 'Visão tabular completa com busca, filtros, paginação e ações rápidas.',
      groupLabel: 'COMERCIAL',
      breadcrumbs: [
        { label: 'Kaizen', tab: 'dashboard' },
        { label: 'Comercial' },
        { label: 'CRM', tab: 'kanban' },
        { label: 'Lista de Leads' },
      ],
      implemented: true,
    };
  }

  if (activeTab === 'importer') {
    return {
      title: 'CRM — Importador de Planilhas',
      subtitle: 'Importação CSV/Excel com deduplicação e filtragem por categoria.',
      groupLabel: 'COMERCIAL',
      breadcrumbs: [
        { label: 'Kaizen', tab: 'dashboard' },
        { label: 'Comercial' },
        { label: 'CRM', tab: 'kanban' },
        { label: 'Importador' },
      ],
      implemented: true,
    };
  }

  if (activeTab === 'kanban') {
    return {
      title: 'CRM & Pipeline Comercial',
      subtitle: 'Gestão sequencial de leads, prospecção ativa e fechamentos.',
      groupLabel: 'COMERCIAL',
      breadcrumbs: [
        { label: 'Kaizen', tab: 'dashboard' },
        { label: 'Comercial' },
        { label: 'CRM' },
      ],
      implemented: true,
    };
  }

  const item = NAVIGATION_ITEMS.find((i) => i.id === activeTab);
  if (!item) {
    return {
      title: 'Kaizen Gestão',
      subtitle: 'Sistema privado de gestão integrada da agência.',
      groupLabel: 'GERAL',
      breadcrumbs: [{ label: 'Kaizen', tab: 'dashboard' }],
      implemented: true,
    };
  }

  const group = NAVIGATION_GROUPS.find((g) => g.id === item.group);
  const groupLabel = group
    ? group.label.charAt(0) + group.label.slice(1).toLowerCase()
    : 'Geral';

  return {
    title: item.label,
    subtitle: item.description,
    groupLabel: group?.label || 'GERAL',
    breadcrumbs: [
      { label: 'Kaizen', tab: 'dashboard' },
      { label: groupLabel },
      { label: item.label },
    ],
    implemented: item.implemented,
  };
}
