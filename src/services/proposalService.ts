import { Lead, NicheCampaign } from '../types/crm';
import {
  Client,
  DocumentKind,
  ProposalContract,
  ProposalHistoryEvent,
  ProposalLineItem,
  ProposalStatus,
  getProposalStatusMeta,
} from '../types/kaizen';
import { cleanPhoneForWhatsApp } from '../utils/phone';

const MAX_HISTORY_EVENTS = 200;

export const DEFAULT_CONTRACT_CLAUSES = `1. OBJETO DA PRESTAÇÃO DE SERVIÇOS
A CONTRATADA compromete-se a executar os serviços digitais descritos no escopo desta proposta/contrato, contemplando criação, configuração técnica, layout responsivo e implantação conforme briefing aprovado pela CONTRATANTE.

2. PRAZO DE ENTREGA E APROVAÇÃO
O prazo estimado de entrega da primeira versão para revisão é contado em dias úteis após o envio completo dos materiais, acessos e confirmação do pagamento inicial (Setup). Ajustes solicitados dentro do escopo acordado serão executados sem custo adicional durante a janela de homologação.

3. INVESTIMENTO, IMPLANTAÇÃO E RECORRÊNCIA
Os valores de implantação (Setup) e manutenção/suporte mensal (MRR), quando aplicáveis, obedecem às condições comerciais especificadas no quadro financeiro deste documento. A recorrência mensal cobre infraestrutura gerenciada, monitoramento, backups e pequenas atualizações contínuas.

4. PROPRIEDADE INTELECTUAL E CONFIDENCIALIDADE
Após a quitação integral dos valores de implantação, os ativos finais entregues pertencem à CONTRATANTE. Ambas as partes comprometem-se a manter sigilo sobre dados estratégicos, acessos e informações comerciais trocadas durante a vigência do projeto.

5. RESCISÃO E DISPOSIÇÕES GERAIS
A recorrência mensal poderá ser cancelada mediante aviso prévio de 30 (trinta) dias por escrito, sem multa após o período mínimo acordado entre as partes.`;

export function generateProposalId(): string {
  const rand = Math.random().toString(36).substring(2, 7);
  return `prop-${Date.now()}-${rand}`;
}

export function generateProposalItemId(): string {
  const rand = Math.random().toString(36).substring(2, 6);
  return `item-${Date.now()}-${rand}`;
}

export function generateNextProposalCode(
  existingProposals: ProposalContract[],
  kind: DocumentKind,
  refDate: Date = new Date()
): string {
  const year = refDate.getFullYear();
  const prefix = kind === 'contrato' ? 'KZ-C' : 'KZ-P';
  const sameYearPrefix = `${prefix}-${year}-`;

  let maxSeq = 0;
  for (const p of existingProposals) {
    if (p.code && p.code.startsWith(sameYearPrefix)) {
      const tail = Number.parseInt(p.code.slice(sameYearPrefix.length), 10);
      if (!Number.isNaN(tail) && tail > maxSeq) {
        maxSeq = tail;
      }
    }
  }

  return `${sameYearPrefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export function calculateProposalTotals(
  items: ProposalLineItem[],
  discountValue: number = 0
): { setupTotal: number; monthlyMrr: number; grossSetup: number } {
  let grossSetup = 0;
  let monthlyMrr = 0;

  for (const item of items) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    const lineTotal = qty * price;
    if (item.billingType === 'mensal') {
      monthlyMrr += lineTotal;
    } else {
      grossSetup += lineTotal;
    }
  }

  const safeDiscount = Math.max(0, Number(discountValue) || 0);
  const setupTotal = Math.max(0, grossSetup - safeDiscount);
  return { setupTotal, monthlyMrr, grossSetup };
}

export function buildProposalFromSource(params: {
  kind: DocumentKind;
  existingProposals: ProposalContract[];
  issuerName: string;
  lead?: Lead | null;
  client?: Client | null;
  niche?: NicheCampaign | null;
}): Omit<ProposalContract, 'id' | 'createdAt'> {
  const { kind, existingProposals, issuerName, lead, client, niche } = params;
  const now = new Date();
  const validDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const recipientCompany = client?.companyName || lead?.companyName || '';
  const recipientContact = client?.contactName || lead?.contactName || '';
  const recipientPhone = cleanPhoneForWhatsApp(client?.phone || lead?.phone || '');
  const recipientCity = client?.city || lead?.city || niche?.city || '';
  const recipientDocument = client?.document || '';
  const recipientEmail = client?.email || '';

  const baseSetup = client?.setupValue ?? lead?.creationValue ?? 997;
  const baseMrr = client?.monthlyMrr ?? lead?.monthlyMrr ?? 197;

  const items: ProposalLineItem[] = [
    {
      id: generateProposalItemId(),
      title: 'Desenvolvimento e Implantação de Site Profissional',
      description:
        'Estrutura responsiva focada em conversão, integração com WhatsApp e otimização para Google.',
      billingType: 'setup',
      quantity: 1,
      unitPrice: baseSetup > 0 ? baseSetup : 997,
    },
  ];

  if (baseMrr > 0) {
    items.push({
      id: generateProposalItemId(),
      title: 'Gestão Técnica, Hospedagem e Suporte Contínuo',
      description:
        'Monitoramento, backups automáticos, SSL e atualizações mensais sob demanda.',
      billingType: 'mensal',
      quantity: 1,
      unitPrice: baseMrr,
    });
  }

  const totals = calculateProposalTotals(items, 0);
  const docLabel = kind === 'contrato' ? 'Contrato de Prestação de Serviços' : 'Proposta Comercial';

  const history: ProposalHistoryEvent[] = [
    {
      id: `hist-${Date.now()}`,
      date: now.toISOString(),
      status: 'rascunho',
      title: `${docLabel} criada`,
      note: client
        ? `Vinculada ao cliente ${client.companyName}.`
        : lead
        ? `Originada do lead ${lead.companyName} no CRM.`
        : 'Documento avulso criado no módulo comercial.',
      author: issuerName,
    },
  ];

  return {
    code: generateNextProposalCode(existingProposals, kind, now),
    kind,
    title: recipientCompany
      ? `${docLabel} — ${recipientCompany}`
      : `${docLabel} — Posicionamento Digital`,
    status: 'rascunho',
    clientId: client?.id,
    leadId: client?.originLeadId || lead?.id,
    recipientCompany,
    recipientContact: recipientContact || undefined,
    recipientDocument: recipientDocument || undefined,
    recipientPhone: recipientPhone || undefined,
    recipientEmail: recipientEmail || undefined,
    recipientCity: recipientCity || undefined,
    issuerName: issuerName || 'Agência Kaizen',
    summary:
      'Solução completa de presença digital de alta conversão, estruturada para atrair clientes qualificados e fortalecer a autoridade da empresa.',
    items,
    discountValue: 0,
    setupTotal: totals.setupTotal,
    monthlyMrr: totals.monthlyMrr,
    deliveryDeadlineDays: 7,
    paymentTerms: '50% na aprovação e 50% na entrega final · Recorrência mensal após publicação.',
    clausesText: kind === 'contrato' ? DEFAULT_CONTRACT_CLAUSES : undefined,
    validUntil: validDate,
    history,
    schemaVersion: 1,
    updatedAt: now.toISOString(),
  };
}

export function transitionProposalStatus(
  proposal: ProposalContract,
  nextStatus: ProposalStatus,
  author: string = 'Ian',
  note?: string
): ProposalContract {
  const nowIso = new Date().toISOString();
  const statusMeta = getProposalStatusMeta(nextStatus);

  const event: ProposalHistoryEvent = {
    id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    date: nowIso,
    status: nextStatus,
    title: `Status alterado para ${statusMeta.label}`,
    note: note || undefined,
    author,
  };

  return {
    ...proposal,
    status: nextStatus,
    sentAt: nextStatus === 'enviada' && !proposal.sentAt ? nowIso : proposal.sentAt,
    approvedAt:
      nextStatus === 'aprovada' && !proposal.approvedAt ? nowIso : proposal.approvedAt,
    signedAt: nextStatus === 'assinada' && !proposal.signedAt ? nowIso : proposal.signedAt,
    history: [event, ...(proposal.history || [])].slice(0, MAX_HISTORY_EVENTS),
    updatedAt: nowIso,
  };
}

export function buildProposalWhatsAppMessage(proposal: ProposalContract): string {
  const contact = proposal.recipientContact
    ? proposal.recipientContact
    : proposal.recipientCompany;
  const docLabel = proposal.kind === 'contrato' ? 'Contrato' : 'Proposta Comercial';
  const lines = [
    `Olá, ${contact}! Tudo bem?`,
    ``,
    `Segue o resumo do documento *${docLabel} (${proposal.code})* — *${proposal.title}*:`,
    proposal.setupTotal > 0
      ? `• Implantação (Setup): *R$ ${proposal.setupTotal.toLocaleString('pt-BR')}*`
      : null,
    proposal.monthlyMrr > 0
      ? `• Mensalidade (Recorrência): *R$ ${proposal.monthlyMrr.toLocaleString('pt-BR')}/mês*`
      : null,
    proposal.deliveryDeadlineDays
      ? `• Prazo estimado de entrega: *${proposal.deliveryDeadlineDays} dias*`
      : null,
    proposal.validUntil
      ? `• Validade: ${proposal.validUntil.split('-').reverse().join('/')}`
      : null,
    ``,
    `Estou enviando o PDF completo em seguida. Qualquer dúvida ou ajuste, fico à disposição!`,
    `— ${proposal.issuerName}`,
  ].filter((l) => l !== null);

  return lines.join('\n');
}

export function computeProposalsSummary(proposals: ProposalContract[]) {
  let openPipelineSetup = 0;
  let openPipelineMrr = 0;
  let approvedSetup = 0;
  let approvedMrr = 0;
  let approvedCount = 0;
  let sentOrNegotiatingCount = 0;
  let closedOutcomeCount = 0;

  for (const p of proposals) {
    if (p.status === 'enviada' || p.status === 'em_negociacao') {
      openPipelineSetup += p.setupTotal || 0;
      openPipelineMrr += p.monthlyMrr || 0;
      sentOrNegotiatingCount += 1;
    }
    if (p.status === 'aprovada' || p.status === 'assinada') {
      approvedSetup += p.setupTotal || 0;
      approvedMrr += p.monthlyMrr || 0;
      approvedCount += 1;
      closedOutcomeCount += 1;
    } else if (p.status === 'recusada' || p.status === 'expirada') {
      closedOutcomeCount += 1;
    }
  }

  const approvalRatePercent =
    closedOutcomeCount > 0 ? ((approvedCount / closedOutcomeCount) * 100).toFixed(0) : '0';

  return {
    totalCount: proposals.length,
    openPipelineSetup,
    openPipelineMrr,
    approvedSetup,
    approvedMrr,
    approvedCount,
    sentOrNegotiatingCount,
    approvalRatePercent,
  };
}
