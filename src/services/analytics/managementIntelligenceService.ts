import { ManagementInsight } from '../../types/analytics';
import { CommercialAnalyticsSnapshot } from './commercialAnalyticsService';
import { FinancialAnalyticsSnapshot } from './financialAnalyticsService';
import { OperationalAnalyticsSnapshot } from './operationalAnalyticsService';
import { ClientPortfolioAnalyticsSnapshot } from './clientPortfolioAnalyticsService';
import { SocialAnalyticsSnapshot } from './socialAnalyticsService';
import { ProductivityAnalyticsSnapshot } from './productivityAnalyticsService';
import { formatBrlFromCents } from '../finance/money';

/**
 * Motor determinístico e verificável de Inteligência de Gestão.
 * Cada insight cita obrigatoriamente números reais, amostra/denominador e destino acionável.
 * Nunca inventa tendências sem dados nem recomendações genéricas sem evidência.
 */
export function buildManagementInsights(params: {
  commercial: CommercialAnalyticsSnapshot;
  financial: FinancialAnalyticsSnapshot;
  operational: OperationalAnalyticsSnapshot;
  clients: ClientPortfolioAnalyticsSnapshot;
  social: SocialAnalyticsSnapshot;
  productivity: ProductivityAnalyticsSnapshot;
}): ManagementInsight[] {
  const { commercial, financial, operational, clients, social, productivity } = params;
  const insights: ManagementInsight[] = [];

  // 1. Inadimplência financeira
  if (financial.current.delinquencyCents > 0) {
    insights.push({
      id: 'ins-fin-delinquency',
      severity: 'danger',
      area: 'financeiro',
      title: `Inadimplência aberta exige atenção (${formatBrlFromCents(
        financial.current.delinquencyCents
      )})`,
      evidence: `${financial.current.delinquencyCount} título(s) a receber vencido(s) sem baixa integral.`,
      sampleDescription: `Base: ${clients.clientsWithOverdueFinanceCount} cliente(s) com vencimentos em atraso.`,
      targetTab: 'finance',
      actionLabel: 'Abrir Financeiro',
    });
  }

  // 2. Resultado realizado positivo ou negativo comparativo
  if (
    financial.current.receivedRevenueCents > 0 ||
    financial.current.paidExpensesCents > 0
  ) {
    const profit = financial.current.realizedProfitCents;
    const prevProfit = financial.previous.realizedProfitCents;
    const delta = profit - prevProfit;
    const hasPrev =
      financial.previous.receivedRevenueCents > 0 ||
      financial.previous.paidExpensesCents > 0;
    insights.push({
      id: 'ins-fin-profit',
      severity: profit < 0 ? 'danger' : delta >= 0 ? 'positive' : 'warning',
      area: 'financeiro',
      title:
        profit < 0
          ? `Resultado realizado negativo no período (${formatBrlFromCents(profit)})`
          : `Resultado realizado positivo de ${formatBrlFromCents(profit)}`,
      evidence: `Entradas de ${formatBrlFromCents(
        financial.current.receivedRevenueCents
      )} menos saídas de ${formatBrlFromCents(financial.current.paidExpensesCents)}.`,
      sampleDescription: hasPrev
        ? `Variação vs período anterior (${financial.period.previousLabel}): ${formatBrlFromCents(
            delta,
            { signed: true }
          )}.`
        : 'Sem movimentação realizada no período anterior equivalente.',
      targetTab: 'finance',
      actionLabel: 'Ver Fluxo e Baixas',
    });
  }

  // 3. Saldo de caixa negativo
  if (financial.current.cashBalanceCents < 0) {
    insights.push({
      id: 'ins-fin-cash-neg',
      severity: 'danger',
      area: 'financeiro',
      title: `Saldo de caixa realizado negativo (${formatBrlFromCents(
        financial.current.cashBalanceCents
      )})`,
      evidence: 'O somatório de saídas efetivadas excede o saldo inicial + recebimentos.',
      sampleDescription: 'Posição global acumulada até a data atual.',
      targetTab: 'finance',
      actionLabel: 'Auditar Caixa',
    });
  }

  // 4. Atrasos operacionais em tarefas e projetos
  if (operational.tasks.overdueOpenCount > 0 || operational.projects.overdueActiveCount > 0) {
    insights.push({
      id: 'ins-ops-overdue',
      severity: 'warning',
      area: 'operacional',
      title: `${operational.tasks.overdueOpenCount} tarefa(s) e ${operational.projects.overdueActiveCount} projeto(s) com prazo vencido`,
      evidence: `Existem entregas ativas além do prazo estipulado (de ${operational.tasks.openCount} tarefa(s) e ${operational.projects.activeCount} projeto(s) ativos).`,
      sampleDescription: `Pressão de pendências atrasadas vs entregas no período: ${productivity.totalOverdueBacklog} atraso(s) vs ${productivity.tasksCompletedInPeriod} conclusão(ões).`,
      targetTab: operational.projects.overdueActiveCount > 0 ? 'projects' : 'tasks',
      actionLabel:
        operational.projects.overdueActiveCount > 0 ? 'Revisar Projetos' : 'Revisar Tarefas',
    });
  }

  // 5. Leads aguardando primeiro contato no CRM
  if (commercial.leadsUncontactedInBase > 0 && commercial.totalLeadsBase > 0) {
    const pctUncontacted = Math.round(
      (commercial.leadsUncontactedInBase / commercial.totalLeadsBase) * 100
    );
    if (pctUncontacted >= 30 || commercial.leadsUncontactedInBase >= 5) {
      insights.push({
        id: 'ins-crm-uncontacted',
        severity: pctUncontacted >= 60 ? 'warning' : 'info',
        area: 'comercial',
        title: `${commercial.leadsUncontactedInBase} lead(s) sem primeiro contato (${pctUncontacted}% da base)`,
        evidence: `${commercial.conversions.leadToContacted.ratioText} leads já avançaram para contato iniciado.`,
        sampleDescription: `Base comercial auditada: ${commercial.totalLeadsBase} lead(s) cadastrado(s).`,
        targetTab: 'kanban',
        actionLabel: 'Abrir Pipeline CRM',
      });
    }
  }

  // 6. Propostas em negociação em aberto
  if (commercial.proposalsOpenPipelineCount > 0) {
    insights.push({
      id: 'ins-crm-open-proposals',
      severity: 'info',
      area: 'comercial',
      title: `${commercial.proposalsOpenPipelineCount} proposta(s) em aberto aguardando resposta`,
      evidence: `Pipeline aberto soma ${formatBrlFromCents(
        Math.round(commercial.proposalsOpenPipelineSetup * 100)
      )} em setup + ${formatBrlFromCents(
        Math.round(commercial.proposalsOpenPipelineMrr * 100)
      )}/mês em recorrência.`,
      sampleDescription: `Aprovações no período: ${commercial.conversions.proposalApprovalRate.ratioText}.`,
      targetTab: 'proposals',
      actionLabel: 'Acompanhar Propostas',
    });
  }

  // 7. Clientes ativos sem projetos ativos ou potencialmente inativos
  if (clients.potentiallyInactiveClientsCount > 0) {
    const first = clients.inactiveAlertRows[0];
    insights.push({
      id: 'ins-cli-inactive',
      severity: 'warning',
      area: 'clientes',
      title: `${clients.potentiallyInactiveClientsCount} cliente(s) ativo(s) sem movimentação recente (21+ dias)`,
      evidence: first
        ? `Ex.: ${first.companyName} está há ${first.daysSinceLastActivity} dia(s) sem projetos/tarefas/movimentações.`
        : 'Clientes ativos sem atividades vinculadas.',
      sampleDescription: `Carteira ativa/onboarding: ${
        clients.activeCount + clients.onboardingCount
      } cliente(s).`,
      targetTab: 'clients',
      actionLabel: 'Ver Carteira',
    });
  }

  // 8. Publicações atrasadas no módulo Social
  if (social.overduePlannedCount > 0) {
    insights.push({
      id: 'ins-soc-overdue',
      severity: 'warning',
      area: 'social',
      title: `${social.overduePlannedCount} conteúdo(s) planejado(s) com data vencida sem publicação`,
      evidence: `${social.awaitingApprovalCount} peça(s) em revisão e ${social.approvedNotPublishedCount} aprovada(s) aguardando confirmação.`,
      sampleDescription: `Base editorial total: ${social.totalPostsBase} conteúdo(s).`,
      targetTab: 'social',
      actionLabel: 'Abrir Redes Sociais',
    });
  }

  // 9. Ritmo produtivo positivo quando houver volume relevante
  if (
    productivity.tasksCompletedInPeriod > 0 &&
    productivity.tasksCompletedInPeriod > productivity.previousTasksCompletedInPeriod
  ) {
    insights.push({
      id: 'ins-prod-up',
      severity: 'positive',
      area: 'produtividade',
      title: `Ritmo de entregas cresceu para ${productivity.tasksCompletedInPeriod} tarefa(s) concluída(s)`,
      evidence: `Média de ${productivity.tasksCompletedPerDayAvg} tarefa(s)/dia com atividade em ${productivity.activeDaysCount} de ${productivity.period.daysCount} dia(s) (${productivity.consistencyRatePct}%).`,
      sampleDescription: `Período anterior: ${productivity.previousTasksCompletedInPeriod} tarefa(s) concluída(s).`,
      targetTab: 'tasks',
      actionLabel: 'Abrir Tarefas',
    });
  }

  // Se o ambiente estiver totalmente vazio ou sem alertas
  if (insights.length === 0) {
    insights.push({
      id: 'ins-empty-baseline',
      severity: 'info',
      area: 'produtividade',
      title: 'Operação sem desvios críticos detectados no período',
      evidence:
        'Não há inadimplência, atrasos críticos ou gargalos registrados com amostra suficiente no recorte atual.',
      sampleDescription: `Período analisado: ${commercial.period.label}.`,
      targetTab: 'kanban',
      actionLabel: 'Ir para Operação',
    });
  }

  return insights.slice(0, 8);
}
