export type FunnelStageId =
  | 'nao_iniciada'
  | 'primeiro_contato'
  | 'mockup_enviado'
  | 'nao_respondida'
  | 'nao_tem_contato'
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
    shortName: '1º Contato',
    order: 2,
    description: 'Primeira mensagem ou abordagem inicial realizada.',
    colorBadge: 'bg-blue-50 text-blue-700',
    borderAccent: 'border-l-blue-500',
  },
  {
    id: 'mockup_enviado',
    name: '3. Mockup Enviado',
    shortName: 'Mockup',
    order: 3,
    description: 'Prévia interativa exclusiva enviada para o cliente.',
    colorBadge: 'bg-violet-50 text-violet-700',
    borderAccent: 'border-l-violet-500',
  },
  {
    id: 'follow_up_2',
    name: '4. Follow-up 2',
    shortName: 'Follow 2',
    order: 4,
    description: 'Para quem não respondeu após envio do mockup ou falou que ia falar com o responsável.',
    colorBadge: 'bg-indigo-50 text-indigo-700',
    borderAccent: 'border-l-indigo-500',
  },
  {
    id: 'nao_respondida',
    name: '5. Não Respondida',
    shortName: 'Sem Resposta',
    order: 5,
    description: 'Mensagem entregue/lida mas ainda sem retorno.',
    colorBadge: 'bg-amber-50 text-amber-700',
    borderAccent: 'border-l-amber-500',
  },
  {
    id: 'nao_tem_contato',
    name: '6. Não Tem Contato',
    shortName: 'Sem Contato',
    order: 6,
    description: 'Números que não conseguiu falar, sem WhatsApp ou inacessíveis.',
    colorBadge: 'bg-zinc-100 text-zinc-700',
    borderAccent: 'border-l-zinc-500',
  },
  {
    id: 'follow_up_1',
    name: '7. Follow-up 1',
    shortName: 'Follow 1',
    order: 7,
    description: 'Primeiro lembrete/toque após 24-48 horas.',
    colorBadge: 'bg-purple-50 text-purple-700',
    borderAccent: 'border-l-purple-500',
  },
  {
    id: 'interessado',
    name: '8. Interessado',
    shortName: 'Interessado',
    order: 8,
    description: 'Pediu orçamento, demonstrou interesse ou agendou demo.',
    colorBadge: 'bg-emerald-50 text-emerald-700',
    borderAccent: 'border-l-emerald-500',
  },
  {
    id: 'nao_interessado',
    name: '9. Não Interessado',
    shortName: 'Não Interessado',
    order: 9,
    description: 'Recusou no momento. Objeção catalogada para feedback.',
    colorBadge: 'bg-rose-50 text-rose-700',
    borderAccent: 'border-l-rose-400',
  },
  {
    id: 'fechado',
    name: '10. Fechado',
    shortName: 'Fechado',
    order: 10,
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
  format?: 'texto' | 'audio';
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
  followUp3?: string;
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
  category?: string;
  googleRating?: number;
  googleReviewsCount?: number;
  googleMapsUrl?: string;
  websiteUrl?: string;
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
  targetCities?: string[];
  emoji: string;
  targetMrr: number;
  createdAt: string;
  scripts: Record<string, ScriptDefinition>;
}

export interface ImportedSheet {
  id: string;
  name: string;
  nicheId: string;
  nicheName: string;
  importedAt: string;
  totalLeads: number;
  format?: string;
  size?: number;
  leadsSummary?: {
    companyName: string;
    phone: string;
    city?: string;
    category?: string;
  }[];
}

export type AppTab = 'kanban' | 'dashboard' | 'scripts' | 'importer' | 'global';
