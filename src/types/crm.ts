export type FunnelStageId =
  | 'leads_sem_contato'
  | 'primeiro_contato'
  | 'nao_atendida'
  | 'mandei_mensagem'
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
    name: '1. Leads Encontrados',
    shortName: 'Leads Encontrados',
    order: 1,
    description: 'Leads cadastrados ou importados da planilha aguardando abordagem inicial.',
    colorBadge: 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/25',
    borderAccent: 'border-t-zinc-500/60',
  },
  {
    id: 'primeiro_contato',
    name: '2. Primeiro Contato (Ligação)',
    shortName: '1ª Ligação',
    order: 2,
    description: 'Primeira ligação direta ou tentativa de contato inicial com o lead.',
    colorBadge: 'bg-sky-500/12 text-sky-300 border border-sky-500/25',
    borderAccent: 'border-t-sky-500/60',
  },
  {
    id: 'nao_atendida',
    name: '3. Não Atendida',
    shortName: 'Não Atendida',
    order: 3,
    description: 'Ligação não atendida, chamada ocupada ou caiu na caixa postal.',
    colorBadge: 'bg-amber-500/12 text-amber-300 border border-amber-500/25',
    borderAccent: 'border-t-amber-500/60',
  },
  {
    id: 'mandei_mensagem',
    name: '4. Mandei Mensagem',
    shortName: 'Mensagem',
    order: 4,
    description: 'Mensagem de WhatsApp enviada após a ligação não ser atendida.',
    colorBadge: 'bg-cyan-500/12 text-cyan-300 border border-cyan-500/25',
    borderAccent: 'border-t-cyan-500/60',
  },
  {
    id: 'follow_up_1',
    name: '5. Follow-up 1',
    shortName: 'Follow 1',
    order: 5,
    description: 'Primeiro lembrete/toque estratégico enviado após 24h a 48h da mensagem.',
    colorBadge: 'bg-violet-500/12 text-violet-300 border border-violet-500/25',
    borderAccent: 'border-t-violet-500/60',
  },
  {
    id: 'follow_up_2',
    name: '6. Follow-up 2',
    shortName: 'Follow 2',
    order: 6,
    description: 'Segundo toque ou follow-up direto com pergunta clara.',
    colorBadge: 'bg-indigo-500/12 text-indigo-300 border border-indigo-500/25',
    borderAccent: 'border-t-indigo-500/60',
  },
  {
    id: 'reuniao_marcada',
    name: '7. Reunião Marcada',
    shortName: 'Reunião',
    order: 7,
    description: 'Demonstração rápida ou reunião comercial agendada com o cliente.',
    colorBadge: 'bg-[#C6A15B]/15 text-[#D9BC7E] border border-[#C6A15B]/30',
    borderAccent: 'border-t-[#C6A15B]/70',
  },
  {
    id: 'fechado',
    name: '8. Fechamento',
    shortName: 'Fechamento',
    order: 8,
    description: 'Contrato fechado! Valor de criação e mensalidade ativados.',
    colorBadge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold',
    borderAccent: 'border-t-emerald-500/70',
  },
];

/**
 * Normaliza qualquer stage antigo para a nova sequência de 8 etapas
 */
export function normalizeStageId(stage: string | undefined): FunnelStageId {
  if (!stage) return 'leads_sem_contato';
  switch (stage) {
    case 'nao_iniciada':
    case 'nao_tem_contato':
    case 'leads_sem_contato':
    case 'leads_encontrados':
      return 'leads_sem_contato';
    case 'primeiro_contato':
    case 'primeira_ligacao':
      return 'primeiro_contato';
    case 'nao_atendida':
    case 'nao_respondida':
      return 'nao_atendida';
    case 'mandei_mensagem':
    case 'mensagem':
    case 'mensagem_enviada':
      return 'mandei_mensagem';
    case 'follow_up_1':
      return 'follow_up_1';
    case 'follow_up_2':
    case 'mockup_enviado':
      return 'follow_up_2';
    case 'reuniao_marcada':
    case 'interessado':
      return 'reuniao_marcada';
    case 'fechado':
    case 'fechamento':
      return 'fechado';
    case 'nao_interessado':
      return 'nao_atendida';
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
  // Agenda: Contatos que pediram para entrar em contato outra hora (Ligar mais tarde / Retorno)
  callbackDate?: string; // YYYY-MM-DD (ex: "2026-10-19")
  callbackTime?: string; // HH:MM (ex: "15:30")
  callbackNotes?: string; // Motivo/observação (ex: "Pediu para ligar às 15:30, ocupado no momento")
  callbackStatus?: 'pendente' | 'realizado' | 'cancelado';
  // Metadados retrocompatíveis para evolução segura de esquema e sincronização
  schemaVersion?: number;
  updatedAt?: string;
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
  schemaVersion?: number;
  updatedAt?: string;
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
  schemaVersion?: number;
  updatedAt?: string;
}

export type AppTab =
  | 'kanban'
  | 'leads_list'
  | 'dashboard'
  | 'agenda'
  | 'scripts'
  | 'importer'
  | 'global'
  | 'clients'
  | 'proposals'
  | 'projects'
  | 'tasks'
  | 'social'
  | 'documents'
  | 'templates'
  | 'finance'
  | 'productivity'
  | 'settings'
  | 'ai_assistant';

