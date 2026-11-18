import { FinancialPeriodPreset } from './finance';

export type AnalyticsPeriodPreset =
  | 'hoje'
  | 'ontem'
  | 'ultimos_7_dias'
  | 'ultimos_30_dias'
  | 'este_mes'
  | 'mes_anterior'
  | 'ultimos_90_dias'
  | 'este_semestre'
  | 'este_ano'
  | 'personalizado';

export const ANALYTICS_PERIOD_OPTIONS: {
  id: AnalyticsPeriodPreset;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'hoje', label: 'Hoje', shortLabel: 'Hoje' },
  { id: 'ontem', label: 'Ontem', shortLabel: 'Ontem' },
  { id: 'ultimos_7_dias', label: 'Últimos 7 dias', shortLabel: '7 dias' },
  { id: 'ultimos_30_dias', label: 'Últimos 30 dias', shortLabel: '30 dias' },
  { id: 'este_mes', label: 'Este mês', shortLabel: 'Este mês' },
  { id: 'mes_anterior', label: 'Mês anterior', shortLabel: 'Mês anterior' },
  { id: 'ultimos_90_dias', label: 'Últimos 3 meses (90 dias)', shortLabel: '3 meses' },
  { id: 'este_semestre', label: 'Este semestre', shortLabel: 'Semestre' },
  { id: 'este_ano', label: 'Este ano', shortLabel: 'Este ano' },
  { id: 'personalizado', label: 'Período personalizado', shortLabel: 'Personalizado' },
];

export function mapAnalyticsPresetToFinancialPreset(
  preset: AnalyticsPeriodPreset
): FinancialPeriodPreset {
  switch (preset) {
    case 'hoje':
    case 'este_mes':
    case 'mes_anterior':
    case 'ultimos_30_dias':
    case 'ultimos_90_dias':
    case 'este_semestre':
    case 'este_ano':
    case 'personalizado':
      return preset;
    case 'ontem':
    case 'ultimos_7_dias':
      // Financial engine resolves exact arbitrary windows via 'personalizado'
      return 'personalizado';
  }
}

export type AnalyticsSubTabId =
  | 'visao_geral'
  | 'comercial'
  | 'financeiro'
  | 'operacional'
  | 'clientes'
  | 'projetos'
  | 'redes_sociais'
  | 'produtividade'
  | 'personalizados';

export interface ResolvedAnalyticsPeriod {
  preset: AnalyticsPeriodPreset;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label: string;
  daysCount: number;
  granularity: 'diario' | 'semanal' | 'mensal';
  previousStartDate: string;
  previousEndDate: string;
  previousLabel: string;
}

export type CustomReportModuleId =
  | 'comercial_leads'
  | 'comercial_propostas'
  | 'financeiro_lancamentos'
  | 'financeiro_movimentacoes'
  | 'projetos'
  | 'tarefas'
  | 'clientes'
  | 'redes_sociais'
  | 'produtividade_atividades';

export interface CustomReportConfig {
  module: CustomReportModuleId;
  periodPreset: AnalyticsPeriodPreset;
  customStart?: string;
  customEnd?: string;
  clientId?: string;
  projectId?: string;
  nicheId?: string;
  categoryId?: string;
  statusFilter?: string;
  onlyOverdue?: boolean;
  includeCancelled?: boolean;
}

export interface SavedCustomReport {
  id: string;
  name: string;
  description?: string;
  config: CustomReportConfig;
  favorite?: boolean;
  lastRunAt?: string;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export interface AnalyticsPreferences {
  id: string;
  defaultPeriodPreset: AnalyticsPeriodPreset;
  favoriteKpis: string[];
  compactTables: boolean;
  showDataLimitationsNotice: boolean;
  preferredSubTab?: AnalyticsSubTabId;
  schemaVersion?: number;
  updatedAt?: string;
}

export const FAVORITE_KPI_CATALOG: {
  id: string;
  label: string;
  area: 'comercial' | 'financeiro' | 'operacional' | 'clientes' | 'social' | 'produtividade';
  description: string;
}[] = [
  {
    id: 'receita_realizada',
    label: 'Receita Realizada',
    area: 'financeiro',
    description: 'Entradas efetivamente recebidas no período (transações reais).',
  },
  {
    id: 'lucro_realizado',
    label: 'Lucro Realizado',
    area: 'financeiro',
    description: 'Resultado gerencial (recebimentos menos pagamentos no período).',
  },
  {
    id: 'contas_a_receber',
    label: 'Contas a Receber',
    area: 'financeiro',
    description: 'Saldo total em aberto a receber no momento.',
  },
  {
    id: 'inadimplencia',
    label: 'Inadimplência em Aberto',
    area: 'financeiro',
    description: 'Títulos vencidos em atraso aguardando baixa.',
  },
  {
    id: 'leads_periodo',
    label: 'Leads no Período',
    area: 'comercial',
    description: 'Novos leads cadastrados ou contatados no período selecionado.',
  },
  {
    id: 'taxa_fechamento',
    label: 'Conversão Comercial',
    area: 'comercial',
    description: 'Taxa de conversão com numerador e denominador explícitos.',
  },
  {
    id: 'propostas_aprovadas',
    label: 'Propostas Aprovadas / Assinadas',
    area: 'comercial',
    description: 'Volume e valor de propostas convertidas no período.',
  },
  {
    id: 'clientes_ativos',
    label: 'Clientes Ativos & Onboarding',
    area: 'clientes',
    description: 'Carteira ativa e receita mensal contratada (MRR).',
  },
  {
    id: 'projetos_ativos',
    label: 'Projetos Ativos',
    area: 'operacional',
    description: 'Projetos em andamento, revisão ou aguardando cliente.',
  },
  {
    id: 'tarefas_concluidas',
    label: 'Tarefas Concluídas no Período',
    area: 'operacional',
    description: 'Entregas operacionais finalizadas dentro da janela.',
  },
  {
    id: 'publicacoes_sociais',
    label: 'Publicações Realizadas',
    area: 'social',
    description: 'Itens de Redes Sociais confirmados manualmente como publicados.',
  },
  {
    id: 'dias_ativos',
    label: 'Consistência de Execução',
    area: 'produtividade',
    description: 'Dias com atividade real registrada no período.',
  },
];

export const DEFAULT_FAVORITE_KPI_IDS: string[] = [
  'receita_realizada',
  'lucro_realizado',
  'leads_periodo',
  'clientes_ativos',
  'projetos_ativos',
  'tarefas_concluidas',
];

export interface GeneratedAnalyticsReport {
  id: string;
  title: string;
  subtitle: string;
  moduleLabel: string;
  periodLabel: string;
  appliedFiltersSummary: string;
  generatedAtIso: string;
  summaryCards: { label: string; value: string; hint?: string }[];
  columns: string[];
  rows: string[][];
  totalsRow?: string[];
  emptyMessage: string;
  dataLimitationsNote?: string;
}

export interface ManagementInsight {
  id: string;
  severity: 'positive' | 'warning' | 'danger' | 'info';
  area: 'comercial' | 'financeiro' | 'operacional' | 'clientes' | 'social' | 'produtividade';
  title: string;
  evidence: string;
  sampleDescription: string;
  targetTab: 'kanban' | 'clients' | 'proposals' | 'projects' | 'tasks' | 'agenda' | 'social' | 'finance';
  actionLabel: string;
}

// ---------------------------------------------------------------------------
// ESTRUTURAS EXTENSÍVEIS FUTURAS (SEM DADOS FICTÍCIOS)
// ---------------------------------------------------------------------------

/**
 * Preparado para futura integração opcional de apontamento de horas em Tarefas/Projetos.
 * Enquanto não existir no sistema, os relatórios indicam explicitamente a ausência de timer.
 */
export interface TaskExecutionTimeRecord {
  taskId: string;
  projectId?: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes: number;
  notes?: string;
}

/**
 * Preparado para futura integração opcional com APIs oficiais de redes sociais (Meta/TikTok/LinkedIn).
 * Nunca preenchido com números fictícios.
 */
export interface ExternalSocialMetricsSnapshot {
  channelId: string;
  postId?: string;
  platform: string;
  capturedAt: string;
  followersCount?: number;
  reach?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
}
