export type FunnelStageId =
  | 'nao_iniciada'
  | 'primeiro_contato'
  | 'nao_respondida'
  | 'follow_up_1'
  | 'follow_up_2'
  | 'interessado'
  | 'nao_interessado'
  | 'fechado';

export interface FunnelStageConfig {
  id: FunnelStageId;
  name: string;
  shortName: string;
  order: number;
  description: string;
  colorBadge: string;
  borderAccent: string;
}

export const FUNNEL_STAGES: FunnelStageConfig[] = [
  {
    id: 'nao_iniciada',
    name: '1. Não Iniciada',
    shortName: 'Novo Lead',
    order: 1,
    description: 'Lead novo cadastrado, ainda sem contato inicial.',
    colorBadge: 'bg-slate-100 text-slate-700',
    borderAccent: 'border-l-slate-400',
  },
  {
    id: 'primeiro_contato',
    name: '2. Primeiro Contato',
    shortName: 'Mensagem Enviada',
    order: 2,
    description: 'Primeira mensagem ou ligação realizada.',
    colorBadge: 'bg-blue-50 text-blue-700',
    borderAccent: 'border-l-blue-500',
  },
  {
    id: 'nao_respondida',
    name: '3. Não Respondida',
    shortName: 'Sem Resposta',
    order: 3,
    description: 'Mensagem entregue/lida mas ainda sem retorno.',
    colorBadge: 'bg-amber-50 text-amber-700',
    borderAccent: 'border-l-amber-500',
  },
  {
    id: 'follow_up_1',
    name: '4. Follow-up 1',
    shortName: 'Follow 1',
    order: 4,
    description: 'Primeiro lembrete/toque após 24-48 horas.',
    colorBadge: 'bg-purple-50 text-purple-700',
    borderAccent: 'border-l-purple-500',
  },
  {
    id: 'follow_up_2',
    name: '5. Follow-up 2',
    shortName: 'Follow 2 (Último)',
    order: 5,
    description: 'Segunda tentativa de reativação com quebra de objeção.',
    colorBadge: 'bg-indigo-50 text-indigo-700',
    borderAccent: 'border-l-indigo-500',
  },
  {
    id: 'interessado',
    name: '6. Interessado',
    shortName: 'Proposta / Demo',
    order: 6,
    description: 'Pediu orçamento, demonstrou interesse ou agendou demo.',
    colorBadge: 'bg-emerald-50 text-emerald-700',
    borderAccent: 'border-l-emerald-500',
  },
  {
    id: 'nao_interessado',
    name: '7. Não Interessado',
    shortName: 'Objeção Registrada',
    order: 7,
    description: 'Recusou no momento. Objeção catalogada para feedback.',
    colorBadge: 'bg-rose-50 text-rose-700',
    borderAccent: 'border-l-rose-400',
  },
  {
    id: 'fechado',
    name: '8. Fechado',
    shortName: 'Cliente Ativo',
    order: 8,
    description: 'Contrato fechado! Valor de criação e MRR faturados.',
    colorBadge: 'bg-green-100 text-green-800 font-semibold',
    borderAccent: 'border-l-green-600',
  },
];

export type ScriptId = string;

export interface ScriptObjection {
  id: string;
  trigger: string;
  title: string;
  response: string;
}

export interface ScriptStructure {
  hook: string;
  problem: string;
  solution: string;
  cta: string;
}

export interface ScriptSubStep {
  id: string;
  title: string;
  condition?: string;
  message: string;
  tip?: string;
}

export interface ScriptStageBlock {
  id: string;
  stageTitle: string;
  description?: string;
  steps: ScriptSubStep[];
}

export interface ScriptDefinition {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category?: string;
  goldenRule?: {
    order: string;
    primaryGoal: string;
    insight: string;
  };
  stages?: ScriptStageBlock[];
  structure: ScriptStructure;
  template: string;
  followUp1: string;
  followUp2: string;
  objections: ScriptObjection[];
}

export interface LeadNote {
  id: string;
  date: string;
  text: string;
  author?: string;
}

export interface Lead {
  id: string;
  nicheId: string;
  companyName: string;
  contactName?: string;
  phone: string;
  displayPhone: string;
  address?: string;
  city: string;
  googleRating?: number;
  googleReviewsCount?: number;
  mockupUrl?: string;
  stage: FunnelStageId;
  scriptUsed: ScriptId;
  creationValue?: number;
  monthlyMrr?: number;
  lastContactDate?: string;
  notes: LeadNote[];
  objection?: string;
  createdAt: string;
  aiPitch?: string;
  opportunityAngle?: string;
}

export interface NicheCampaign {
  id: string;
  name: string;
  segment: string;
  city: string;
  emoji: string;
  targetMrr: number;
  createdAt: string;
  scripts: Record<string, ScriptDefinition>;
}

export type AppTab = 'kanban' | 'dashboard' | 'scripts' | 'importer' | 'global';
