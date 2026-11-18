import { FUNNEL_STAGES, FunnelStageId, Lead, NicheCampaign, normalizeStageId } from '../../types/crm';
import { AgendaEvent, ProposalContract } from '../../types/kaizen';
import { ResolvedAnalyticsPeriod } from '../../types/analytics';
import {
  buildTimeBucketsForPeriod,
  computeRatioPct,
  extractLocalYmd,
  getBucketKeyForYmd,
  isDateInRange,
} from './periodService';
import { diffDaysYmd } from '../finance/money';

export interface FunnelStageAnalytics {
  stageId: FunnelStageId;
  stageName: string;
  shortName: string;
  order: number;
  countTotal: number;
  countInPeriod: number;
  percentOfPipeline: number | null;
  estimatedCreationTotal: number;
  estimatedMrrTotal: number;
}

export interface StageConversionMetric {
  id: string;
  label: string;
  numerator: number;
  denominator: number;
  ratePct: number | null;
  ratioText: string;
}

export interface NicheBreakdownRow {
  nicheId: string;
  nicheName: string;
  totalLeads: number;
  leadsInPeriod: number;
  contactedLeads: number;
  meetingsCount: number;
  closedCount: number;
  closingRatePct: number | null;
  estimatedMrr: number;
}

export interface DimensionBreakdownRow {
  label: string;
  total: number;
  closed: number;
  closingRatePct: number | null;
}

export interface CommercialPeriodPoint {
  key: string;
  label: string;
  leadsCreated: number;
  leadsContacted: number;
  proposalsCreated: number;
  proposalsConverted: number;
}

export interface CommercialAnalyticsSnapshot {
  period: ResolvedAnalyticsPeriod;
  totalLeadsBase: number;
  leadsCreatedInPeriod: number;
  previousLeadsCreatedInPeriod: number;
  leadsContactedInPeriod: number;
  leadsUncontactedInBase: number;
  followUpActiveCount: number;
  meetingsScheduledInPeriod: number;
  meetingsRealizedInPeriod: number;
  closedLeadsInBase: number;
  closedLeadsWithActivityInPeriod: number;
  // Propostas & Contratos reais
  totalProposalsBase: number;
  proposalsCreatedInPeriod: number;
  proposalsSentInPeriod: number;
  proposalsApprovedOrSignedInPeriod: number;
  previousProposalsApprovedOrSignedInPeriod: number;
  proposalsRefusedInPeriod: number;
  proposalsOpenPipelineCount: number;
  proposalsOpenPipelineSetup: number;
  proposalsOpenPipelineMrr: number;
  proposalsApprovedMrrInPeriod: number;
  proposalsApprovedSetupInPeriod: number;
  // Conversões explícitas com numerador e denominador
  conversions: {
    leadToContacted: StageConversionMetric;
    contactedToMeeting: StageConversionMetric;
    meetingToClosed: StageConversionMetric;
    leadToClosedOverall: StageConversionMetric;
    proposalApprovalRate: StageConversionMetric;
  };
  // Tempo médio honesto até aprovação/assinatura
  avgDaysToClose: {
    valueDays: number | null;
    sampleSize: number;
    basisDescription: string;
  };
  funnelStages: FunnelStageAnalytics[];
  byNiche: NicheBreakdownRow[];
  byCity: DimensionBreakdownRow[];
  byCategory: DimensionBreakdownRow[];
  timeSeries: CommercialPeriodPoint[];
  dataLimitationsNote: string;
}

const CONTACTED_STAGES = new Set<FunnelStageId>([
  'primeiro_contato',
  'nao_atendida',
  'mandei_mensagem',
  'follow_up_1',
  'follow_up_2',
  'reuniao_marcada',
  'fechado',
]);

function makeConversionMetric(
  id: string,
  label: string,
  numerator: number,
  denominator: number
): StageConversionMetric {
  return {
    id,
    label,
    numerator,
    denominator,
    ratePct: computeRatioPct(numerator, denominator),
    ratioText: `${numerator} / ${denominator}`,
  };
}

export function computeCommercialAnalytics(params: {
  leads: Lead[];
  niches: NicheCampaign[];
  proposals: ProposalContract[];
  agendaEvents: AgendaEvent[];
  period: ResolvedAnalyticsPeriod;
  nicheIdFilter?: string;
  timezone?: string;
}): CommercialAnalyticsSnapshot {
  const {
    leads: allLeads,
    niches,
    proposals: allProposals,
    agendaEvents,
    period,
    nicheIdFilter,
    timezone,
  } = params;

  const leads = nicheIdFilter
    ? allLeads.filter((l) => l.nicheId === nicheIdFilter)
    : allLeads;

  const leadIdsSet = new Set(leads.map((l) => l.id));
  const proposals = nicheIdFilter
    ? allProposals.filter((p) => !p.leadId || leadIdsSet.has(p.leadId))
    : allProposals;

  const nicheMap = new Map(niches.map((n) => [n.id, n]));

  const leadsCreatedInPeriodList = leads.filter((l) =>
    isDateInRange(l.createdAt, period.startDate, period.endDate, timezone)
  );
  const previousLeadsCreatedInPeriod = leads.filter((l) =>
    isDateInRange(l.createdAt, period.previousStartDate, period.previousEndDate, timezone)
  ).length;

  const leadsContactedInPeriodList = leads.filter((l) =>
    isDateInRange(l.lastContactDate, period.startDate, period.endDate, timezone)
  );

  // Funil completo da base filtrada + recorte de leads criados/contatados no período
  const stageCountsTotal = new Map<FunnelStageId, number>();
  const stageCountsPeriod = new Map<FunnelStageId, number>();
  const stageCreationVal = new Map<FunnelStageId, number>();
  const stageMrrVal = new Map<FunnelStageId, number>();

  let contactedBaseCount = 0;
  let meetingOrBeyondBaseCount = 0;
  let closedBaseCount = 0;
  let followUpActiveCount = 0;
  let leadsUncontactedInBase = 0;
  let closedLeadsWithActivityInPeriod = 0;

  for (const lead of leads) {
    const stage = normalizeStageId(lead.stage);
    stageCountsTotal.set(stage, (stageCountsTotal.get(stage) || 0) + 1);
    stageCreationVal.set(
      stage,
      (stageCreationVal.get(stage) || 0) + (Number(lead.creationValue) || 0)
    );
    stageMrrVal.set(stage, (stageMrrVal.get(stage) || 0) + (Number(lead.monthlyMrr) || 0));

    const touchedInPeriod =
      isDateInRange(lead.createdAt, period.startDate, period.endDate, timezone) ||
      isDateInRange(lead.lastContactDate, period.startDate, period.endDate, timezone) ||
      isDateInRange(lead.updatedAt, period.startDate, period.endDate, timezone);
    if (touchedInPeriod) {
      stageCountsPeriod.set(stage, (stageCountsPeriod.get(stage) || 0) + 1);
    }

    if (stage === 'leads_sem_contato') {
      leadsUncontactedInBase += 1;
    }
    if (CONTACTED_STAGES.has(stage)) {
      contactedBaseCount += 1;
    }
    if (stage === 'follow_up_1' || stage === 'follow_up_2') {
      followUpActiveCount += 1;
    }
    if (stage === 'reuniao_marcada' || stage === 'fechado') {
      meetingOrBeyondBaseCount += 1;
    }
    if (stage === 'fechado') {
      closedBaseCount += 1;
      if (touchedInPeriod) {
        closedLeadsWithActivityInPeriod += 1;
      }
    }
  }

  // Reuniões registradas tanto em Agenda Integrada quanto em leads.meetingDate no período
  const meetingsFromLeadsScheduled = leads.filter(
    (l) =>
      l.meetingDate &&
      isDateInRange(l.meetingDate, period.startDate, period.endDate, timezone) &&
      l.meetingStatus !== 'cancelada'
  ).length;
  const meetingsFromAgendaScheduled = agendaEvents.filter(
    (ev) =>
      (ev.type === 'reuniao_comercial' || ev.type === 'reuniao_cliente') &&
      ev.status !== 'cancelado' &&
      isDateInRange(ev.date, period.startDate, period.endDate, timezone)
  ).length;
  const meetingsScheduledInPeriod = meetingsFromLeadsScheduled + meetingsFromAgendaScheduled;

  const meetingsFromLeadsRealized = leads.filter(
    (l) =>
      l.meetingDate &&
      isDateInRange(l.meetingDate, period.startDate, period.endDate, timezone) &&
      l.meetingStatus === 'realizada'
  ).length;
  const meetingsFromAgendaRealized = agendaEvents.filter(
    (ev) =>
      (ev.type === 'reuniao_comercial' || ev.type === 'reuniao_cliente') &&
      ev.status === 'concluido' &&
      isDateInRange(ev.date, period.startDate, period.endDate, timezone)
  ).length;
  const meetingsRealizedInPeriod = meetingsFromLeadsRealized + meetingsFromAgendaRealized;

  // Propostas & Contratos reais
  const proposalsCreatedInPeriod = proposals.filter((p) =>
    isDateInRange(p.createdAt, period.startDate, period.endDate, timezone)
  );
  const proposalsSentInPeriod = proposals.filter((p) =>
    isDateInRange(p.sentAt || (p.status !== 'rascunho' ? p.createdAt : undefined), period.startDate, period.endDate, timezone)
  );
  const proposalsApprovedOrSignedInPeriod = proposals.filter(
    (p) =>
      (p.status === 'aprovada' || p.status === 'assinada') &&
      isDateInRange(
        p.signedAt || p.approvedAt || p.updatedAt || p.createdAt,
        period.startDate,
        period.endDate,
        timezone
      )
  );
  const previousProposalsApprovedOrSignedInPeriod = proposals.filter(
    (p) =>
      (p.status === 'aprovada' || p.status === 'assinada') &&
      isDateInRange(
        p.signedAt || p.approvedAt || p.updatedAt || p.createdAt,
        period.previousStartDate,
        period.previousEndDate,
        timezone
      )
  ).length;

  const proposalsRefusedInPeriod = proposals.filter(
    (p) =>
      p.status === 'recusada' &&
      isDateInRange(p.updatedAt || p.createdAt, period.startDate, period.endDate, timezone)
  );

  const openProposals = proposals.filter(
    (p) => p.status === 'enviada' || p.status === 'em_negociacao'
  );
  const proposalsOpenPipelineSetup = openProposals.reduce(
    (s, p) => s + (Number(p.setupTotal) || 0),
    0
  );
  const proposalsOpenPipelineMrr = openProposals.reduce(
    (s, p) => s + (Number(p.monthlyMrr) || 0),
    0
  );

  const proposalsApprovedMrrInPeriod = proposalsApprovedOrSignedInPeriod.reduce(
    (s, p) => s + (Number(p.monthlyMrr) || 0),
    0
  );
  const proposalsApprovedSetupInPeriod = proposalsApprovedOrSignedInPeriod.reduce(
    (s, p) => s + (Number(p.setupTotal) || 0),
    0
  );

  // Taxa de aprovação considerando propostas com decisão final ou enviadas no período
  const decidedOrSentDenominator =
    proposalsApprovedOrSignedInPeriod.length + proposalsRefusedInPeriod.length > 0
      ? Math.max(
          proposalsSentInPeriod.length,
          proposalsApprovedOrSignedInPeriod.length + proposalsRefusedInPeriod.length
        )
      : proposalsSentInPeriod.length;

  // Tempo médio até fechamento (honesto: apenas quando sentAt/createdAt e approvedAt/signedAt existem)
  const closingDurationsDays: number[] = [];
  for (const prop of proposals) {
    if (prop.status !== 'aprovada' && prop.status !== 'assinada') continue;
    const endYmd = extractLocalYmd(prop.signedAt || prop.approvedAt, timezone);
    const startYmd = extractLocalYmd(prop.sentAt || prop.createdAt, timezone);
    if (!endYmd || !startYmd) continue;
    const days = diffDaysYmd(endYmd, startYmd);
    if (days >= 0) {
      closingDurationsDays.push(days);
    }
  }
  const avgDaysToCloseValue =
    closingDurationsDays.length > 0
      ? Number(
          (
            closingDurationsDays.reduce((sum, d) => sum + d, 0) / closingDurationsDays.length
          ).toFixed(1)
        )
      : null;

  const funnelStages: FunnelStageAnalytics[] = FUNNEL_STAGES.map((stage) => {
    const countTotal = stageCountsTotal.get(stage.id) || 0;
    return {
      stageId: stage.id,
      stageName: stage.name,
      shortName: stage.shortName,
      order: stage.order,
      countTotal,
      countInPeriod: stageCountsPeriod.get(stage.id) || 0,
      percentOfPipeline: computeRatioPct(countTotal, leads.length),
      estimatedCreationTotal: stageCreationVal.get(stage.id) || 0,
      estimatedMrrTotal: stageMrrVal.get(stage.id) || 0,
    };
  });

  // Desempenho por Nicho / Campanha
  const nicheAgg = new Map<string, NicheBreakdownRow>();
  for (const niche of niches) {
    if (nicheIdFilter && niche.id !== nicheIdFilter) continue;
    nicheAgg.set(niche.id, {
      nicheId: niche.id,
      nicheName: niche.name,
      totalLeads: 0,
      leadsInPeriod: 0,
      contactedLeads: 0,
      meetingsCount: 0,
      closedCount: 0,
      closingRatePct: null,
      estimatedMrr: 0,
    });
  }

  for (const lead of leads) {
    const key = lead.nicheId || 'sem_nicho';
    const existing = nicheAgg.get(key) || {
      nicheId: key,
      nicheName: nicheMap.get(key)?.name || 'Sem campanha vinculada',
      totalLeads: 0,
      leadsInPeriod: 0,
      contactedLeads: 0,
      meetingsCount: 0,
      closedCount: 0,
      closingRatePct: null,
      estimatedMrr: 0,
    };
    const stage = normalizeStageId(lead.stage);
    existing.totalLeads += 1;
    if (isDateInRange(lead.createdAt, period.startDate, period.endDate, timezone)) {
      existing.leadsInPeriod += 1;
    }
    if (CONTACTED_STAGES.has(stage)) existing.contactedLeads += 1;
    if (stage === 'reuniao_marcada' || stage === 'fechado') existing.meetingsCount += 1;
    if (stage === 'fechado') {
      existing.closedCount += 1;
      existing.estimatedMrr += Number(lead.monthlyMrr) || 0;
    }
    nicheAgg.set(key, existing);
  }

  const byNiche = Array.from(nicheAgg.values())
    .map((row) => ({
      ...row,
      closingRatePct: computeRatioPct(row.closedCount, row.totalLeads),
    }))
    .sort((a, b) => b.totalLeads - a.totalLeads);

  // Quebras por cidade e categoria (campos reais do Lead)
  const buildDimension = (getter: (l: Lead) => string): DimensionBreakdownRow[] => {
    const map = new Map<string, { total: number; closed: number }>();
    for (const lead of leads) {
      const label = getter(lead).trim() || 'Não informado';
      const cur = map.get(label) || { total: 0, closed: 0 };
      cur.total += 1;
      if (normalizeStageId(lead.stage) === 'fechado') cur.closed += 1;
      map.set(label, cur);
    }
    return Array.from(map.entries())
      .map(([label, v]) => ({
        label,
        total: v.total,
        closed: v.closed,
        closingRatePct: computeRatioPct(v.closed, v.total),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  };

  // Série temporal comercial dentro do período
  const buckets = buildTimeBucketsForPeriod(period);
  const seriesMap = new Map<string, CommercialPeriodPoint>();
  for (const b of buckets) {
    seriesMap.set(b.key, {
      key: b.key,
      label: b.label,
      leadsCreated: 0,
      leadsContacted: 0,
      proposalsCreated: 0,
      proposalsConverted: 0,
    });
  }

  for (const lead of leads) {
    const createdYmd = extractLocalYmd(lead.createdAt, timezone);
    if (createdYmd && createdYmd >= period.startDate && createdYmd <= period.endDate) {
      const key = getBucketKeyForYmd(createdYmd, buckets);
      if (key && seriesMap.has(key)) seriesMap.get(key)!.leadsCreated += 1;
    }
    const contactYmd = extractLocalYmd(lead.lastContactDate, timezone);
    if (contactYmd && contactYmd >= period.startDate && contactYmd <= period.endDate) {
      const key = getBucketKeyForYmd(contactYmd, buckets);
      if (key && seriesMap.has(key)) seriesMap.get(key)!.leadsContacted += 1;
    }
  }

  for (const prop of proposals) {
    const createdYmd = extractLocalYmd(prop.createdAt, timezone);
    if (createdYmd && createdYmd >= period.startDate && createdYmd <= period.endDate) {
      const key = getBucketKeyForYmd(createdYmd, buckets);
      if (key && seriesMap.has(key)) seriesMap.get(key)!.proposalsCreated += 1;
    }
    if (prop.status === 'aprovada' || prop.status === 'assinada') {
      const convYmd = extractLocalYmd(prop.signedAt || prop.approvedAt, timezone);
      if (convYmd && convYmd >= period.startDate && convYmd <= period.endDate) {
        const key = getBucketKeyForYmd(convYmd, buckets);
        if (key && seriesMap.has(key)) seriesMap.get(key)!.proposalsConverted += 1;
      }
    }
  }

  return {
    period,
    totalLeadsBase: leads.length,
    leadsCreatedInPeriod: leadsCreatedInPeriodList.length,
    previousLeadsCreatedInPeriod,
    leadsContactedInPeriod: leadsContactedInPeriodList.length,
    leadsUncontactedInBase,
    followUpActiveCount,
    meetingsScheduledInPeriod,
    meetingsRealizedInPeriod,
    closedLeadsInBase: closedBaseCount,
    closedLeadsWithActivityInPeriod,
    totalProposalsBase: proposals.length,
    proposalsCreatedInPeriod: proposalsCreatedInPeriod.length,
    proposalsSentInPeriod: proposalsSentInPeriod.length,
    proposalsApprovedOrSignedInPeriod: proposalsApprovedOrSignedInPeriod.length,
    previousProposalsApprovedOrSignedInPeriod,
    proposalsRefusedInPeriod: proposalsRefusedInPeriod.length,
    proposalsOpenPipelineCount: openProposals.length,
    proposalsOpenPipelineSetup,
    proposalsOpenPipelineMrr,
    proposalsApprovedMrrInPeriod,
    proposalsApprovedSetupInPeriod,
    conversions: {
      leadToContacted: makeConversionMetric(
        'lead_to_contacted',
        'Lead -> Contato iniciado',
        contactedBaseCount,
        leads.length
      ),
      contactedToMeeting: makeConversionMetric(
        'contacted_to_meeting',
        'Contato -> Reunião / Fechamento',
        meetingOrBeyondBaseCount,
        contactedBaseCount
      ),
      meetingToClosed: makeConversionMetric(
        'meeting_to_closed',
        'Reunião -> Fechamento',
        closedBaseCount,
        meetingOrBeyondBaseCount
      ),
      leadToClosedOverall: makeConversionMetric(
        'lead_to_closed',
        'Conversão global da base',
        closedBaseCount,
        leads.length
      ),
      proposalApprovalRate: makeConversionMetric(
        'proposal_approval',
        'Aprovação / Assinatura de propostas',
        proposalsApprovedOrSignedInPeriod.length,
        decidedOrSentDenominator
      ),
    },
    avgDaysToClose: {
      valueDays: avgDaysToCloseValue,
      sampleSize: closingDurationsDays.length,
      basisDescription:
        closingDurationsDays.length > 0
          ? `Calculado com base em ${closingDurationsDays.length} proposta(s)/contrato(s) com datas reais de envio/criação e aprovação/assinatura.`
          : 'Ainda não há propostas aprovadas/assinadas com registro temporal completo para calcular o ciclo médio.',
    },
    funnelStages,
    byNiche,
    byCity: buildDimension((l) => l.city || ''),
    byCategory: buildDimension((l) => l.category || ''),
    timeSeries: Array.from(seriesMap.values()),
    dataLimitationsNote:
      'O modelo atual de Leads não possui campo dedicado de canal de origem (ex.: Google Maps, Indicação, Orgânico). A segmentação comercial usa Nicho/Campanha, Cidade e Categoria cadastrados no CRM.',
  };
}
