import { Lead } from '../../types/crm';
import { AgendaEvent, Project, ProposalContract, Task } from '../../types/kaizen';
import { FinancialEntry, FinancialRecurrence } from '../../types/finance';
import {
  AutomationExecutionLog,
  AutomationRuleKey,
  AutomationRuleSetting,
} from '../../types/system';
import {
  KAIZEN_TIMEZONE,
  addDaysYmd,
  formatBrlFromCents,
  formatDateBr,
  getEffectiveEntryStatus,
  getEntryPendingCents,
  getTodayInTimezone,
} from '../finance';

export function buildDefaultAutomationRules(
  nowIso = new Date().toISOString()
): AutomationRuleSetting[] {
  const catalog: Omit<AutomationRuleSetting, 'createdAt' | 'schemaVersion' | 'updatedAt'>[] = [
    // COMERCIAL
    {
      id: 'auto-comm-stale-leads',
      key: 'comm_stale_leads',
      name: 'Leads sem contato ou parados no funil',
      description: 'Identifica leads ativos sem registro de contato há 3 dias ou mais.',
      category: 'comercial',
      enabled: true,
      triggerCondition: 'Leads fora de "Fechado" com último contato >= 3 dias',
      cadenceMode: 'manual_ou_ao_abrir',
      thresholdDays: 3,
      nextCheckNote: 'Executada manualmente ou ao abrir o sistema.',
    },
    {
      id: 'auto-comm-due-callbacks',
      key: 'comm_due_callbacks',
      name: 'Alertar retornos e follow-ups vencidos',
      description: 'Monitora callbacks agendados vencidos ou marcados para hoje.',
      category: 'comercial',
      enabled: true,
      triggerCondition: 'Callback pendente com data <= hoje',
      cadenceMode: 'manual_ou_ao_abrir',
      thresholdDays: 0,
      nextCheckNote: 'Gera alerta sem alterar status do lead.',
    },
    {
      id: 'auto-comm-pending-proposals',
      key: 'comm_pending_proposals',
      name: 'Propostas enviadas sem acompanhamento',
      description: 'Lista propostas enviadas ou em negociação paradas há mais de 5 dias.',
      category: 'comercial',
      enabled: true,
      triggerCondition: 'Proposta enviada/em negociação há >= 5 dias',
      cadenceMode: 'manual_ou_ao_abrir',
      thresholdDays: 5,
      nextCheckNote: 'Apenas monitoramento; não altera etapa nem envia mensagens.',
    },
    {
      id: 'auto-comm-whatsapp-draft',
      key: 'comm_whatsapp_followup_draft',
      name: 'Sugerir rascunho de follow-up no WhatsApp',
      description: 'Prepara sugestão de texto de follow-up para o lead parado mais prioritário.',
      category: 'comercial',
      enabled: true,
      triggerCondition: 'Quando houver lead em Follow-up 1/2 sem retorno >= 3 dias',
      cadenceMode: 'manual_ou_ao_abrir',
      thresholdDays: 3,
      nextCheckNote: 'Gera rascunho seguro — nenhum envio automático é realizado.',
    },

    // OPERACIONAL
    {
      id: 'auto-op-due-tasks',
      key: 'op_due_tasks',
      name: 'Tarefas vencidas ou próximas do prazo',
      description: 'Sinaliza tarefas não concluídas com prazo vencido ou para até amanhã.',
      category: 'operacional',
      enabled: true,
      triggerCondition: 'Tarefa aberta com prazo <= amanhã',
      cadenceMode: 'manual_ou_ao_abrir',
      thresholdDays: 1,
      nextCheckNote: 'Atualiza o resumo operacional na abertura ou sob demanda.',
    },
    {
      id: 'auto-op-at-risk-projects',
      key: 'op_at_risk_projects',
      name: 'Projetos em risco ou prazo vencido',
      description: 'Detecta projetos ativos com prazo vencido ou entrega nos próximos 3 dias.',
      category: 'operacional',
      enabled: true,
      triggerCondition: 'Projeto ativo com prazo <= 3 dias',
      cadenceMode: 'manual_ou_ao_abrir',
      thresholdDays: 3,
      nextCheckNote: 'Não altera status do projeto automaticamente.',
    },
    {
      id: 'auto-op-daily-summary',
      key: 'op_daily_summary',
      name: 'Resumo diário de prioridades',
      description: 'Consolida tarefas do dia, reuniões agendadas e retornos comerciais de hoje.',
      category: 'operacional',
      enabled: true,
      triggerCondition: 'Registros previstos para a data atual',
      cadenceMode: 'manual_ou_ao_abrir',
      nextCheckNote: 'Resumo somente leitura exibido no histórico de execução.',
    },
    {
      id: 'auto-op-weekly-summary',
      key: 'op_weekly_summary',
      name: 'Resumo semanal de entregas e prazos',
      description: 'Mapeia entregas de projetos, tarefas e compromissos nos próximos 7 dias.',
      category: 'operacional',
      enabled: true,
      triggerCondition: 'Janela móvel de 7 dias a partir de hoje',
      cadenceMode: 'manual_ou_ao_abrir',
      thresholdDays: 7,
      nextCheckNote: 'Executada manualmente pelo administrador ou ao abrir o sistema.',
    },

    // FINANCEIRO (SOMENTE ALERTA — ZERO BAIXA AUTOMÁTICA)
    {
      id: 'auto-fin-upcoming-payables',
      key: 'fin_upcoming_payables',
      name: 'Contas a pagar próximas do vencimento',
      description: 'Verifica despesas em aberto que vencem nos próximos dias ou já venceram.',
      category: 'financeiro',
      enabled: true,
      triggerCondition: 'Despesa em aberto com vencimento <= horizonte configurado',
      cadenceMode: 'manual_ou_ao_abrir',
      thresholdDays: 5,
      nextCheckNote: 'Somente alerta: jamais realiza pagamento ou baixa automática.',
    },
    {
      id: 'auto-fin-overdue-receivables',
      key: 'fin_overdue_receivables',
      name: 'Alertar contas a receber em atraso',
      description: 'Identifica receitas em aberto com vencimento anterior à data atual.',
      category: 'financeiro',
      enabled: true,
      triggerCondition: 'Receita com saldo pendente e vencimento < hoje',
      cadenceMode: 'manual_ou_ao_abrir',
      thresholdDays: 0,
      nextCheckNote: 'Somente alerta: não altera lançamentos nem envia cobranças.',
    },
    {
      id: 'auto-fin-upcoming-recurrences',
      key: 'fin_upcoming_recurrences',
      name: 'Monitorar recorrências próximas do vencimento',
      description: 'Lista contratos recorrentes ativos com próxima ocorrência em até 5 dias.',
      category: 'financeiro',
      enabled: true,
      triggerCondition: 'Recorrência ativa com próxima data <= +5 dias',
      cadenceMode: 'manual_ou_ao_abrir',
      thresholdDays: 5,
      nextCheckNote: 'Somente leitura — geração de títulos continua controlada no Financeiro.',
    },
  ];

  return catalog.map((item) => ({
    ...item,
    createdAt: nowIso,
    schemaVersion: 1,
    updatedAt: nowIso,
  }));
}

export function mergeAutomationRulesWithDefaults(
  existing: AutomationRuleSetting[],
  nowIso = new Date().toISOString()
): AutomationRuleSetting[] {
  const defaults = buildDefaultAutomationRules(nowIso);
  const existingById = new Map<string, AutomationRuleSetting>();
  for (const r of existing) {
    existingById.set(r.id, r);
  }
  return defaults.map((def) => {
    const saved = existingById.get(def.id);
    if (!saved) return def;
    return {
      ...def,
      enabled: typeof saved.enabled === 'boolean' ? saved.enabled : def.enabled,
      thresholdDays: saved.thresholdDays ?? def.thresholdDays,
      lastRunAt: saved.lastRunAt,
      lastStatus: saved.lastStatus,
      lastFindingsCount: saved.lastFindingsCount,
      updatedAt: saved.updatedAt || def.updatedAt,
    };
  });
}

function diffDaysYmd(olderYmd: string, newerYmd: string): number {
  const [y1, m1, d1] = olderYmd.split('-').map(Number);
  const [y2, m2, d2] = newerYmd.split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  return Math.floor((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function evaluateSingleRule(
  rule: AutomationRuleSetting,
  data: {
    leads: Lead[];
    proposals: ProposalContract[];
    projects: Project[];
    tasks: Task[];
    agendaEvents: AgendaEvent[];
    financialEntries: FinancialEntry[];
    financialRecurrences: FinancialRecurrence[];
    financialAlertDaysAhead?: number;
  },
  todayStr: string
): { findingsCount: number; summary: string; details?: string } {
  const alertDays = rule.thresholdDays ?? data.financialAlertDaysAhead ?? 5;

  const evalMap: Record<AutomationRuleKey, () => { findingsCount: number; summary: string; details?: string }> = {
    comm_stale_leads: () => {
      const stale = data.leads.filter((l) => {
        if (l.stage === 'fechado' || l.stage === 'nao_interessado') return false;
        const refYmd = (l.lastContactDate || l.createdAt || '').slice(0, 10);
        return Boolean(refYmd) && diffDaysYmd(refYmd, todayStr) >= (rule.thresholdDays ?? 3);
      });
      return {
        findingsCount: stale.length,
        summary:
          stale.length > 0
            ? `${stale.length} lead(s) sem contato recente há 3+ dias.`
            : 'Nenhum lead parado acima do limite.',
        details: stale
          .slice(0, 5)
          .map((l) => l.companyName)
          .join(', '),
      };
    },
    comm_due_callbacks: () => {
      const due = data.leads.filter(
        (l) =>
          l.callbackDate &&
          l.callbackDate <= todayStr &&
          l.callbackStatus !== 'realizado' &&
          l.callbackStatus !== 'cancelado'
      );
      return {
        findingsCount: due.length,
        summary:
          due.length > 0
            ? `${due.length} retorno(s) comercial(is) vencido(s) ou para hoje.`
            : 'Nenhum retorno vencido ou agendado para hoje.',
        details: due
          .slice(0, 5)
          .map((l) => `${l.companyName} (${formatDateBr(l.callbackDate)})`)
          .join(', '),
      };
    },
    comm_pending_proposals: () => {
      const pending = data.proposals.filter((p) => {
        if (p.status !== 'enviada' && p.status !== 'em_negociacao') return false;
        const refYmd = (p.sentAt || p.updatedAt || p.createdAt || '').slice(0, 10);
        return Boolean(refYmd) && diffDaysYmd(refYmd, todayStr) >= (rule.thresholdDays ?? 5);
      });
      return {
        findingsCount: pending.length,
        summary:
          pending.length > 0
            ? `${pending.length} proposta(s) enviada(s) sem definição há 5+ dias.`
            : 'Nenhuma proposta parada acima do limite.',
        details: pending
          .slice(0, 5)
          .map((p) => `${p.code} (${p.recipientCompany})`)
          .join(', '),
      };
    },
    comm_whatsapp_followup_draft: () => {
      const candidates = data.leads.filter((l) => {
        if (l.stage !== 'follow_up_1' && l.stage !== 'follow_up_2' && l.stage !== 'mandei_mensagem') {
          return false;
        }
        const refYmd = (l.lastContactDate || l.createdAt || '').slice(0, 10);
        return Boolean(refYmd) && diffDaysYmd(refYmd, todayStr) >= (rule.thresholdDays ?? 3);
      });
      const first = candidates[0];
      return {
        findingsCount: candidates.length,
        summary: first
          ? `Rascunho sugerido pronto para ${first.companyName} (+${candidates.length - 1} outros).`
          : 'Nenhum lead elegível para sugestão de follow-up no momento.',
        details: first
          ? `Sugestão de texto para ${first.contactName || first.companyName}: "Olá! Retomando nosso contato sobre o posicionamento digital da ${first.companyName}. Conseguiu avaliar nossa mensagem anterior?"`
          : undefined,
      };
    },
    op_due_tasks: () => {
      const horizon = addDaysYmd(todayStr, rule.thresholdDays ?? 1);
      const due = data.tasks.filter(
        (t) => t.status !== 'concluida' && t.dueDate && t.dueDate <= horizon
      );
      return {
        findingsCount: due.length,
        summary:
          due.length > 0
            ? `${due.length} tarefa(s) atrasada(s) ou vencendo até amanhã.`
            : 'Nenhuma tarefa crítica vencendo até amanhã.',
        details: due
          .slice(0, 5)
          .map((t) => `${t.title} (${formatDateBr(t.dueDate)})`)
          .join(', '),
      };
    },
    op_at_risk_projects: () => {
      const horizon = addDaysYmd(todayStr, rule.thresholdDays ?? 3);
      const atRisk = data.projects.filter(
        (p) =>
          p.status !== 'concluido' &&
          p.status !== 'cancelado' &&
          Boolean(p.dueDate) &&
          (p.dueDate as string) <= horizon
      );
      return {
        findingsCount: atRisk.length,
        summary:
          atRisk.length > 0
            ? `${atRisk.length} projeto(s) com prazo vencido ou entrega próxima.`
            : 'Nenhum projeto com risco de prazo imediato.',
        details: atRisk
          .slice(0, 5)
          .map((p) => `${p.name} (${formatDateBr(p.dueDate)})`)
          .join(', '),
      };
    },
    op_daily_summary: () => {
      const todayTasks = data.tasks.filter(
        (t) => t.status !== 'concluida' && t.dueDate && t.dueDate <= todayStr
      );
      const todayMeetings = data.leads.filter(
        (l) =>
          l.meetingDate === todayStr &&
          l.meetingStatus !== 'realizada' &&
          l.meetingStatus !== 'cancelada'
      );
      const todayEvents = data.agendaEvents.filter(
        (e) => e.status === 'agendado' && e.date === todayStr
      );
      const total = todayTasks.length + todayMeetings.length + todayEvents.length;
      return {
        findingsCount: total,
        summary: `Hoje: ${todayTasks.length} tarefa(s), ${todayMeetings.length} reunião(ões) de CRM e ${todayEvents.length} evento(s) na agenda.`,
      };
    },
    op_weekly_summary: () => {
      const weekEnd = addDaysYmd(todayStr, rule.thresholdDays ?? 7);
      const weekTasks = data.tasks.filter(
        (t) =>
          t.status !== 'concluida' &&
          t.dueDate &&
          t.dueDate >= todayStr &&
          t.dueDate <= weekEnd
      );
      const weekProjects = data.projects.filter(
        (p) =>
          p.status !== 'concluido' &&
          p.status !== 'cancelado' &&
          p.dueDate &&
          p.dueDate >= todayStr &&
          p.dueDate <= weekEnd
      );
      const total = weekTasks.length + weekProjects.length;
      return {
        findingsCount: total,
        summary: `Próximos 7 dias: ${weekProjects.length} entrega(s) de projeto e ${weekTasks.length} tarefa(s) programada(s).`,
      };
    },
    fin_upcoming_payables: () => {
      const horizon = addDaysYmd(todayStr, alertDays);
      const payables = data.financialEntries.filter((entry) => {
        if (entry.kind !== 'despesa') return false;
        if (getEntryPendingCents(entry) <= 0) return false;
        const eff = getEffectiveEntryStatus(entry, todayStr);
        return eff === 'atrasada' || entry.dueDate <= horizon;
      });
      const totalPending = payables.reduce((acc, e) => acc + getEntryPendingCents(e), 0);
      return {
        findingsCount: payables.length,
        summary:
          payables.length > 0
            ? `${payables.length} conta(s) a pagar vencida(s) ou próxima(s) (${formatBrlFromCents(
                totalPending
              )}).`
            : 'Nenhuma conta a pagar vencendo no horizonte configurado.',
      };
    },
    fin_overdue_receivables: () => {
      const overdue = data.financialEntries.filter((entry) => {
        if (entry.kind !== 'receita') return false;
        if (getEntryPendingCents(entry) <= 0) return false;
        return getEffectiveEntryStatus(entry, todayStr) === 'atrasada';
      });
      const totalPending = overdue.reduce((acc, e) => acc + getEntryPendingCents(e), 0);
      return {
        findingsCount: overdue.length,
        summary:
          overdue.length > 0
            ? `${overdue.length} conta(s) a receber em atraso (${formatBrlFromCents(
                totalPending
              )}).`
            : 'Nenhuma conta a receber em atraso.',
      };
    },
    fin_upcoming_recurrences: () => {
      const horizon = addDaysYmd(todayStr, alertDays);
      const recs = data.financialRecurrences.filter(
        (r) => r.status === 'ativa' && r.nextOccurrenceDate <= horizon
      );
      return {
        findingsCount: recs.length,
        summary:
          recs.length > 0
            ? `${recs.length} recorrência(s) ativa(s) com vencimento até ${formatDateBr(
                horizon
              )}.`
            : 'Nenhuma recorrência próxima do vencimento.',
        details: recs
          .slice(0, 5)
          .map((r) => `${r.name} (${formatDateBr(r.nextOccurrenceDate)})`)
          .join(', '),
      };
    },
  };

  return evalMap[rule.key]();
}

export function runAutomationRules(params: {
  rules: AutomationRuleSetting[];
  data: {
    leads: Lead[];
    proposals: ProposalContract[];
    projects: Project[];
    tasks: Task[];
    agendaEvents: AgendaEvent[];
    financialEntries: FinancialEntry[];
    financialRecurrences: FinancialRecurrence[];
    financialAlertDaysAhead?: number;
  };
  triggerType: 'manual' | 'abertura_sistema';
  onlyRuleId?: string;
  todayStr?: string;
  nowIso?: string;
}): {
  updatedRules: AutomationRuleSetting[];
  newLogs: AutomationExecutionLog[];
} {
  const todayStr = params.todayStr || getTodayInTimezone(KAIZEN_TIMEZONE);
  const nowIso = params.nowIso || new Date().toISOString();
  const newLogs: AutomationExecutionLog[] = [];

  const updatedRules = params.rules.map((rule) => {
    const shouldRun = params.onlyRuleId
      ? rule.id === params.onlyRuleId
      : rule.enabled;

    if (!shouldRun) return rule;

    try {
      const res = evaluateSingleRule(rule, params.data, todayStr);
      const status: AutomationExecutionLog['status'] =
        res.findingsCount > 0 ? 'sucesso' : 'sem_alertas';

      newLogs.push({
        id: `autolog-${rule.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ruleId: rule.id,
        ruleName: rule.name,
        category: rule.category,
        triggerType: params.triggerType,
        status,
        findingsCount: res.findingsCount,
        summary: res.summary,
        details: res.details,
        executedAt: nowIso,
        schemaVersion: 1,
        updatedAt: nowIso,
      });

      return {
        ...rule,
        lastRunAt: nowIso,
        lastStatus: status,
        lastFindingsCount: res.findingsCount,
        updatedAt: nowIso,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao avaliar regra.';
      newLogs.push({
        id: `autolog-${rule.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ruleId: rule.id,
        ruleName: rule.name,
        category: rule.category,
        triggerType: params.triggerType,
        status: 'erro',
        findingsCount: 0,
        summary: 'Falha controlada ao avaliar regra.',
        details: msg.slice(0, 300),
        executedAt: nowIso,
        schemaVersion: 1,
        updatedAt: nowIso,
      });
      return {
        ...rule,
        lastRunAt: nowIso,
        lastStatus: 'erro' as const,
        lastFindingsCount: 0,
        updatedAt: nowIso,
      };
    }
  });

  return { updatedRules, newLogs };
}
