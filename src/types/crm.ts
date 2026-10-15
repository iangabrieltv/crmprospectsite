export type FunnelStageId =
  | 'leads_sem_contato'
  | 'primeiro_contato'
  | 'nao_atendida'
  | 'follow_up_1'
  | 'follow_up_2'
  | 'reuniao_marcada'
  | 'fechado'
  // Legacy aliases supported for existing leads migration:
  | 'nao_iniciada'
  | 'mockup_enviado'
  | 'nao_respondida'
  | 'nao_tem_contato'
  | 'interessado'
  | 'nao_interessado';

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
    id: 'leads_sem_contato',
    name: '1. Leads sem Contato',
    shortName: 'Sem Contato',
    order: 1,
    description: 'Leads cadastrados ou importados aguardando primeiro contato.',
    colorBadge: 'bg-slate-100 text-slate-700',
    borderAccent: 'border-l-slate-400',
  },
  {
    id: 'primeiro_contato',
    name: '2. Primeiro Contato',
    shortName: '1º Contato',
    order: 2,
    description: 'Primeira mensagem ou abordagem inicial realizada no WhatsApp.',
    colorBadge: 'bg-blue-50 text-blue-700',
    borderAccent: 'border-l-blue-500',
  },
  {
    id: 'nao_atendida',
    name: '3. Não Atendida',
    shortName: 'Não Atendida',
    order: 3,
    description: 'Mensagem sem resposta, ligação não atendida ou contato não completado.',
    colorBadge: 'bg-amber-50 text-amber-700',
    borderAccent: 'border-l-amber-500',
  },
  {
    id: 'follow_up_1',
    name: '4. Follow-up 1',
    shortName: 'Follow 1',
    order: 4,
    description: 'Primeiro lembrete/toque estratégico enviado após 24h a 48h.',
    colorBadge: 'bg-purple-50 text-purple-700',
    borderAccent: 'border-l-purple-500',
  },
  {
    id: 'follow_up_2',
    name: '5. Follow-up 2',
    shortName: 'Follow 2',
    order: 5,
    description: 'Segundo toque ou follow-up direto com pergunta clara.',
    colorBadge: 'bg-indigo-50 text-indigo-700',
    borderAccent: 'border-l-indigo-500',
  },
  {
    id: 'reuniao_marcada',
    name: '6. Reunião Marcada',
    shortName: 'Reunião Marcada',
    order: 6,
    description: 'Demonstração rápida ou reunião de 10 minutos agendada com o cliente.',
    colorBadge: 'bg-emerald-50 text-emerald-700',
    borderAccent: 'border-l-emerald-500',
  },
  {
    id: 'fechado',
    name: '7. Fechado',
    shortName: 'Fechado',
    order: 7,
    description: 'Contrato fechado! Valor de criação e mensalidade ativados.',
    colorBadge: 'bg-green-100 text-green-800 font-semibold',
    borderAccent: 'border-l-green-600',
  },
];

/**
 * Normaliza qualquer stage antigo para a nova sequência de 7 etapas
 */
export function normalizeStageId(stage: string | undefined): FunnelStageId {
  if (!stage) return 'leads_sem_contato';
  switch (stage) {
    case 'nao_iniciada':
    case 'nao_tem_contato':
    case 'leads_sem_contato':
      return 'leads_sem_contato';
    case 'primeiro_contato':
      return 'primeiro_contato';
    case 'nao_atendida':
    case 'nao_respondida':
    case 'nao_interessado':
      return 'nao_atendida';
    case 'follow_up_1':
      return 'follow_up_1';
    case 'follow_up_2':
    case 'mockup_enviado':
      return 'follow_up_2';
    case 'reuniao_marcada':
    case 'interessado':
      return 'reuniao_marcada';
    case 'fechado':
      return 'fechado';
    default:
      return 'leads_sem_contato';
  }
}

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
  // Agenda & Reunião Marcada
  meetingDate?: string; // YYYY-MM-DD (ex: "2026-10-15")
  meetingTime?: string; // HH:MM (ex: "10:00", "14:30")
  meetingNotes?: string; // Observações da reunião (o que tem, o que fazer, pauta)
  meetingLink?: string; // Link da sala de videochamada (Google Meet / Zoom / WhatsApp)
  meetingStatus?: 'agendada' | 'realizada' | 'remarcada' | 'cancelada';
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

export type AppTab = 'kanban' | 'dashboard' | 'agenda' | 'scripts' | 'importer' | 'global';
