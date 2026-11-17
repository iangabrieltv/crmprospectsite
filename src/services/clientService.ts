import { Lead, NicheCampaign } from '../types/crm';
import {
  Client,
  ClientStatus,
  ClientTimelineEvent,
  ProposalContract,
} from '../types/kaizen';
import { cleanPhoneForWhatsApp, formatDisplayPhone } from '../utils/phone';

const MAX_TIMELINE_EVENTS = 200;

export function generateClientId(): string {
  const rand = Math.random().toString(36).substring(2, 7);
  return `cli-${Date.now()}-${rand}`;
}

export function generateTimelineEventId(prefix: string = 'evt'): string {
  const rand = Math.random().toString(36).substring(2, 6);
  return `${prefix}-${Date.now()}-${rand}`;
}

function normalizeCompanyName(name: string | undefined): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DuplicateClientMatch {
  reason: 'originLeadId' | 'phone' | 'companyName';
  existingClient: Client;
}

/**
 * Prevents client duplication when converting CRM leads or registering manually.
 * Prioritizes exact originLeadId link, then normalized phone, then exact company name.
 */
export function findDuplicateClient(
  clients: Client[],
  candidate: {
    originLeadId?: string;
    phone?: string;
    companyName?: string;
    excludeClientId?: string;
  }
): DuplicateClientMatch | null {
  const pool = candidate.excludeClientId
    ? clients.filter((c) => c.id !== candidate.excludeClientId)
    : clients;

  if (candidate.originLeadId) {
    const byLead = pool.find((c) => c.originLeadId === candidate.originLeadId);
    if (byLead) {
      return { reason: 'originLeadId', existingClient: byLead };
    }
  }

  const cleanTargetPhone = cleanPhoneForWhatsApp(candidate.phone || '');
  if (cleanTargetPhone.length >= 8) {
    const byPhone = pool.find((c) => {
      const existingClean = cleanPhoneForWhatsApp(c.phone || '');
      return existingClean.length >= 8 && existingClean === cleanTargetPhone;
    });
    if (byPhone) {
      return { reason: 'phone', existingClient: byPhone };
    }
  }

  const normCompany = normalizeCompanyName(candidate.companyName);
  if (normCompany.length >= 3) {
    const byName = pool.find((c) => normalizeCompanyName(c.companyName) === normCompany);
    if (byName) {
      return { reason: 'companyName', existingClient: byName };
    }
  }

  return null;
}

export function appendClientTimelineEvents(
  existing: ClientTimelineEvent[],
  newEvents: ClientTimelineEvent[]
): ClientTimelineEvent[] {
  const combined = [...newEvents, ...(existing || [])];
  return combined.slice(0, MAX_TIMELINE_EVENTS);
}

/**
 * Converts a CRM Lead into a full Client dossier while importing all Lead notes and
 * key commercial milestones into the client's timeline with zero history loss.
 */
export function buildClientFromLead(
  lead: Lead,
  niche?: NicheCampaign,
  author: string = 'Ian',
  options?: {
    status?: ClientStatus;
    serviceScope?: string;
    setupValue?: number;
    monthlyMrr?: number;
    contractStartDate?: string;
    notes?: string;
    proposalCode?: string;
  }
): Client {
  const nowIso = new Date().toISOString();
  const todayLocal = nowIso.slice(0, 10);
  const cleanPhone = cleanPhoneForWhatsApp(lead.phone || '');

  const importedLeadNotes: ClientTimelineEvent[] = (lead.notes || []).map((n, idx) => ({
    id: `imp-note-${lead.id}-${idx}-${Date.now().toString(36)}`,
    date: nowIso,
    type: 'anotacao',
    title: `Nota importada do CRM (${n.date || 'histórico'})`,
    description: n.text,
    author: n.author || author,
  }));

  const milestones: ClientTimelineEvent[] = [
    {
      id: generateTimelineEventId('conv'),
      date: nowIso,
      type: 'conversao_lead',
      title: options?.proposalCode
        ? `Convertido em cliente via ${options.proposalCode}`
        : 'Lead convertido em cliente no Kaizen',
      description: `Origem: ${lead.companyName}${niche ? ` (${niche.name})` : ''}.`,
      author,
    },
  ];

  if (lead.meetingDate) {
    milestones.push({
      id: generateTimelineEventId('meet'),
      date: nowIso,
      type: 'anotacao',
      title: `Reunião comercial registrada (${lead.meetingDate}${
        lead.meetingTime ? ` às ${lead.meetingTime}` : ''
      })`,
      description: lead.meetingNotes || 'Reunião comercial vinculada ao lead de origem.',
      author,
    });
  }

  const timeline = [...milestones, ...importedLeadNotes].slice(0, MAX_TIMELINE_EVENTS);

  return {
    id: generateClientId(),
    originLeadId: lead.id,
    originNicheId: lead.nicheId,
    companyName: lead.companyName.trim(),
    contactName: lead.contactName?.trim() || undefined,
    phone: cleanPhone,
    displayPhone: cleanPhone ? formatDisplayPhone(cleanPhone) : lead.displayPhone || '',
    city: lead.city || niche?.city || undefined,
    address: lead.address || undefined,
    segment: lead.category || niche?.segment || undefined,
    websiteUrl: lead.websiteUrl || lead.mockupUrl || undefined,
    status: options?.status || 'ativo',
    setupValue: options?.setupValue ?? lead.creationValue,
    monthlyMrr: options?.monthlyMrr ?? lead.monthlyMrr,
    billingDay: 10,
    contractStartDate: options?.contractStartDate || todayLocal,
    serviceScope:
      options?.serviceScope ||
      (niche ? `Projeto & Gestão — ${niche.segment}` : 'Criação de Site e Presença Digital'),
    notes: options?.notes || undefined,
    timeline,
    createdAt: nowIso,
    schemaVersion: 1,
    updatedAt: nowIso,
  };
}

/**
 * Merges a newly approved/signed proposal onto an already existing Client without creating duplicates.
 */
export function mergeClientWithProposalAcceptance(
  client: Client,
  proposal: ProposalContract,
  author: string = 'Ian',
  options?: { updateFinancials?: boolean }
): Client {
  const nowIso = new Date().toISOString();
  const isSigned = proposal.status === 'assinada';
  const event: ClientTimelineEvent = {
    id: generateTimelineEventId('prop'),
    date: nowIso,
    type: isSigned ? 'contrato_assinado' : 'proposta_vinculada',
    title: isSigned
      ? `Contrato ${proposal.code} assinado`
      : `Proposta ${proposal.code} aprovada`,
    description: `${proposal.title} · Setup R$ ${proposal.setupTotal.toLocaleString(
      'pt-BR'
    )} · MRR R$ ${proposal.monthlyMrr.toLocaleString('pt-BR')}/mês`,
    author,
  };

  const shouldUpdateFinancials = options?.updateFinancials ?? true;

  return {
    ...client,
    originLeadId: client.originLeadId || proposal.leadId || undefined,
    setupValue:
      shouldUpdateFinancials && proposal.setupTotal > 0
        ? proposal.setupTotal
        : client.setupValue,
    monthlyMrr:
      shouldUpdateFinancials && proposal.monthlyMrr > 0
        ? proposal.monthlyMrr
        : client.monthlyMrr,
    status: client.status === 'encerrado' ? 'ativo' : client.status,
    contractStartDate: client.contractStartDate || nowIso.slice(0, 10),
    timeline: appendClientTimelineEvents(client.timeline || [], [event]),
    updatedAt: nowIso,
  };
}

export interface ClientPortfolioSummary {
  totalClients: number;
  activeClients: number;
  onboardingClients: number;
  pausedClients: number;
  closedClients: number;
  activeMrr: number;
  contractedSetup: number;
}

export function computeClientSummary(clients: Client[]): ClientPortfolioSummary {
  let activeClients = 0;
  let onboardingClients = 0;
  let pausedClients = 0;
  let closedClients = 0;
  let activeMrr = 0;
  let contractedSetup = 0;

  for (const c of clients) {
    if (c.status === 'ativo') {
      activeClients += 1;
      activeMrr += c.monthlyMrr || 0;
      contractedSetup += c.setupValue || 0;
    } else if (c.status === 'onboarding') {
      onboardingClients += 1;
      activeMrr += c.monthlyMrr || 0;
      contractedSetup += c.setupValue || 0;
    } else if (c.status === 'pausado') {
      pausedClients += 1;
    } else if (c.status === 'encerrado') {
      closedClients += 1;
    }
  }

  return {
    totalClients: clients.length,
    activeClients,
    onboardingClients,
    pausedClients,
    closedClients,
    activeMrr,
    contractedSetup,
  };
}
