export type ClientStatus = 'onboarding' | 'ativo' | 'pausado' | 'encerrado';

export interface ClientTimelineEvent {
  id: string;
  date: string; // ISO-8601
  type:
    | 'criacao'
    | 'conversao_lead'
    | 'proposta_vinculada'
    | 'contrato_assinado'
    | 'status_alterado'
    | 'reuniao_agendada'
    | 'projeto_vinculado'
    | 'anotacao'
    | 'edicao';
  title: string;
  description?: string;
  author?: string;
}

export interface Client {
  id: string;
  originLeadId?: string;
  originNicheId?: string;
  companyName: string;
  contactName?: string;
  document?: string;
  email?: string;
  phone: string;
  displayPhone: string;
  city?: string;
  address?: string;
  segment?: string;
  websiteUrl?: string;
  domainName?: string;
  hostingProvider?: string;
  status: ClientStatus;
  setupValue?: number;
  monthlyMrr?: number;
  billingDay?: number;
  contractStartDate?: string; // YYYY-MM-DD
  contractRenewalDate?: string; // YYYY-MM-DD
  serviceScope?: string;
  socialManagementEnabled?: boolean;
  notes?: string;
  timeline: ClientTimelineEvent[];
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export type DocumentKind = 'proposta' | 'contrato';

export type ProposalStatus =
  | 'rascunho'
  | 'enviada'
  | 'em_negociacao'
  | 'aprovada'
  | 'assinada'
  | 'recusada'
  | 'expirada';

export interface ProposalLineItem {
  id: string;
  title: string;
  description?: string;
  billingType: 'setup' | 'mensal' | 'pontual';
  quantity: number;
  unitPrice: number;
}

export interface ProposalHistoryEvent {
  id: string;
  date: string; // ISO-8601
  status?: ProposalStatus;
  title: string;
  note?: string;
  author?: string;
}

export interface ProposalContract {
  id: string;
  code: string;
  kind: DocumentKind;
  title: string;
  status: ProposalStatus;
  clientId?: string;
  leadId?: string;
  recipientCompany: string;
  recipientContact?: string;
  recipientDocument?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientCity?: string;
  issuerName: string;
  issuerDocument?: string;
  summary?: string;
  items: ProposalLineItem[];
  discountValue?: number;
  setupTotal: number;
  monthlyMrr: number;
  deliveryDeadlineDays?: number;
  paymentTerms?: string;
  clausesText?: string;
  validUntil?: string; // YYYY-MM-DD
  sentAt?: string;
  approvedAt?: string;
  signedAt?: string;
  notes?: string;
  history: ProposalHistoryEvent[];
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// ETAPA 3 — PROJETOS
// ---------------------------------------------------------------------------

export type ProjectStatus =
  | 'nao_iniciado'
  | 'em_andamento'
  | 'em_revisao'
  | 'aguardando_cliente'
  | 'concluido'
  | 'pausado'
  | 'cancelado';

export type ProjectTemplateId =
  | 'kaizen_start'
  | 'kaizen_performance'
  | 'personalizado';

export type ProjectDocumentCategory =
  | 'briefing'
  | 'design'
  | 'acesso'
  | 'contrato'
  | 'entrega'
  | 'outro';

export interface ProjectDocumentLink {
  id: string;
  title: string;
  url: string;
  category?: ProjectDocumentCategory;
  addedAt: string;
}

export interface ProjectHistoryEvent {
  id: string;
  date: string; // ISO-8601
  type:
    | 'criacao'
    | 'status_alterado'
    | 'tarefa_concluida'
    | 'documento_adicionado'
    | 'observacao'
    | 'edicao'
    | 'conclusao_confirmada';
  title: string;
  description?: string;
  author?: string;
}

export interface ProjectPhase {
  id: string;
  label: string;
  rangeLabel?: string;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  proposalId?: string;
  serviceType: string;
  description?: string;
  templateId: ProjectTemplateId;
  status: ProjectStatus;
  ownerName: string;
  startDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  phases?: ProjectPhase[];
  documents: ProjectDocumentLink[];
  history: ProjectHistoryEvent[];
  notes?: string;
  completedAt?: string;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// ETAPA 3 — MINHAS TAREFAS (FONTE ÚNICA DE DADOS)
// ---------------------------------------------------------------------------

export type TaskPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export type TaskStatus =
  | 'a_fazer'
  | 'em_andamento'
  | 'em_revisao'
  | 'aguardando'
  | 'concluida';

export interface TaskChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  projectId?: string;
  clientId?: string;
  phaseLabel?: string;
  startDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  priority: TaskPriority;
  status: TaskStatus;
  checklist: TaskChecklistItem[];
  notes?: string;
  completedAt?: string;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// ETAPA 3 — AGENDA INTEGRADA
// ---------------------------------------------------------------------------

export type AgendaEventType =
  | 'reuniao_cliente'
  | 'reuniao_comercial'
  | 'prazo_entrega'
  | 'tarefa'
  | 'lembrete'
  | 'compromisso_interno'
  | 'outro';

export type AgendaEventStatus = 'agendado' | 'concluido' | 'cancelado';

export interface AgendaExternalSyncMeta {
  provider: 'google_calendar';
  status: 'not_connected' | 'pending_oauth';
  externalEventId?: string;
}

export interface AgendaEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  type: AgendaEventType;
  status: AgendaEventStatus;
  clientId?: string;
  leadId?: string;
  projectId?: string;
  taskId?: string;
  meetingLink?: string;
  notes?: string;
  externalSync?: AgendaExternalSyncMeta;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// ETAPA 3 — REDES SOCIAIS
// ---------------------------------------------------------------------------

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'outro';

export type SocialFormat =
  | 'post'
  | 'carrossel'
  | 'story'
  | 'reels'
  | 'video'
  | 'outro';

export type SocialPostStatus =
  | 'ideias'
  | 'planejamento'
  | 'producao'
  | 'revisao'
  | 'aprovado'
  | 'publicado';

export type SocialOwnerType = 'kaizen' | 'client';

export interface SocialChannel {
  id: string;
  ownerType: SocialOwnerType;
  clientId?: string;
  platform: SocialPlatform;
  customPlatformName?: string;
  handle: string;
  profileUrl?: string;
  active: boolean;
  notes?: string;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export interface SocialPost {
  id: string;
  title: string;
  ownerType: SocialOwnerType;
  clientId?: string;
  channelId?: string;
  platform: SocialPlatform;
  customPlatformName?: string;
  format: SocialFormat;
  plannedDate?: string; // YYYY-MM-DD
  plannedTime?: string; // HH:mm
  caption?: string;
  scriptText?: string;
  assetUrl?: string;
  assignee: string;
  status: SocialPostStatus;
  approvedAt?: string;
  publishedAt?: string;
  publishedConfirmedBy?: string;
  notes?: string;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// METADADOS DE STATUS & SELECTORS
// ---------------------------------------------------------------------------

export const CLIENT_STATUS_OPTIONS: {
  id: ClientStatus;
  label: string;
  variant: 'info' | 'success' | 'warning' | 'neutral';
  description: string;
}[] = [
  {
    id: 'onboarding',
    label: 'Em Onboarding',
    variant: 'info',
    description: 'Cliente recém-convertido em fase de briefing, setup ou implantação.',
  },
  {
    id: 'ativo',
    label: 'Ativo',
    variant: 'success',
    description: 'Operação regular com contrato vigente e recorrência ativa.',
  },
  {
    id: 'pausado',
    label: 'Pausado',
    variant: 'warning',
    description: 'Atendimento ou cobrança temporariamente suspensa.',
  },
  {
    id: 'encerrado',
    label: 'Encerrado',
    variant: 'neutral',
    description: 'Contrato concluído ou distrato registrado mantendo histórico.',
  },
];

export const PROPOSAL_STATUS_OPTIONS: {
  id: ProposalStatus;
  label: string;
  variant: 'neutral' | 'info' | 'warning' | 'success' | 'accent' | 'danger';
}[] = [
  { id: 'rascunho', label: 'Rascunho', variant: 'neutral' },
  { id: 'enviada', label: 'Enviada', variant: 'info' },
  { id: 'em_negociacao', label: 'Em negociação', variant: 'warning' },
  { id: 'aprovada', label: 'Aprovada', variant: 'success' },
  { id: 'assinada', label: 'Assinada', variant: 'accent' },
  { id: 'recusada', label: 'Recusada', variant: 'danger' },
  { id: 'expirada', label: 'Expirada', variant: 'neutral' },
];

export const PROJECT_STATUS_OPTIONS: {
  id: ProjectStatus;
  label: string;
  variant: 'neutral' | 'info' | 'warning' | 'success' | 'accent' | 'danger';
}[] = [
  { id: 'nao_iniciado', label: 'Não iniciado', variant: 'neutral' },
  { id: 'em_andamento', label: 'Em andamento', variant: 'info' },
  { id: 'em_revisao', label: 'Em revisão', variant: 'accent' },
  { id: 'aguardando_cliente', label: 'Aguardando cliente', variant: 'warning' },
  { id: 'concluido', label: 'Concluído', variant: 'success' },
  { id: 'pausado', label: 'Pausado', variant: 'warning' },
  { id: 'cancelado', label: 'Cancelado', variant: 'danger' },
];

export const TASK_STATUS_OPTIONS: {
  id: TaskStatus;
  label: string;
  variant: 'neutral' | 'info' | 'warning' | 'success' | 'accent';
}[] = [
  { id: 'a_fazer', label: 'A fazer', variant: 'neutral' },
  { id: 'em_andamento', label: 'Em andamento', variant: 'info' },
  { id: 'em_revisao', label: 'Em revisão', variant: 'accent' },
  { id: 'aguardando', label: 'Aguardando', variant: 'warning' },
  { id: 'concluida', label: 'Concluída', variant: 'success' },
];

export const TASK_PRIORITY_OPTIONS: {
  id: TaskPriority;
  label: string;
  variant: 'neutral' | 'info' | 'warning' | 'danger';
  weight: number;
}[] = [
  { id: 'baixa', label: 'Baixa', variant: 'neutral', weight: 1 },
  { id: 'media', label: 'Média', variant: 'info', weight: 2 },
  { id: 'alta', label: 'Alta', variant: 'warning', weight: 3 },
  { id: 'urgente', label: 'Urgente', variant: 'danger', weight: 4 },
];

export const AGENDA_EVENT_TYPE_OPTIONS: {
  id: AgendaEventType;
  label: string;
  variant: 'neutral' | 'info' | 'warning' | 'success' | 'accent' | 'danger';
}[] = [
  { id: 'reuniao_cliente', label: 'Reunião com cliente', variant: 'success' },
  { id: 'reuniao_comercial', label: 'Reunião comercial', variant: 'accent' },
  { id: 'prazo_entrega', label: 'Prazo de entrega', variant: 'danger' },
  { id: 'tarefa', label: 'Tarefa', variant: 'info' },
  { id: 'lembrete', label: 'Lembrete', variant: 'warning' },
  { id: 'compromisso_interno', label: 'Compromisso interno', variant: 'neutral' },
  { id: 'outro', label: 'Outro', variant: 'neutral' },
];

export const SOCIAL_PLATFORM_OPTIONS: {
  id: SocialPlatform;
  label: string;
}[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'outro', label: 'Outro canal' },
];

export const SOCIAL_FORMAT_OPTIONS: {
  id: SocialFormat;
  label: string;
}[] = [
  { id: 'post', label: 'Post' },
  { id: 'carrossel', label: 'Carrossel' },
  { id: 'story', label: 'Story' },
  { id: 'reels', label: 'Reels' },
  { id: 'video', label: 'Vídeo' },
  { id: 'outro', label: 'Outro' },
];

export const SOCIAL_POST_STATUS_OPTIONS: {
  id: SocialPostStatus;
  label: string;
  variant: 'neutral' | 'info' | 'warning' | 'success' | 'accent';
}[] = [
  { id: 'ideias', label: 'Ideias', variant: 'neutral' },
  { id: 'planejamento', label: 'Planejamento', variant: 'info' },
  { id: 'producao', label: 'Produção', variant: 'warning' },
  { id: 'revisao', label: 'Revisão', variant: 'accent' },
  { id: 'aprovado', label: 'Aprovado', variant: 'success' },
  { id: 'publicado', label: 'Publicado', variant: 'success' },
];

export function getClientStatusMeta(status: ClientStatus) {
  return (
    CLIENT_STATUS_OPTIONS.find((s) => s.id === status) || CLIENT_STATUS_OPTIONS[0]
  );
}

export function getProposalStatusMeta(status: ProposalStatus) {
  return (
    PROPOSAL_STATUS_OPTIONS.find((s) => s.id === status) ||
    PROPOSAL_STATUS_OPTIONS[0]
  );
}

export function getProjectStatusMeta(status: ProjectStatus) {
  return (
    PROJECT_STATUS_OPTIONS.find((s) => s.id === status) || PROJECT_STATUS_OPTIONS[0]
  );
}

export function getTaskStatusMeta(status: TaskStatus) {
  return TASK_STATUS_OPTIONS.find((s) => s.id === status) || TASK_STATUS_OPTIONS[0];
}

export function getTaskPriorityMeta(priority: TaskPriority) {
  return (
    TASK_PRIORITY_OPTIONS.find((p) => p.id === priority) || TASK_PRIORITY_OPTIONS[1]
  );
}

export function getAgendaEventTypeMeta(type: AgendaEventType) {
  return (
    AGENDA_EVENT_TYPE_OPTIONS.find((t) => t.id === type) ||
    AGENDA_EVENT_TYPE_OPTIONS[0]
  );
}

export function getSocialPlatformLabel(
  platform: SocialPlatform,
  customPlatformName?: string
): string {
  if (platform === 'outro' && customPlatformName?.trim()) {
    return customPlatformName.trim();
  }
  return (
    SOCIAL_PLATFORM_OPTIONS.find((p) => p.id === platform)?.label || 'Canal Social'
  );
}

export function getSocialFormatLabel(format: SocialFormat): string {
  return SOCIAL_FORMAT_OPTIONS.find((f) => f.id === format)?.label || 'Post';
}

export function getSocialPostStatusMeta(status: SocialPostStatus) {
  return (
    SOCIAL_POST_STATUS_OPTIONS.find((s) => s.id === status) ||
    SOCIAL_POST_STATUS_OPTIONS[0]
  );
}
