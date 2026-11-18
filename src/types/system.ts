import { AppTab } from './crm';

export type SystemAppearanceMode = 'premium_dark';

export interface SystemAdminProfile {
  displayName: string;
  contactEmail: string;
  photoUrl?: string;
  agencyName: string;
  commercialPhone: string;
  websiteUrl?: string;
  issuerDocument?: string;
}

export interface SystemVisualIdentity {
  brandName: string;
  primaryLogoUrl?: string;
  compactLogoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  appearanceMode: SystemAppearanceMode;
}

export interface SystemRegionalSettings {
  currency: 'BRL';
  dateFormat: 'DD/MM/YYYY';
  timezone: 'America/Maceio';
  language: 'pt-BR';
}

export interface SystemOperationalPreferences {
  enableNotifications: boolean;
  notifyComercial: boolean;
  notifyOperacional: boolean;
  notifyFinanceiro: boolean;
  notifyAgenda: boolean;
  autoRunAutomationsOnOpen: boolean;
  showAssistantSuggestions: boolean;
}

export interface SystemSettings {
  id: string;
  adminProfile: SystemAdminProfile;
  visualIdentity: SystemVisualIdentity;
  regional: SystemRegionalSettings;
  preferences: SystemOperationalPreferences;
  schemaVersion?: number;
  updatedAt?: string;
}

export type NotificationCategory = 'comercial' | 'operacional' | 'financeiro' | 'agenda';
export type NotificationSeverity = 'info' | 'warning' | 'danger';

export interface SystemNotification {
  id: string;
  eventKey: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  targetTab: AppTab;
  entityType?: 'lead' | 'proposal' | 'project' | 'task' | 'agenda' | 'finance' | 'system';
  entityId?: string;
  dueLabel?: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
  readAt?: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export type AutomationCategory = 'comercial' | 'operacional' | 'financeiro';

export type AutomationRuleKey =
  | 'comm_stale_leads'
  | 'comm_due_callbacks'
  | 'comm_pending_proposals'
  | 'comm_whatsapp_followup_draft'
  | 'op_due_tasks'
  | 'op_at_risk_projects'
  | 'op_daily_summary'
  | 'op_weekly_summary'
  | 'fin_upcoming_payables'
  | 'fin_overdue_receivables'
  | 'fin_upcoming_recurrences';

export interface AutomationRuleSetting {
  id: string;
  key: AutomationRuleKey;
  name: string;
  description: string;
  category: AutomationCategory;
  enabled: boolean;
  triggerCondition: string;
  cadenceMode: 'manual_ou_ao_abrir';
  thresholdDays?: number;
  lastRunAt?: string;
  lastStatus?: 'sucesso' | 'sem_alertas' | 'erro';
  lastFindingsCount?: number;
  nextCheckNote: string;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export interface AutomationExecutionLog {
  id: string;
  ruleId: string;
  ruleName: string;
  category: AutomationCategory;
  triggerType: 'manual' | 'abertura_sistema';
  status: 'sucesso' | 'sem_alertas' | 'erro';
  findingsCount: number;
  summary: string;
  details?: string;
  executedAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export type AiMessageRole = 'user' | 'assistant';
export type AiProposedActionType =
  | 'create_task'
  | 'whatsapp_draft'
  | 'meeting_brief'
  | 'prioritize_note';
export type AiProposedActionStatus = 'pending' | 'confirmed' | 'cancelled';

export interface AiProposedAction {
  id: string;
  type: AiProposedActionType;
  title: string;
  description: string;
  status: AiProposedActionStatus;
  taskTitle?: string;
  taskDueDate?: string;
  taskPriority?: 'baixa' | 'media' | 'alta' | 'urgente';
  taskClientId?: string;
  taskProjectId?: string;
  targetName?: string;
  targetPhone?: string;
  draftText?: string;
}

export interface AiConversationMessage {
  id: string;
  role: AiMessageRole;
  content: string;
  createdAt: string;
  sources?: string[];
  dataLimitationsNote?: string;
  proposedAction?: AiProposedAction;
  error?: string;
}

export interface AiConversation {
  id: string;
  title: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  messages: AiConversationMessage[];
  schemaVersion?: number;
}

export type SystemLogLevel = 'info' | 'warning' | 'error';
export type SystemLogSource =
  | 'firestore'
  | 'auth'
  | 'gemini_ia'
  | 'automacoes'
  | 'notificacoes'
  | 'backup'
  | 'sistema';

export interface SystemLogEntry {
  id: string;
  level: SystemLogLevel;
  source: SystemLogSource;
  title: string;
  message: string;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export type IntegrationStatusValue = 'conectado' | 'nao_configurado' | 'indisponivel' | 'erro';

export interface IntegrationStatusItem {
  id: string;
  name: string;
  category: 'infraestrutura' | 'ia' | 'agenda' | 'mensageria' | 'email';
  status: IntegrationStatusValue;
  detail: string;
  limitationsNote?: string;
  checkedAt: string;
}
