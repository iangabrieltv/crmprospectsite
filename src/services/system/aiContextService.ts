import { Lead, NicheCampaign } from '../../types/crm';
import {
  AgendaEvent,
  Client,
  Project,
  ProposalContract,
  SocialChannel,
  SocialPost,
  Task,
} from '../../types/kaizen';
import {
  FinancialAuditLog,
  FinancialCategory,
  FinancialEntry,
  FinancialRecurrence,
  FinancialSettings,
  FinancialTransaction,
} from '../../types/finance';
import { ResourceFile } from '../../types/resources';
import {
  KAIZEN_TIMEZONE,
  formatBrlFromCents,
  formatDateBr,
  getEffectiveEntryStatus,
  getEntryPendingCents,
  getTodayInTimezone,
} from '../finance';
import { computeExecutiveDashboardSnapshot } from '../analytics/executiveDashboardService';

export interface SmartSuggestionItem {
  id: string;
  category: 'comercial' | 'operacional' | 'financeiro' | 'agenda';
  severity: 'info' | 'warning' | 'danger';
  title: string;
  description: string;
  promptToAsk: string;
  targetTab: 'kanban' | 'proposals' | 'projects' | 'tasks' | 'agenda' | 'finance';
}

export interface AssistantContextSummary {
  generatedAt: string;
  todayStr: string;
  timezone: string;
  commercial: {
    totalLeads: number;
    activeNiches: number;
    closedDeals: number;
    openProposalsCount: number;
    approvedOrSignedProposalsCount: number;
    staleLeadsSample: { id: string; companyName: string; stage: string; phone: string; lastContactDate?: string }[];
    pendingProposalsSample: { id: string; code: string; recipientCompany: string; status: string; setupTotal: number; monthlyMrr: number }[];
  };
  clients: {
    totalClients: number;
    activeClients: number;
  };
  operations: {
    activeProjectsCount: number;
    overdueProjectsCount: number;
    openTasksCount: number;
    overdueTasksCount: number;
    dueTodayTasksCount: number;
    priorityTasksSample: { id: string; title: string; dueDate?: string; priority: string; status: string }[];
    projectsSample: { id: string; name: string; status: string; dueDate?: string }[];
  };
  agenda: {
    dueCallbacksCount: number;
    upcomingMeetingsCount: number;
    todayEventsCount: number;
    upcomingItemsSample: { kind: string; title: string; date: string; time?: string }[];
  };
  finance: {
    currency: 'BRL';
    receitaRecebidaNoMes: string;
    despesaPagaNoMes: string;
    resultadoRealizadoNoMes: string;
    receitaPrevistaEmAberto: string;
    despesaPrevistaEmAberto: string;
    aReceberEmAtraso: string;
    aPagarEmAtraso: string;
    note: string;
    urgentFinancialSample: { id: string; kind: string; description: string; dueDate: string; pendingAmount: string; overdue: boolean }[];
  };
  dataLimitations: string[];
}

export function buildAssistantContextSummary(params: {
  leads: Lead[];
  niches: NicheCampaign[];
  clients: Client[];
  proposals: ProposalContract[];
  projects: Project[];
  tasks: Task[];
  agendaEvents: AgendaEvent[];
  socialChannels: SocialChannel[];
  socialPosts: SocialPost[];
  financialEntries: FinancialEntry[];
  financialTransactions: FinancialTransaction[];
  financialCategories: FinancialCategory[];
  financialRecurrences: FinancialRecurrence[];
  financialSettings: FinancialSettings;
  financialAuditLogs: FinancialAuditLog[];
  resourceFiles: ResourceFile[];
  todayStr?: string;
}): AssistantContextSummary {
  const todayStr = params.todayStr || getTodayInTimezone(KAIZEN_TIMEZONE);
  const snapshot = computeExecutiveDashboardSnapshot({
    ...params,
    preset: 'este_mes',
    todayStr,
  });

  const staleLeads = params.leads
    .filter((l) => l.stage !== 'fechado' && l.stage !== 'nao_interessado')
    .slice(0, 8)
    .map((l) => ({
      id: l.id,
      companyName: l.companyName,
      stage: l.stage,
      phone: l.displayPhone || l.phone,
      lastContactDate: l.lastContactDate,
    }));

  const pendingProposals = params.proposals
    .filter((p) => p.status === 'enviada' || p.status === 'em_negociacao' || p.status === 'rascunho')
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      code: p.code,
      recipientCompany: p.recipientCompany,
      status: p.status,
      setupTotal: p.setupTotal,
      monthlyMrr: p.monthlyMrr,
    }));

  const openTasks = params.tasks.filter((t) => t.status !== 'concluida');
  const overdueTasks = openTasks.filter((t) => Boolean(t.dueDate) && (t.dueDate as string) < todayStr);
  const dueTodayTasks = openTasks.filter((t) => t.dueDate === todayStr);

  const activeProjects = params.projects.filter(
    (p) => p.status !== 'concluido' && p.status !== 'cancelado'
  );
  const overdueProjects = activeProjects.filter(
    (p) => Boolean(p.dueDate) && (p.dueDate as string) < todayStr
  );

  const dueCallbacks = params.leads.filter(
    (l) =>
      l.callbackDate &&
      l.callbackDate <= todayStr &&
      l.callbackStatus !== 'realizado' &&
      l.callbackStatus !== 'cancelado'
  );
  const upcomingMeetings = params.leads.filter(
    (l) =>
      l.meetingDate &&
      l.meetingDate >= todayStr &&
      l.meetingStatus !== 'realizada' &&
      l.meetingStatus !== 'cancelada'
  );
  const todayEvents = params.agendaEvents.filter(
    (e) => e.status === 'agendado' && e.date === todayStr
  );

  let openReceivableCents = 0;
  let openPayableCents = 0;
  let overdueReceivableCents = 0;
  let overduePayableCents = 0;
  const urgentFinancialSample: AssistantContextSummary['finance']['urgentFinancialSample'] = [];

  for (const entry of params.financialEntries) {
    const pending = getEntryPendingCents(entry);
    if (pending <= 0) continue;
    const eff = getEffectiveEntryStatus(entry, todayStr);
    const overdue = eff === 'atrasada';
    if (entry.kind === 'receita') {
      openReceivableCents += pending;
      if (overdue) overdueReceivableCents += pending;
    } else {
      openPayableCents += pending;
      if (overdue) overduePayableCents += pending;
    }
    if (urgentFinancialSample.length < 8 && (overdue || entry.dueDate >= todayStr)) {
      urgentFinancialSample.push({
        id: entry.id,
        kind: entry.kind,
        description: entry.description,
        dueDate: entry.dueDate,
        pendingAmount: formatBrlFromCents(pending),
        overdue,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    todayStr,
    timezone: KAIZEN_TIMEZONE,
    commercial: {
      totalLeads: params.leads.length,
      activeNiches: params.niches.length,
      closedDeals: params.leads.filter((l) => l.stage === 'fechado').length,
      openProposalsCount: params.proposals.filter(
        (p) => p.status === 'enviada' || p.status === 'em_negociacao' || p.status === 'rascunho'
      ).length,
      approvedOrSignedProposalsCount: params.proposals.filter(
        (p) => p.status === 'aprovada' || p.status === 'assinada'
      ).length,
      staleLeadsSample: staleLeads,
      pendingProposalsSample: pendingProposals,
    },
    clients: {
      totalClients: params.clients.length,
      activeClients: params.clients.filter((c) => c.status === 'ativo').length,
    },
    operations: {
      activeProjectsCount: activeProjects.length,
      overdueProjectsCount: overdueProjects.length,
      openTasksCount: openTasks.length,
      overdueTasksCount: overdueTasks.length,
      dueTodayTasksCount: dueTodayTasks.length,
      priorityTasksSample: [...overdueTasks, ...dueTodayTasks, ...openTasks]
        .filter((t, idx, arr) => arr.findIndex((x) => x.id === t.id) === idx)
        .slice(0, 8)
        .map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate,
          priority: t.priority,
          status: t.status,
        })),
      projectsSample: activeProjects.slice(0, 6).map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        dueDate: p.dueDate,
      })),
    },
    agenda: {
      dueCallbacksCount: dueCallbacks.length,
      upcomingMeetingsCount: upcomingMeetings.length,
      todayEventsCount: todayEvents.length,
      upcomingItemsSample: [
        ...dueCallbacks.slice(0, 3).map((l) => ({
          kind: 'retorno',
          title: l.companyName,
          date: l.callbackDate || todayStr,
          time: l.callbackTime,
        })),
        ...upcomingMeetings.slice(0, 3).map((l) => ({
          kind: 'reuniao',
          title: l.companyName,
          date: l.meetingDate || todayStr,
          time: l.meetingTime,
        })),
        ...todayEvents.slice(0, 3).map((e) => ({
          kind: 'evento',
          title: e.title,
          date: e.date,
          time: e.startTime,
        })),
      ],
    },
    finance: {
      currency: 'BRL',
      receitaRecebidaNoMes: formatBrlFromCents(snapshot.financial.current.receivedRevenueCents),
      despesaPagaNoMes: formatBrlFromCents(snapshot.financial.current.paidExpensesCents),
      resultadoRealizadoNoMes: formatBrlFromCents(snapshot.financial.current.realizedProfitCents),
      receitaPrevistaEmAberto: formatBrlFromCents(openReceivableCents),
      despesaPrevistaEmAberto: formatBrlFromCents(openPayableCents),
      aReceberEmAtraso: formatBrlFromCents(overdueReceivableCents),
      aPagarEmAtraso: formatBrlFromCents(overduePayableCents),
      note: 'Valores recebidos/pagos referem-se exclusivamente a movimentações efetivamente liquidadas; valores em aberto são previsões.',
      urgentFinancialSample,
    },
    dataLimitations: [
      'Abertura de link wa.me prepara rascunho de WhatsApp mas não comprova entrega/leitura pela API.',
      'Proposta marcada como "enviada" ainda não representa contrato fechado até aprovação/assinatura.',
      'Google Calendar e E-mail externos não estão conectados neste ambiente.',
    ],
  };
}

/**
 * Sugestões inteligentes determinísticas calculadas a partir dos dados reais do Kaizen.
 * Disponível mesmo quando GEMINI_API_KEY não estiver configurada.
 */
export function computeSmartAiSuggestions(params: {
  leads: Lead[];
  proposals: ProposalContract[];
  projects: Project[];
  tasks: Task[];
  financialEntries: FinancialEntry[];
  todayStr?: string;
}): SmartSuggestionItem[] {
  const todayStr = params.todayStr || getTodayInTimezone(KAIZEN_TIMEZONE);
  const suggestions: SmartSuggestionItem[] = [];

  const overdueTasks = params.tasks.filter(
    (t) => t.status !== 'concluida' && Boolean(t.dueDate) && (t.dueDate as string) < todayStr
  );
  if (overdueTasks.length > 0) {
    suggestions.push({
      id: 'sug-overdue-tasks',
      category: 'operacional',
      severity: 'danger',
      title: `${overdueTasks.length} tarefa(s) em atraso`,
      description: `Prioridade imediata: "${overdueTasks[0].title}" (prazo ${formatDateBr(
        overdueTasks[0].dueDate
      )}).`,
      promptToAsk:
        'Organize minhas prioridades de hoje considerando minhas tarefas atrasadas e entregas de projetos.',
      targetTab: 'tasks',
    });
  }

  const overdueReceivables = params.financialEntries.filter(
    (e) =>
      e.kind === 'receita' &&
      getEntryPendingCents(e) > 0 &&
      getEffectiveEntryStatus(e, todayStr) === 'atrasada'
  );
  if (overdueReceivables.length > 0) {
    const total = overdueReceivables.reduce((acc, e) => acc + getEntryPendingCents(e), 0);
    suggestions.push({
      id: 'sug-overdue-rec',
      category: 'financeiro',
      severity: 'danger',
      title: `Cobranças em atraso (${formatBrlFromCents(total)})`,
      description: `${overdueReceivables.length} lançamento(s) a receber com vencimento anterior a hoje.`,
      promptToAsk:
        'Analise minhas contas a receber em atraso e prepare um rascunho educado de cobrança no WhatsApp (para eu revisar antes).',
      targetTab: 'finance',
    });
  }

  const openProposals = params.proposals.filter(
    (p) => p.status === 'enviada' || p.status === 'em_negociacao'
  );
  if (openProposals.length > 0) {
    suggestions.push({
      id: 'sug-open-proposals',
      category: 'comercial',
      severity: 'warning',
      title: `${openProposals.length} proposta(s) em negociação/enviada(s)`,
      description: `Acompanhe ${openProposals[0].code} — ${openProposals[0].recipientCompany}.`,
      promptToAsk: `Prepare uma mensagem de acompanhamento para a proposta ${openProposals[0].code} (${openProposals[0].recipientCompany}).`,
      targetTab: 'proposals',
    });
  }

  const staleCallbacks = params.leads.filter(
    (l) =>
      l.callbackDate &&
      l.callbackDate <= todayStr &&
      l.callbackStatus !== 'realizado' &&
      l.callbackStatus !== 'cancelado'
  );
  if (staleCallbacks.length > 0) {
    suggestions.push({
      id: 'sug-callbacks',
      category: 'agenda',
      severity: 'warning',
      title: `${staleCallbacks.length} retorno(s) comercial(is) pendente(s)`,
      description: `Primeiro da fila: ${staleCallbacks[0].companyName}.`,
      promptToAsk: `Resuma o histórico do lead ${staleCallbacks[0].companyName} e sugira a melhor abordagem de retorno.`,
      targetTab: 'agenda',
    });
  }

  const overdueProjects = params.projects.filter(
    (p) =>
      p.status !== 'concluido' &&
      p.status !== 'cancelado' &&
      Boolean(p.dueDate) &&
      (p.dueDate as string) < todayStr
  );
  if (overdueProjects.length > 0) {
    suggestions.push({
      id: 'sug-projects',
      category: 'operacional',
      severity: 'warning',
      title: `${overdueProjects.length} projeto(s) com prazo vencido`,
      description: `Projeto "${overdueProjects[0].name}" precisa de replanejamento ou entrega.`,
      promptToAsk: `Gere um checklist de destravamento e crie uma tarefa sugerida para o projeto ${overdueProjects[0].name}.`,
      targetTab: 'projects',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: 'sug-daily-overview',
      category: 'operacional',
      severity: 'info',
      title: 'Resumo executivo do dia',
      description: 'Nenhuma pendência crítica detectada agora. Peça um briefing consolidado da agência.',
      promptToAsk:
        'Faça um resumo executivo do estado atual da Kaizen (comercial, projetos, tarefas e financeiro previsto vs realizado).',
      targetTab: 'tasks',
    });
  }

  return suggestions;
}
