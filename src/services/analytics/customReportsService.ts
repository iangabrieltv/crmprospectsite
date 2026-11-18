import { FUNNEL_STAGES, Lead, NicheCampaign, normalizeStageId } from '../../types/crm';
import {
  AgendaEvent,
  CLIENT_STATUS_OPTIONS,
  Client,
  PROJECT_STATUS_OPTIONS,
  PROPOSAL_STATUS_OPTIONS,
  Project,
  ProposalContract,
  SOCIAL_POST_STATUS_OPTIONS,
  SocialPost,
  TASK_STATUS_OPTIONS,
  Task,
  getClientStatusMeta,
  getProjectStatusMeta,
  getProposalStatusMeta,
  getSocialPlatformLabel,
  getSocialPostStatusMeta,
  getTaskPriorityMeta,
  getTaskStatusMeta,
} from '../../types/kaizen';
import {
  FINANCIAL_ENTRY_STATUS_META,
  FinancialCategory,
  FinancialEntry,
  FinancialSettings,
  FinancialTransaction,
  getPaymentMethodLabel,
} from '../../types/finance';
import { ResourceFile } from '../../types/resources';
import {
  CustomReportConfig,
  CustomReportModuleId,
  GeneratedAnalyticsReport,
  SavedCustomReport,
} from '../../types/analytics';
import {
  KAIZEN_TIMEZONE,
  formatBrlFromCents,
  formatDateBr,
  getTodayInTimezone,
  isValidYmd,
} from '../finance/money';
import { getCategoryName } from '../finance/categoriesService';
import {
  getEffectiveEntryStatus,
  getEntryAllowedTotalCents,
  getEntryPendingCents,
} from '../finance/entriesService';
import { getTransactionSignedCashCents } from '../finance/cashFlowService';
import { calculateProjectProgress } from '../projectService';
import { isTaskOverdue } from '../taskService';
import {
  extractLocalYmd,
  isDateInRange,
  resolveAnalyticsPeriod,
} from './periodService';
import { computeProductivityAnalytics } from './productivityAnalyticsService';

export interface CustomReportModuleDefinition {
  id: CustomReportModuleId;
  label: string;
  description: string;
  supportedFilters: {
    clientId: boolean;
    projectId: boolean;
    nicheId: boolean;
    categoryId: boolean;
    statusFilter: boolean;
    onlyOverdue: boolean;
    includeCancelled: boolean;
  };
  statusOptions: { id: string; label: string }[];
}

export const CUSTOM_REPORT_MODULE_OPTIONS: CustomReportModuleDefinition[] = [
  {
    id: 'comercial_leads',
    label: 'Comercial — Leads (CRM)',
    description: 'Lista filtrada de leads por nicho, etapa do funil e período de entrada.',
    supportedFilters: {
      clientId: false,
      projectId: false,
      nicheId: true,
      categoryId: false,
      statusFilter: true,
      onlyOverdue: false,
      includeCancelled: false,
    },
    statusOptions: FUNNEL_STAGES.map((s) => ({ id: s.id, label: s.name })),
  },
  {
    id: 'comercial_propostas',
    label: 'Comercial — Propostas e Contratos',
    description: 'Propostas e contratos emitidos no período por cliente e status.',
    supportedFilters: {
      clientId: true,
      projectId: false,
      nicheId: false,
      categoryId: false,
      statusFilter: true,
      onlyOverdue: false,
      includeCancelled: false,
    },
    statusOptions: PROPOSAL_STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
  },
  {
    id: 'financeiro_lancamentos',
    label: 'Financeiro — Lançamentos (Previsto / Aberto / Vencido)',
    description: 'Contas a receber e a pagar por cliente, projeto, categoria e vencimento.',
    supportedFilters: {
      clientId: true,
      projectId: true,
      nicheId: false,
      categoryId: true,
      statusFilter: true,
      onlyOverdue: true,
      includeCancelled: true,
    },
    statusOptions: [
      { id: 'receita', label: 'Somente Receitas' },
      { id: 'despesa', label: 'Somente Despesas' },
      { id: 'atrasada', label: 'Status: Atrasada' },
      { id: 'pendente', label: 'Status: Pendente / Prevista' },
      { id: 'recebida', label: 'Status: Recebida / Paga' },
    ],
  },
  {
    id: 'financeiro_movimentacoes',
    label: 'Financeiro — Movimentações Reais (Caixa)',
    description: 'Recebimentos, pagamentos e estornos efetivados no período.',
    supportedFilters: {
      clientId: true,
      projectId: true,
      nicheId: false,
      categoryId: true,
      statusFilter: true,
      onlyOverdue: false,
      includeCancelled: false,
    },
    statusOptions: [
      { id: 'receita', label: 'Entradas (Receitas)' },
      { id: 'despesa', label: 'Saídas (Despesas)' },
    ],
  },
  {
    id: 'projetos',
    label: 'Operacional — Projetos',
    description: 'Carteira de projetos por cliente, status, modelo e atraso.',
    supportedFilters: {
      clientId: true,
      projectId: false,
      nicheId: false,
      categoryId: false,
      statusFilter: true,
      onlyOverdue: true,
      includeCancelled: true,
    },
    statusOptions: PROJECT_STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
  },
  {
    id: 'tarefas',
    label: 'Operacional — Tarefas',
    description: 'Tarefas por cliente, projeto, status e vencimento no período.',
    supportedFilters: {
      clientId: true,
      projectId: true,
      nicheId: false,
      categoryId: false,
      statusFilter: true,
      onlyOverdue: true,
      includeCancelled: false,
    },
    statusOptions: TASK_STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
  },
  {
    id: 'clientes',
    label: 'Carteira — Clientes',
    description: 'Visão consolidada de clientes com status, MRR e cadastro no período.',
    supportedFilters: {
      clientId: false,
      projectId: false,
      nicheId: false,
      categoryId: false,
      statusFilter: true,
      onlyOverdue: false,
      includeCancelled: true,
    },
    statusOptions: CLIENT_STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
  },
  {
    id: 'redes_sociais',
    label: 'Marketing — Redes Sociais',
    description: 'Calendário e status editorial de publicações por cliente ou Kaizen.',
    supportedFilters: {
      clientId: true,
      projectId: false,
      nicheId: false,
      categoryId: false,
      statusFilter: true,
      onlyOverdue: true,
      includeCancelled: false,
    },
    statusOptions: SOCIAL_POST_STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
  },
  {
    id: 'produtividade_atividades',
    label: 'Produtividade — Histórico de Execução',
    description: 'Registro cronológico de ações reais concluídas nos módulos.',
    supportedFilters: {
      clientId: true,
      projectId: false,
      nicheId: false,
      categoryId: false,
      statusFilter: true,
      onlyOverdue: false,
      includeCancelled: false,
    },
    statusOptions: [
      { id: 'tarefas', label: 'Tarefas' },
      { id: 'projetos', label: 'Projetos' },
      { id: 'comercial', label: 'CRM / Comercial' },
      { id: 'propostas', label: 'Propostas & Contratos' },
      { id: 'agenda', label: 'Agenda' },
      { id: 'social', label: 'Redes Sociais' },
      { id: 'financeiro', label: 'Financeiro' },
      { id: 'materiais', label: 'Materiais' },
    ],
  },
];

export function getCustomReportModuleDef(
  moduleId: CustomReportModuleId
): CustomReportModuleDefinition {
  return (
    CUSTOM_REPORT_MODULE_OPTIONS.find((m) => m.id === moduleId) ||
    CUSTOM_REPORT_MODULE_OPTIONS[0]
  );
}

/**
 * Valida combinações incompatíveis de filtros antes da execução/salvamento,
 * garantindo que o usuário nunca gere relatórios inconsistentes ou sem sentido semântico.
 */
export function validateCustomReportConfig(config: CustomReportConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const def = getCustomReportModuleDef(config.module);

  if (config.periodPreset === 'personalizado') {
    if (config.customStart && !isValidYmd(config.customStart)) {
      errors.push('Data inicial personalizada inválida.');
    }
    if (config.customEnd && !isValidYmd(config.customEnd)) {
      errors.push('Data final personalizada inválida.');
    }
    if (
      config.customStart &&
      config.customEnd &&
      isValidYmd(config.customStart) &&
      isValidYmd(config.customEnd) &&
      config.customStart > config.customEnd
    ) {
      errors.push('A data inicial não pode ser maior que a data final.');
    }
  }

  if (config.nicheId && !def.supportedFilters.nicheId) {
    errors.push(
      `O filtro de Nicho/Campanha não é compatível com o módulo "${def.label}".`
    );
  }
  if (config.categoryId && !def.supportedFilters.categoryId) {
    errors.push(
      `O filtro de Categoria Financeira só pode ser usado nos módulos Financeiros.`
    );
  }
  if (config.clientId && !def.supportedFilters.clientId) {
    errors.push(
      `O filtro de Cliente específico não se aplica ao módulo "${def.label}".`
    );
  }
  if (config.projectId && !def.supportedFilters.projectId) {
    errors.push(
      `O filtro de Projeto específico não se aplica ao módulo "${def.label}".`
    );
  }
  if (config.onlyOverdue && !def.supportedFilters.onlyOverdue) {
    errors.push(
      `O filtro "Somente atrasados" não se aplica ao módulo "${def.label}".`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function sanitizeConfigForModule(
  config: CustomReportConfig,
  nextModule: CustomReportModuleId
): CustomReportConfig {
  const def = getCustomReportModuleDef(nextModule);
  return {
    module: nextModule,
    periodPreset: config.periodPreset,
    customStart: config.customStart,
    customEnd: config.customEnd,
    clientId: def.supportedFilters.clientId ? config.clientId : undefined,
    projectId: def.supportedFilters.projectId ? config.projectId : undefined,
    nicheId: def.supportedFilters.nicheId ? config.nicheId : undefined,
    categoryId: def.supportedFilters.categoryId ? config.categoryId : undefined,
    statusFilter: undefined,
    onlyOverdue: def.supportedFilters.onlyOverdue ? config.onlyOverdue : false,
    includeCancelled: def.supportedFilters.includeCancelled
      ? config.includeCancelled
      : false,
  };
}

export function createSavedCustomReportRecord(params: {
  id?: string;
  name: string;
  description?: string;
  config: CustomReportConfig;
  favorite?: boolean;
}): SavedCustomReport {
  const trimmedName = params.name.trim();
  if (!trimmedName) {
    throw new Error('Informe um nome para salvar o relatório personalizado.');
  }
  const validation = validateCustomReportConfig(params.config);
  if (!validation.valid) {
    throw new Error(validation.errors[0]);
  }
  const now = new Date().toISOString();
  const rnd = Math.random().toString(36).slice(2, 7);
  return {
    id: params.id || `creport-${Date.now()}-${rnd}`,
    name: trimmedName,
    description: params.description?.trim() || undefined,
    config: params.config,
    favorite: Boolean(params.favorite),
    lastRunAt: now,
    createdAt: now,
    schemaVersion: 1,
    updatedAt: now,
  };
}

export function generateCustomReport(params: {
  config: CustomReportConfig;
  reportTitle?: string;
  leads: Lead[];
  niches: NicheCampaign[];
  clients: Client[];
  proposals: ProposalContract[];
  projects: Project[];
  tasks: Task[];
  agendaEvents: AgendaEvent[];
  socialPosts: SocialPost[];
  financialEntries: FinancialEntry[];
  financialTransactions: FinancialTransaction[];
  financialCategories: FinancialCategory[];
  financialSettings: FinancialSettings;
  resourceFiles: ResourceFile[];
  todayStr?: string;
  timezone?: string;
}): GeneratedAnalyticsReport {
  const {
    config,
    leads,
    niches,
    clients,
    proposals,
    projects,
    tasks,
    agendaEvents,
    socialPosts,
    financialEntries,
    financialTransactions,
    financialCategories,
    financialSettings,
    resourceFiles,
    timezone = financialSettings.timezone || KAIZEN_TIMEZONE,
    todayStr = getTodayInTimezone(timezone),
  } = params;

  const validation = validateCustomReportConfig(config);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  const def = getCustomReportModuleDef(config.module);
  const period = resolveAnalyticsPeriod({
    preset: config.periodPreset,
    customStart: config.customStart,
    customEnd: config.customEnd,
    referenceYmd: todayStr,
    timezone,
  });

  const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));
  const nicheMap = new Map(niches.map((n) => [n.id, n.name]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  const filterTags: string[] = [`Período: ${period.label}`];
  if (config.clientId) {
    filterTags.push(`Cliente: ${clientMap.get(config.clientId) || config.clientId}`);
  }
  if (config.projectId) {
    filterTags.push(`Projeto: ${projectMap.get(config.projectId) || config.projectId}`);
  }
  if (config.nicheId) {
    filterTags.push(`Campanha: ${nicheMap.get(config.nicheId) || config.nicheId}`);
  }
  if (config.categoryId) {
    filterTags.push(`Categoria: ${getCategoryName(financialCategories, config.categoryId)}`);
  }
  if (config.statusFilter) {
    const stLabel =
      def.statusOptions.find((s) => s.id === config.statusFilter)?.label || config.statusFilter;
    filterTags.push(`Filtro/Status: ${stLabel}`);
  }
  if (config.onlyOverdue) filterTags.push('Somente atrasados');

  const appliedFiltersSummary = filterTags.join(' · ');
  const generatedAtIso = new Date().toISOString();
  const title = params.reportTitle?.trim() || def.label;

  switch (config.module) {
    case 'comercial_leads': {
      const filtered = leads.filter((l) => {
        if (!isDateInRange(l.createdAt, period.startDate, period.endDate, timezone)) {
          return false;
        }
        if (config.nicheId && l.nicheId !== config.nicheId) return false;
        if (config.statusFilter && normalizeStageId(l.stage) !== config.statusFilter) {
          return false;
        }
        return true;
      });
      const totalCreation = filtered.reduce((s, l) => s + (Number(l.creationValue) || 0), 0);
      const totalMrr = filtered.reduce((s, l) => s + (Number(l.monthlyMrr) || 0), 0);
      const closedCount = filtered.filter((l) => normalizeStageId(l.stage) === 'fechado').length;

      return {
        id: `custom-${config.module}`,
        title,
        subtitle: def.description,
        moduleLabel: def.label,
        periodLabel: period.label,
        appliedFiltersSummary,
        generatedAtIso,
        summaryCards: [
          { label: 'Leads Filtrados', value: String(filtered.length) },
          { label: 'Fechados', value: String(closedCount) },
          {
            label: 'Setup Estimado',
            value: formatBrlFromCents(Math.round(totalCreation * 100)),
          },
          {
            label: 'MRR Estimado',
            value: formatBrlFromCents(Math.round(totalMrr * 100)),
          },
        ],
        columns: ['Empresa', 'Campanha / Nicho', 'Cidade', 'Etapa', 'Criação', 'MRR', 'Entrada'],
        rows: filtered.map((l) => {
          const st = normalizeStageId(l.stage);
          const stageName = FUNNEL_STAGES.find((s) => s.id === st)?.shortName || st;
          return [
            l.companyName,
            nicheMap.get(l.nicheId) || 'Sem nicho',
            l.city || '—',
            stageName,
            formatBrlFromCents(Math.round((Number(l.creationValue) || 0) * 100)),
            formatBrlFromCents(Math.round((Number(l.monthlyMrr) || 0) * 100)),
            formatDateBr(extractLocalYmd(l.createdAt, timezone) || l.createdAt),
          ];
        }),
        totalsRow: [
          'TOTAL',
          `${filtered.length} lead(s)`,
          '—',
          `${closedCount} fechado(s)`,
          formatBrlFromCents(Math.round(totalCreation * 100)),
          formatBrlFromCents(Math.round(totalMrr * 100)),
          '—',
        ],
        emptyMessage: 'Nenhum lead encontrado para os filtros aplicados.',
      };
    }

    case 'comercial_propostas': {
      const filtered = proposals.filter((p) => {
        if (!isDateInRange(p.createdAt, period.startDate, period.endDate, timezone)) {
          return false;
        }
        if (config.clientId && p.clientId !== config.clientId) return false;
        if (config.statusFilter && p.status !== config.statusFilter) return false;
        return true;
      });
      const sumSetup = filtered.reduce((s, p) => s + (Number(p.setupTotal) || 0), 0);
      const sumMrr = filtered.reduce((s, p) => s + (Number(p.monthlyMrr) || 0), 0);
      const converted = filtered.filter(
        (p) => p.status === 'aprovada' || p.status === 'assinada'
      ).length;

      return {
        id: `custom-${config.module}`,
        title,
        subtitle: def.description,
        moduleLabel: def.label,
        periodLabel: period.label,
        appliedFiltersSummary,
        generatedAtIso,
        summaryCards: [
          { label: 'Documentos', value: String(filtered.length) },
          { label: 'Aprovados/Assinados', value: String(converted) },
          { label: 'Setup Total', value: formatBrlFromCents(Math.round(sumSetup * 100)) },
          { label: 'MRR Total', value: formatBrlFromCents(Math.round(sumMrr * 100)) },
        ],
        columns: ['Código', 'Tipo', 'Título', 'Cliente / Destinatário', 'Status', 'Setup', 'MRR'],
        rows: filtered.map((p) => [
          p.code,
          p.kind === 'contrato' ? 'Contrato' : 'Proposta',
          p.title,
          (p.clientId ? clientMap.get(p.clientId) : '') || p.recipientCompany,
          getProposalStatusMeta(p.status).label,
          formatBrlFromCents(Math.round((Number(p.setupTotal) || 0) * 100)),
          formatBrlFromCents(Math.round((Number(p.monthlyMrr) || 0) * 100)),
        ]),
        totalsRow: [
          'TOTAL',
          `${filtered.length} doc.`,
          '—',
          '—',
          `${converted} convertidos`,
          formatBrlFromCents(Math.round(sumSetup * 100)),
          formatBrlFromCents(Math.round(sumMrr * 100)),
        ],
        emptyMessage: 'Nenhuma proposta ou contrato encontrado no período e filtros selecionados.',
      };
    }

    case 'financeiro_lancamentos': {
      const filtered = financialEntries
        .filter((e) => {
          if (!config.includeCancelled && e.status === 'cancelada') return false;
          if (e.dueDate < period.startDate || e.dueDate > period.endDate) return false;
          if (config.clientId && e.clientId !== config.clientId) return false;
          if (config.projectId && e.projectId !== config.projectId) return false;
          if (config.categoryId && e.categoryId !== config.categoryId) return false;
          const eff = getEffectiveEntryStatus(e, todayStr);
          if (config.onlyOverdue && eff !== 'atrasada') return false;
          if (config.statusFilter) {
            if (config.statusFilter === 'receita' && e.kind !== 'receita') return false;
            if (config.statusFilter === 'despesa' && e.kind !== 'despesa') return false;
            if (config.statusFilter === 'atrasada' && eff !== 'atrasada') return false;
            if (
              config.statusFilter === 'pendente' &&
              eff !== 'pendente' &&
              eff !== 'prevista'
            ) {
              return false;
            }
            if (
              config.statusFilter === 'recebida' &&
              eff !== 'recebida' &&
              eff !== 'paga'
            ) {
              return false;
            }
          }
          return true;
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      const totalAllowed = filtered.reduce((s, e) => s + getEntryAllowedTotalCents(e), 0);
      const totalSettled = filtered.reduce((s, e) => s + (e.settledCents || 0), 0);
      const totalPending = filtered.reduce((s, e) => s + getEntryPendingCents(e), 0);

      return {
        id: `custom-${config.module}`,
        title,
        subtitle: def.description,
        moduleLabel: def.label,
        periodLabel: period.label,
        appliedFiltersSummary,
        generatedAtIso,
        summaryCards: [
          { label: 'Lançamentos', value: String(filtered.length) },
          { label: 'Valor Previsto', value: formatBrlFromCents(totalAllowed) },
          { label: 'Valor Baixado', value: formatBrlFromCents(totalSettled) },
          { label: 'Saldo em Aberto', value: formatBrlFromCents(totalPending) },
        ],
        columns: [
          'Vencimento',
          'Tipo',
          'Descrição',
          'Cliente / Fornecedor',
          'Categoria',
          'Previsto',
          'Baixado',
          'Em Aberto',
          'Status',
        ],
        rows: filtered.map((e) => {
          const eff = getEffectiveEntryStatus(e, todayStr);
          return [
            formatDateBr(e.dueDate),
            e.kind === 'receita' ? 'Receita' : 'Despesa',
            e.description,
            e.kind === 'receita'
              ? (e.clientId ? clientMap.get(e.clientId) : '') || 'Avulsa'
              : e.supplierName || '—',
            getCategoryName(financialCategories, e.categoryId),
            formatBrlFromCents(getEntryAllowedTotalCents(e)),
            formatBrlFromCents(e.settledCents || 0),
            formatBrlFromCents(getEntryPendingCents(e)),
            FINANCIAL_ENTRY_STATUS_META[eff]?.label || eff,
          ];
        }),
        totalsRow: [
          'TOTAL',
          '—',
          `${filtered.length} título(s)`,
          '—',
          '—',
          formatBrlFromCents(totalAllowed),
          formatBrlFromCents(totalSettled),
          formatBrlFromCents(totalPending),
          '—',
        ],
        emptyMessage: 'Nenhum lançamento financeiro encontrado para este recorte.',
      };
    }

    case 'financeiro_movimentacoes': {
      const entryMap = new Map(financialEntries.map((e) => [e.id, e]));
      const filtered = financialTransactions
        .filter((tx) => {
          if (tx.date < period.startDate || tx.date > period.endDate) return false;
          if (tx.kind === 'ajuste') return false;
          const entry = entryMap.get(tx.entryId);
          if (config.clientId && entry?.clientId !== config.clientId) return false;
          if (config.projectId && entry?.projectId !== config.projectId) return false;
          if (config.categoryId && entry?.categoryId !== config.categoryId) return false;
          if (config.statusFilter === 'receita' && tx.entryKind !== 'receita') return false;
          if (config.statusFilter === 'despesa' && tx.entryKind !== 'despesa') return false;
          return true;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      let totalIn = 0;
      let totalOut = 0;
      const rows = filtered.map((tx) => {
        const signed = getTransactionSignedCashCents(tx);
        totalIn += signed.inflowCents;
        totalOut += signed.outflowCents;
        const entry = entryMap.get(tx.entryId);
        return [
          formatDateBr(tx.date),
          tx.kind === 'estorno'
            ? 'Estorno'
            : tx.entryKind === 'receita'
            ? 'Recebimento'
            : 'Pagamento',
          entry?.description || tx.entryId,
          entry?.clientId ? clientMap.get(entry.clientId) || 'Cliente' : entry?.supplierName || '—',
          getPaymentMethodLabel(tx.paymentMethod),
          formatBrlFromCents(signed.netCents, { signed: true }),
        ];
      });
      const net = totalIn - totalOut;

      return {
        id: `custom-${config.module}`,
        title,
        subtitle: def.description,
        moduleLabel: def.label,
        periodLabel: period.label,
        appliedFiltersSummary,
        generatedAtIso,
        summaryCards: [
          { label: 'Movimentações', value: String(filtered.length) },
          { label: 'Entradas', value: formatBrlFromCents(totalIn) },
          { label: 'Saídas', value: formatBrlFromCents(totalOut) },
          { label: 'Saldo Líquido', value: formatBrlFromCents(net, { signed: true }) },
        ],
        columns: ['Data', 'Operação', 'Lançamento', 'Cliente / Origem', 'Forma Pagto', 'Impacto Caixa'],
        rows,
        totalsRow: [
          'TOTAL',
          `${filtered.length} mov.`,
          `Entradas ${formatBrlFromCents(totalIn)}`,
          `Saídas ${formatBrlFromCents(totalOut)}`,
          '—',
          formatBrlFromCents(net, { signed: true }),
        ],
        emptyMessage: 'Sem movimentações reais registradas para este filtro.',
      };
    }

    case 'projetos': {
      const filtered = projects.filter((p) => {
        if (!config.includeCancelled && p.status === 'cancelado') return false;
        const refDate = p.startDate || extractLocalYmd(p.createdAt, timezone);
        if (refDate && (refDate < period.startDate || refDate > period.endDate)) {
          // Também inclui se foi concluído ou vence dentro do período
          const dueIn = p.dueDate && p.dueDate >= period.startDate && p.dueDate <= period.endDate;
          const compIn =
            p.completedAt &&
            isDateInRange(p.completedAt, period.startDate, period.endDate, timezone);
          if (!dueIn && !compIn) return false;
        }
        if (config.clientId && p.clientId !== config.clientId) return false;
        if (config.statusFilter && p.status !== config.statusFilter) return false;
        if (config.onlyOverdue) {
          const isOver =
            p.status !== 'concluido' &&
            p.status !== 'cancelado' &&
            p.status !== 'pausado' &&
            Boolean(p.dueDate) &&
            (p.dueDate as string) < todayStr;
          if (!isOver) return false;
        }
        return true;
      });

      const avgProgress =
        filtered.length > 0
          ? Math.round(
              filtered.reduce(
                (s, p) => s + calculateProjectProgress(p, tasks, todayStr).percent,
                0
              ) / filtered.length
            )
          : 0;

      return {
        id: `custom-${config.module}`,
        title,
        subtitle: def.description,
        moduleLabel: def.label,
        periodLabel: period.label,
        appliedFiltersSummary,
        generatedAtIso,
        summaryCards: [
          { label: 'Projetos', value: String(filtered.length) },
          { label: 'Progresso Médio', value: `${avgProgress}%` },
          {
            label: 'Concluídos',
            value: String(filtered.filter((p) => p.status === 'concluido').length),
          },
        ],
        columns: ['Projeto', 'Cliente', 'Serviço', 'Status', 'Prazo', 'Tarefas', 'Progresso'],
        rows: filtered.map((p) => {
          const prog = calculateProjectProgress(p, tasks, todayStr);
          return [
            p.name,
            clientMap.get(p.clientId) || '—',
            p.serviceType,
            getProjectStatusMeta(p.status).label,
            p.dueDate ? formatDateBr(p.dueDate) : 'Sem prazo',
            `${prog.completedTasks}/${prog.totalTasks}`,
            `${prog.percent}%`,
          ];
        }),
        totalsRow: [
          'RESUMO',
          `${filtered.length} projeto(s)`,
          '—',
          '—',
          '—',
          '—',
          `${avgProgress}% médio`,
        ],
        emptyMessage: 'Nenhum projeto encontrado para este filtro.',
      };
    }

    case 'tarefas': {
      const filtered = tasks.filter((t) => {
        const refYmd =
          t.dueDate ||
          extractLocalYmd(t.completedAt, timezone) ||
          extractLocalYmd(t.createdAt, timezone);
        if (refYmd && (refYmd < period.startDate || refYmd > period.endDate)) {
          return false;
        }
        if (config.clientId && t.clientId !== config.clientId) return false;
        if (config.projectId && t.projectId !== config.projectId) return false;
        if (config.statusFilter && t.status !== config.statusFilter) return false;
        if (config.onlyOverdue && !isTaskOverdue(t, todayStr)) return false;
        return true;
      });
      const doneCount = filtered.filter((t) => t.status === 'concluida').length;

      return {
        id: `custom-${config.module}`,
        title,
        subtitle: def.description,
        moduleLabel: def.label,
        periodLabel: period.label,
        appliedFiltersSummary,
        generatedAtIso,
        summaryCards: [
          { label: 'Tarefas', value: String(filtered.length) },
          { label: 'Concluídas', value: String(doneCount) },
          { label: 'Em Aberto', value: String(filtered.length - doneCount) },
        ],
        columns: ['Tarefa', 'Projeto', 'Cliente', 'Prioridade', 'Status', 'Prazo'],
        rows: filtered.map((t) => [
          t.title,
          t.projectId ? projectMap.get(t.projectId) || 'Projeto' : 'Avulsa',
          t.clientId ? clientMap.get(t.clientId) || 'Cliente' : 'Interno',
          getTaskPriorityMeta(t.priority).label,
          getTaskStatusMeta(t.status).label,
          t.dueDate ? formatDateBr(t.dueDate) : 'Sem prazo',
        ]),
        totalsRow: [
          'TOTAL',
          `${filtered.length} tarefa(s)`,
          '—',
          '—',
          `${doneCount} concluída(s)`,
          '—',
        ],
        emptyMessage: 'Nenhuma tarefa encontrada para este filtro.',
      };
    }

    case 'clientes': {
      const filtered = clients.filter((c) => {
        if (!config.includeCancelled && c.status === 'encerrado') return false;
        if (!isDateInRange(c.createdAt, period.startDate, period.endDate, timezone)) {
          return false;
        }
        if (config.statusFilter && c.status !== config.statusFilter) return false;
        return true;
      });
      const totalMrr = filtered.reduce((s, c) => s + (Number(c.monthlyMrr) || 0), 0);

      return {
        id: `custom-${config.module}`,
        title,
        subtitle: def.description,
        moduleLabel: def.label,
        periodLabel: period.label,
        appliedFiltersSummary,
        generatedAtIso,
        summaryCards: [
          { label: 'Clientes Filtrados', value: String(filtered.length) },
          { label: 'MRR Contratado', value: formatBrlFromCents(Math.round(totalMrr * 100)) },
        ],
        columns: ['Empresa', 'Contato', 'Cidade', 'Status', 'MRR Mensal', 'Cadastro'],
        rows: filtered.map((c) => [
          c.companyName,
          c.contactName || '—',
          c.city || '—',
          getClientStatusMeta(c.status).label,
          formatBrlFromCents(Math.round((Number(c.monthlyMrr) || 0) * 100)),
          formatDateBr(extractLocalYmd(c.createdAt, timezone) || c.createdAt),
        ]),
        totalsRow: [
          'TOTAL',
          `${filtered.length} cliente(s)`,
          '—',
          '—',
          formatBrlFromCents(Math.round(totalMrr * 100)),
          '—',
        ],
        emptyMessage: 'Nenhum cliente cadastrado no período com os filtros escolhidos.',
      };
    }

    case 'redes_sociais': {
      const filtered = socialPosts.filter((post) => {
        const refDate =
          post.plannedDate ||
          extractLocalYmd(post.publishedAt, timezone) ||
          extractLocalYmd(post.createdAt, timezone);
        if (refDate && (refDate < period.startDate || refDate > period.endDate)) {
          return false;
        }
        if (config.clientId && post.clientId !== config.clientId) return false;
        if (config.statusFilter && post.status !== config.statusFilter) return false;
        if (config.onlyOverdue) {
          const isOver =
            post.status !== 'publicado' &&
            Boolean(post.plannedDate) &&
            (post.plannedDate as string) < todayStr;
          if (!isOver) return false;
        }
        return true;
      });

      const publishedCount = filtered.filter((p) => p.status === 'publicado').length;

      return {
        id: `custom-${config.module}`,
        title,
        subtitle: def.description,
        moduleLabel: def.label,
        periodLabel: period.label,
        appliedFiltersSummary,
        generatedAtIso,
        summaryCards: [
          { label: 'Conteúdos', value: String(filtered.length) },
          { label: 'Publicados', value: String(publishedCount) },
        ],
        columns: ['Título', 'Conta / Dono', 'Plataforma', 'Formato', 'Data Planejada', 'Status'],
        rows: filtered.map((p) => [
          p.title,
          p.ownerType === 'kaizen'
            ? 'Agência Kaizen'
            : p.clientId
            ? clientMap.get(p.clientId) || 'Cliente'
            : 'Cliente',
          getSocialPlatformLabel(p.platform, p.customPlatformName),
          p.format,
          p.plannedDate ? formatDateBr(p.plannedDate) : 'Sem data',
          getSocialPostStatusMeta(p.status).label,
        ]),
        totalsRow: [
          'TOTAL',
          `${filtered.length} conteúdo(s)`,
          '—',
          '—',
          '—',
          `${publishedCount} publicado(s)`,
        ],
        emptyMessage: 'Nenhum conteúdo editorial encontrado para o filtro selecionado.',
        dataLimitationsNote:
          'Este relatório editorial não inclui métricas externas de redes sociais (curtidas/alcance/seguidores), pois a API social externa não está conectada.',
      };
    }

    case 'produtividade_atividades': {
      const prod = computeProductivityAnalytics({
        tasks,
        projects,
        leads,
        proposals,
        agendaEvents,
        socialPosts,
        financialTransactions,
        financialAuditLogs: [],
        resourceFiles,
        clients,
        period,
        todayStr,
        timezone,
      });

      const filtered = prod.recentActivities.filter((act) => {
        if (config.clientId && act.clientId !== config.clientId) return false;
        if (config.statusFilter && act.module !== config.statusFilter) return false;
        return true;
      });

      return {
        id: `custom-${config.module}`,
        title,
        subtitle: def.description,
        moduleLabel: def.label,
        periodLabel: period.label,
        appliedFiltersSummary,
        generatedAtIso,
        summaryCards: [
          { label: 'Atividades Registradas', value: String(filtered.length) },
          { label: 'Dias Ativos (Geral)', value: `${prod.activeDaysCount} / ${period.daysCount}` },
          { label: 'Consistência', value: `${prod.consistencyRatePct}%` },
        ],
        columns: ['Data', 'Módulo', 'Atividade', 'Cliente', 'Detalhe'],
        rows: filtered.map((a) => [
          formatDateBr(a.dateYmd),
          a.moduleLabel,
          a.title,
          a.clientName || 'Interno / Geral',
          a.detail || '—',
        ]),
        totalsRow: ['TOTAL', `${filtered.length} registro(s)`, '—', '—', '—'],
        emptyMessage: 'Nenhuma atividade registrada neste filtro.',
        dataLimitationsNote: prod.workedHoursLimitationNote,
      };
    }
  }
}
