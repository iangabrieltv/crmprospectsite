export type FinancialKind = 'receita' | 'despesa';

export type FinancialReceivableStatus =
  | 'prevista'
  | 'pendente'
  | 'parcialmente_recebida'
  | 'recebida'
  | 'atrasada'
  | 'cancelada';

export type FinancialPayableStatus =
  | 'prevista'
  | 'pendente'
  | 'parcialmente_paga'
  | 'paga'
  | 'atrasada'
  | 'cancelada';

export type FinancialEntryStatus =
  | FinancialReceivableStatus
  | FinancialPayableStatus;

export type FinancialPaymentMethod =
  | 'pix'
  | 'dinheiro'
  | 'transferencia_bancaria'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'boleto'
  | 'outro';

export type FinancialRecurrenceFrequency =
  | 'semanal'
  | 'mensal'
  | 'bimestral'
  | 'trimestral'
  | 'semestral'
  | 'anual'
  | 'personalizada';

export type FinancialRecurrenceStatus = 'ativa' | 'pausada' | 'encerrada';

export type FinancialTransactionKind =
  | 'recebimento'
  | 'pagamento'
  | 'estorno'
  | 'ajuste';

export type FinancialPeriodPreset =
  | 'hoje'
  | 'esta_semana'
  | 'este_mes'
  | 'mes_anterior'
  | 'ultimos_30_dias'
  | 'ultimos_90_dias'
  | 'este_trimestre'
  | 'este_semestre'
  | 'este_ano'
  | 'personalizado';

export type CashFlowGranularity = 'diario' | 'semanal' | 'mensal' | 'anual';

export type FinancialSubViewId =
  | 'visao_geral'
  | 'receitas'
  | 'despesas'
  | 'contas_a_receber'
  | 'contas_a_pagar'
  | 'fluxo_de_caixa'
  | 'recorrencias'
  | 'categorias'
  | 'relatorios'
  | 'configuracoes';

export type FinancialReportId =
  | 'receitas_periodo'
  | 'despesas_periodo'
  | 'lucro_realizado'
  | 'resultado_previsto'
  | 'fluxo_de_caixa'
  | 'receitas_cliente'
  | 'receitas_servico'
  | 'despesas_categoria'
  | 'contas_a_receber'
  | 'contas_a_pagar'
  | 'inadimplencia'
  | 'receitas_recorrentes'
  | 'despesas_recorrentes'
  | 'resultado_projeto'
  | 'comparativo_mensal';

export interface FinancialEntry {
  id: string;
  kind: FinancialKind;
  description: string;
  clientId?: string;
  supplierName?: string;
  serviceName?: string;
  projectId?: string;
  proposalId?: string;
  contractCode?: string;
  categoryId: string;
  recurrenceId?: string;
  recurrencePeriodKey?: string;
  installmentIndex?: number;
  installmentTotal?: number;
  /** Valor original total em centavos inteiros (ex: R$ 1.250,00 = 125000) */
  amountCents: number;
  /** Total líquido efetivamente recebido/pago em centavos via transações reais */
  settledCents: number;
  /** Acréscimos ou descontos explícitos registrados após criação, em centavos */
  adjustmentCents?: number;
  /** Data de competência (YYYY-MM-DD) */
  competenceDate: string;
  /** Data de vencimento (YYYY-MM-DD) */
  dueDate: string;
  /** Última data efetiva de recebimento/pagamento (YYYY-MM-DD) */
  lastSettledDate?: string;
  paymentMethod: FinancialPaymentMethod;
  status: FinancialEntryStatus;
  attachmentUrl?: string;
  notes?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export interface FinancialTransaction {
  id: string;
  entryId: string;
  entryKind: FinancialKind;
  kind: FinancialTransactionKind;
  /** Valor movimentado em centavos (sempre positivo; estornos subtraem no cálculo líquido) */
  amountCents: number;
  /** Data efetiva da movimentação de caixa (YYYY-MM-DD) */
  date: string;
  paymentMethod: FinancialPaymentMethod;
  notes?: string;
  createdBy: string;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export interface FinancialCategory {
  id: string;
  name: string;
  kind: FinancialKind;
  description?: string;
  active: boolean;
  isDefault?: boolean;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export interface FinancialRecurrence {
  id: string;
  name: string;
  kind: FinancialKind;
  amountCents: number;
  categoryId: string;
  clientId?: string;
  supplierName?: string;
  serviceName?: string;
  projectId?: string;
  proposalId?: string;
  paymentMethod: FinancialPaymentMethod;
  frequency: FinancialRecurrenceFrequency;
  customIntervalDays?: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  nextOccurrenceDate: string; // YYYY-MM-DD
  status: FinancialRecurrenceStatus;
  notes?: string;
  lastGeneratedAt?: string;
  lastGeneratedPeriodKey?: string;
  lastError?: string;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export interface OpeningBalanceSnapshot {
  date: string; // YYYY-MM-DD
  amountCents: number;
  description: string;
  changedAt: string;
  changedBy: string;
}

export interface PaymentMethodConfig {
  id: FinancialPaymentMethod;
  label: string;
  active: boolean;
}

export interface FinancialSettings {
  id: string; // 'default'
  companyName: string;
  currency: 'BRL';
  dateFormat: 'DD/MM/YYYY';
  timezone: string; // 'America/Maceio'
  openingBalanceCents: number;
  openingBalanceDate: string; // YYYY-MM-DD
  openingBalanceDescription: string;
  openingBalanceNotes?: string;
  openingBalanceHistory: OpeningBalanceSnapshot[];
  paymentMethods: PaymentMethodConfig[];
  alertDaysAhead: number;
  defaultDueDay: number;
  schemaVersion?: number;
  updatedAt: string;
}

export type FinancialAuditAction =
  | 'criacao'
  | 'edicao'
  | 'recebimento'
  | 'pagamento'
  | 'estorno'
  | 'ajuste'
  | 'vencimento_alterado'
  | 'cancelamento'
  | 'recorrencia_gerada'
  | 'recorrencia_status'
  | 'configuracao_alterada'
  | 'integracao_proposta';

export interface FinancialAuditLog {
  id: string;
  entityType:
    | 'entry'
    | 'transaction'
    | 'category'
    | 'recurrence'
    | 'settings';
  entityId: string;
  action: FinancialAuditAction;
  description: string;
  amountCents?: number;
  actor: string;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export const FINANCIAL_PAYMENT_METHOD_OPTIONS: {
  id: FinancialPaymentMethod;
  label: string;
}[] = [
  { id: 'pix', label: 'Pix' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'transferencia_bancaria', label: 'Transferência bancária' },
  { id: 'cartao_credito', label: 'Cartão de crédito' },
  { id: 'cartao_debito', label: 'Cartão de débito' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'outro', label: 'Outro' },
];

export const FINANCIAL_RECURRENCE_FREQUENCY_OPTIONS: {
  id: FinancialRecurrenceFrequency;
  label: string;
}[] = [
  { id: 'semanal', label: 'Semanal' },
  { id: 'mensal', label: 'Mensal' },
  { id: 'bimestral', label: 'Bimestral' },
  { id: 'trimestral', label: 'Trimestral' },
  { id: 'semestral', label: 'Semestral' },
  { id: 'anual', label: 'Anual' },
  { id: 'personalizada', label: 'Personalizada (dias)' },
];

export const FINANCIAL_PERIOD_OPTIONS: {
  id: FinancialPeriodPreset;
  label: string;
}[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'esta_semana', label: 'Esta semana' },
  { id: 'este_mes', label: 'Este mês' },
  { id: 'mes_anterior', label: 'Mês anterior' },
  { id: 'ultimos_30_dias', label: 'Últimos 30 dias' },
  { id: 'ultimos_90_dias', label: 'Últimos 90 dias' },
  { id: 'este_trimestre', label: 'Este trimestre' },
  { id: 'este_semestre', label: 'Este semestre' },
  { id: 'este_ano', label: 'Este ano' },
  { id: 'personalizado', label: 'Personalizado' },
];

export const FINANCIAL_SUBVIEWS: {
  id: FinancialSubViewId;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'visao_geral', label: 'Visão Geral', shortLabel: 'Visão Geral' },
  { id: 'receitas', label: 'Receitas', shortLabel: 'Receitas' },
  { id: 'despesas', label: 'Despesas', shortLabel: 'Despesas' },
  {
    id: 'contas_a_receber',
    label: 'Contas a Receber',
    shortLabel: 'A Receber',
  },
  { id: 'contas_a_pagar', label: 'Contas a Pagar', shortLabel: 'A Pagar' },
  { id: 'fluxo_de_caixa', label: 'Fluxo de Caixa', shortLabel: 'Fluxo de Caixa' },
  { id: 'recorrencias', label: 'Recorrências', shortLabel: 'Recorrências' },
  { id: 'categorias', label: 'Categorias', shortLabel: 'Categorias' },
  { id: 'relatorios', label: 'Relatórios', shortLabel: 'Relatórios' },
  { id: 'configuracoes', label: 'Configurações', shortLabel: 'Configurações' },
];

export const FINANCIAL_ENTRY_STATUS_META: Record<
  FinancialEntryStatus,
  {
    label: string;
    variant: 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'accent';
  }
> = {
  prevista: { label: 'Prevista', variant: 'neutral' },
  pendente: { label: 'Pendente', variant: 'info' },
  parcialmente_recebida: { label: 'Parcialmente recebida', variant: 'warning' },
  parcialmente_paga: { label: 'Parcialmente paga', variant: 'warning' },
  recebida: { label: 'Recebida', variant: 'success' },
  paga: { label: 'Paga', variant: 'success' },
  atrasada: { label: 'Atrasada', variant: 'danger' },
  cancelada: { label: 'Cancelada', variant: 'neutral' },
};

export function getPaymentMethodLabel(method: FinancialPaymentMethod): string {
  return (
    FINANCIAL_PAYMENT_METHOD_OPTIONS.find((m) => m.id === method)?.label ||
    'Outro'
  );
}

export function getRecurrenceFrequencyLabel(
  freq: FinancialRecurrenceFrequency,
  customDays?: number
): string {
  if (freq === 'personalizada' && customDays) {
    return `A cada ${customDays} dia(s)`;
  }
  return (
    FINANCIAL_RECURRENCE_FREQUENCY_OPTIONS.find((f) => f.id === freq)?.label ||
    freq
  );
}
