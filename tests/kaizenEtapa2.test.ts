import test from 'node:test';
import assert from 'node:assert/strict';
import { Lead, NicheCampaign } from '../src/types/crm';
import { Client, ProposalContract } from '../src/types/kaizen';
import {
  findDuplicateClient,
  buildClientFromLead,
  mergeClientWithProposalAcceptance,
  computeClientSummary,
} from '../src/services/clientService';
import {
  generateNextProposalCode,
  calculateProposalTotals,
  buildProposalFromSource,
  transitionProposalStatus,
  buildProposalWhatsAppMessage,
  computeProposalsSummary,
} from '../src/services/proposalService';
import { buildProposalPdfDocument } from '../src/services/pdfService';
import { computeDashboardMetrics } from '../src/utils/dashboardMetrics';
import {
  serializeCompleteBackupJson,
  parseAndValidateBackup,
  prepareBackupRestorePayload,
} from '../src/services/backupService';
import { INITIAL_NICHES } from '../src/utils/initialData';

function makeSampleLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: overrides.id || 'lead-test-etapa2',
    nicheId: overrides.nicheId || INITIAL_NICHES[0].id,
    companyName: overrides.companyName || 'Clínica Vida Plena',
    contactName: overrides.contactName || 'Dra. Fernanda',
    phone: overrides.phone || '5511988887777',
    displayPhone: overrides.displayPhone || '+55 (11) 98888-7777',
    city: overrides.city || 'São Paulo - SP',
    category: 'Clínica',
    stage: overrides.stage || 'fechado',
    scriptUsed: 'script_mensagem',
    creationValue: 1200,
    monthlyMrr: 350,
    meetingDate: '2026-11-15',
    meetingTime: '14:00',
    meetingNotes: 'Cliente pediu foco em agendamentos no WhatsApp.',
    notes: [
      {
        id: 'n1',
        date: '14/11/2026 10:00',
        text: 'Primeiro contato positivo no WhatsApp.',
        author: 'Ian',
      },
      {
        id: 'n2',
        date: '15/11/2026 14:30',
        text: 'Fechou plano completo com suporte mensal.',
        author: 'Ian',
      },
    ],
    createdAt: '2026-11-10T09:00:00.000Z',
    ...overrides,
  };
}

test('clientService previne duplicação por originLeadId, telefone normalizado e nome da empresa', () => {
  const lead = makeSampleLead();
  const client = buildClientFromLead(lead, INITIAL_NICHES[0], 'Ian');
  const pool = [client];

  const matchByLead = findDuplicateClient(pool, { originLeadId: lead.id });
  assert.equal(matchByLead?.reason, 'originLeadId');
  assert.equal(matchByLead?.existingClient.id, client.id);

  const matchByPhone = findDuplicateClient(pool, { phone: '(11) 98888-7777' });
  assert.equal(matchByPhone?.reason, 'phone');

  const matchByName = findDuplicateClient(pool, { companyName: 'clinica   vida   plena' });
  assert.equal(matchByName?.reason, 'companyName');

  const excludedSelf = findDuplicateClient(pool, {
    originLeadId: lead.id,
    excludeClientId: client.id,
  });
  assert.equal(excludedSelf, null);
});

test('buildClientFromLead preserva todas as notas do CRM e reunião comercial na timeline do Cliente', () => {
  const lead = makeSampleLead();
  const client = buildClientFromLead(lead, INITIAL_NICHES[0], 'Ian');

  assert.equal(client.originLeadId, lead.id);
  assert.equal(client.originNicheId, lead.nicheId);
  assert.equal(client.setupValue, 1200);
  assert.equal(client.monthlyMrr, 350);
  assert.equal(client.status, 'ativo');
  assert.ok(client.timeline.some((e) => e.type === 'conversao_lead'));
  assert.ok(client.timeline.some((e) => e.title.includes('Reunião comercial registrada')));
  assert.ok(client.timeline.some((e) => e.description?.includes('Primeiro contato positivo')));
  assert.ok(client.timeline.some((e) => e.description?.includes('Fechou plano completo')));
});

test('proposalService gera código sequencial, calcula totais, transiciona status e gera mensagem WhatsApp', () => {
  const refDate = new Date(2026, 10, 16);
  const existing: ProposalContract[] = [
    {
      id: 'prop-1',
      code: 'KZ-P-2026-001',
      kind: 'proposta',
      title: 'Proposta A',
      status: 'enviada',
      recipientCompany: 'Empresa A',
      issuerName: 'Agência Kaizen',
      items: [],
      setupTotal: 1000,
      monthlyMrr: 200,
      history: [],
      createdAt: '2026-11-16T10:00:00.000Z',
    },
  ];

  assert.equal(generateNextProposalCode(existing, 'proposta', refDate), 'KZ-P-2026-002');
  assert.equal(generateNextProposalCode(existing, 'contrato', refDate), 'KZ-C-2026-001');

  const totals = calculateProposalTotals(
    [
      { id: 'i1', title: 'Site', billingType: 'setup', quantity: 1, unitPrice: 1200 },
      { id: 'i2', title: 'Copy', billingType: 'pontual', quantity: 2, unitPrice: 150 },
      { id: 'i3', title: 'Suporte', billingType: 'mensal', quantity: 1, unitPrice: 250 },
    ],
    200
  );
  assert.equal(totals.grossSetup, 1500);
  assert.equal(totals.setupTotal, 1300);
  assert.equal(totals.monthlyMrr, 250);

  const lead = makeSampleLead();
  const draft = buildProposalFromSource({
    kind: 'proposta',
    existingProposals: existing,
    issuerName: 'Agência Kaizen — Ian',
    lead,
    niche: INITIAL_NICHES[0],
  });

  const fullProposal: ProposalContract = {
    ...draft,
    id: 'prop-2',
    createdAt: '2026-11-16T11:00:00.000Z',
  };

  const sent = transitionProposalStatus(fullProposal, 'enviada', 'Ian', 'Enviada ao tomador.');
  assert.equal(sent.status, 'enviada');
  assert.ok(sent.sentAt);
  assert.equal(sent.history[0].status, 'enviada');

  const approved = transitionProposalStatus(sent, 'aprovada', 'Ian');
  assert.equal(approved.status, 'aprovada');
  assert.ok(approved.approvedAt);

  const waMessage = buildProposalWhatsAppMessage(approved);
  assert.ok(waMessage.includes(approved.code));
  assert.ok(waMessage.includes('Clínica Vida Plena'));

  const summary = computeProposalsSummary([...existing, approved]);
  assert.equal(summary.totalCount, 2);
  assert.equal(summary.sentOrNegotiatingCount, 1);
  assert.equal(summary.approvedCount, 1);
  assert.equal(summary.approvalRatePercent, '100');
});

test('mergeClientWithProposalAcceptance atualiza cliente existente sem duplicar ao aceitar nova proposta', () => {
  const lead = makeSampleLead();
  const client = buildClientFromLead(lead, INITIAL_NICHES[0], 'Ian');
  client.status = 'encerrado';

  const proposalDraft = buildProposalFromSource({
    kind: 'contrato',
    existingProposals: [],
    issuerName: 'Kaizen',
    client,
  });
  const signedContract: ProposalContract = {
    ...proposalDraft,
    id: 'prop-signed-1',
    status: 'assinada',
    setupTotal: 1800,
    monthlyMrr: 490,
    createdAt: '2026-11-16T12:00:00.000Z',
  };

  const merged = mergeClientWithProposalAcceptance(client, signedContract, 'Ian');
  assert.equal(merged.id, client.id);
  assert.equal(merged.status, 'ativo');
  assert.equal(merged.setupValue, 1800);
  assert.equal(merged.monthlyMrr, 490);
  assert.equal(merged.timeline[0].type, 'contrato_assinado');

  const portfolio = computeClientSummary([merged]);
  assert.equal(portfolio.activeClients, 1);
  assert.equal(portfolio.activeMrr, 490);
});

test('pdfService gera documento A4 PDF válido em memória sem window.open', () => {
  const lead = makeSampleLead();
  const draft = buildProposalFromSource({
    kind: 'contrato',
    existingProposals: [],
    issuerName: 'Agência Kaizen',
    lead,
  });
  const proposal: ProposalContract = {
    ...draft,
    id: 'prop-pdf-1',
    createdAt: '2026-11-16T12:00:00.000Z',
  };

  const doc = buildProposalPdfDocument(proposal);
  const rawPdf = doc.output();
  assert.ok(rawPdf.startsWith('%PDF-'), 'Saída deve iniciar com cabeçalho válido %PDF-');
  assert.ok(doc.getNumberOfPages() >= 1);
});

test('computeDashboardMetrics desbloqueia Clientes ativos e evita dupla contagem de MRR entre Lead fechado e Cliente convertido', () => {
  const refDate = new Date(2026, 10, 16, 14, 0, 0);
  const convertedLead = makeSampleLead({
    id: 'lead-converted',
    stage: 'fechado',
    creationValue: 1200,
    monthlyMrr: 350,
  });
  const unconvertedLead = makeSampleLead({
    id: 'lead-unconverted',
    companyName: 'Outra Clínica',
    phone: '5511977776666',
    stage: 'fechado',
    creationValue: 800,
    monthlyMrr: 200,
  });

  const convertedClient = buildClientFromLead(convertedLead, INITIAL_NICHES[0], 'Ian');
  convertedClient.monthlyMrr = 400; // Reajustado na carteira de clientes
  const onboardingClient: Client = {
    id: 'cli-onb-1',
    companyName: 'Cliente Onboarding',
    phone: '5511966665555',
    displayPhone: '+55 (11) 96666-5555',
    status: 'onboarding',
    monthlyMrr: 300,
    timeline: [],
    createdAt: '2026-11-16T08:00:00.000Z',
  };

  const result = computeDashboardMetrics(
    [convertedLead, unconvertedLead],
    refDate,
    [convertedClient, onboardingClient]
  );

  assert.equal(result.kpis.activeClientsConfigured, true);
  assert.equal(result.kpis.activeClientsCount, 1);
  assert.equal(result.kpis.onboardingClientsCount, 1);
  assert.equal(result.kpis.activeClientsMrr, 700); // 400 ativo + 300 onboarding
  assert.equal(result.kpis.monthlyRevenueMrr, 900); // 700 clientes + 200 unconvertedLead (não soma os 350 do convertedLead!)
});

test('backupService v3.0 inclui clients e proposals mantendo checksum e restauração segura', () => {
  const niche: NicheCampaign = INITIAL_NICHES[0];
  const lead = makeSampleLead();
  const client = buildClientFromLead(lead, niche, 'Ian');
  const draft = buildProposalFromSource({
    kind: 'proposta',
    existingProposals: [],
    issuerName: 'Kaizen',
    client,
  });
  const proposal: ProposalContract = {
    ...draft,
    id: 'prop-bkp-1',
    createdAt: '2026-11-16T12:00:00.000Z',
  };

  const json = serializeCompleteBackupJson({
    niches: [niche],
    leads: [lead],
    importedSheets: [],
    clients: [client],
    proposals: [proposal],
    userName: 'Ian',
  });

  const parsed = parseAndValidateBackup(json);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data?.counts?.clients, 1);
  assert.equal(parsed.data?.counts?.proposals, 1);
  assert.equal(parsed.data?.clients?.[0].id, client.id);
  assert.equal(parsed.data?.proposals?.[0].code, proposal.code);

  const restorePayload = prepareBackupRestorePayload(
    parsed.data!,
    { niches: [], leads: [], importedSheets: [] },
    'merge_by_id'
  );
  assert.equal(restorePayload.clientsToWrite.length, 1);
  assert.equal(restorePayload.proposalsToWrite.length, 1);

  // Checksum rejeita adulteração em clients
  const tampered = json.replace(client.companyName, 'Empresa Adulterada');
  const tamperedValidation = parseAndValidateBackup(tampered);
  assert.equal(tamperedValidation.ok, false);
});
