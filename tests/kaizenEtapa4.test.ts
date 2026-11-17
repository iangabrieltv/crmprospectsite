import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysYmd,
  addMonthsYmd,
  buildDefaultFinancialSettings,
  buildEntriesCsv,
  buildGeneratedReportCsv,
  buildProposalFinancialForecast,
  canDeleteFinancialCategory,
  cancelFinancialEntryRecord,
  changeRecurrenceStatus,
  computeCashFlow,
  computeClientFinancialSummary,
  computeFinanceDashboardSnapshot,
  computeProjectFinancialSummary,
  createFinancialCategory,
  createFinancialEntryRecord,
  createFinancialRecurrenceRecord,
  ensureDefaultFinancialCategories,
  FINANCIAL_REPORT_DEFINITIONS,
  formatBrlFromCents,
  generateDueRecurrenceEntries,
  generateFinancialReport,
  getCurrentRealizedCashBalanceCents,
  getDaysOverdue,
  getEffectiveEntryStatus,
  getEntryPendingCents,
  parseBrlToCents,
  registerSettlement,
  resolvePeriodRange,
  reverseTransaction,
  updateFinancialEntryRecord,
  updateFinancialRecurrenceRecord,
} from '../src/services/finance';
import { buildFinancialReportPdfDocument } from '../src/services/pdfService';
import { computeDashboardMetrics } from '../src/utils/dashboardMetrics';
import {
  parseAndValidateBackup,
  prepareBackupRestorePayload,
  serializeCompleteBackupJson,
} from '../src/services/backupService';
import { Client, Project, ProposalContract } from '../src/types/kaizen';

function makeSampleClient(overrides: Partial<Client> = {}): Client {
  return {
    id: overrides.id || 'cli-test-1',
    companyName: overrides.companyName || 'Clínica Estética Aurora',
    contactName: 'Dra. Beatriz',
    phone: '5582999991111',
    displayPhone: overrides.displayPhone || '+55 (82) 99999-1111',
    status: 'ativo',
    setupValue: 1800,
    monthlyMrr: 950,
    billingDay: 10,
    timeline: [],
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeSampleProposal(overrides: Partial<ProposalContract> = {}): ProposalContract {
  return {
    id: overrides.id || 'prop-test-1',
    code: overrides.code || 'KZ-C-2026-014',
    kind: 'contrato',
    title: 'Kaizen Performance 90 dias',
    status: 'aprovada',
    clientId: 'cli-test-1',
    recipientCompany: 'Clínica Estética Aurora',
    issuerName: 'Agência Kaizen',
    items: [
      {
        id: 'it-1',
        title: 'Landing Page + Setup Inicial',
        billingType: 'setup',
        quantity: 1,
        unitPrice: 1800,
      },
      {
        id: 'it-2',
        title: 'Assessoria Mensal Kaizen',
        billingType: 'mensal',
        quantity: 1,
        unitPrice: 950,
      },
    ],
    discountValue: 0,
    setupTotal: 1800,
    monthlyMrr: 950,
    history: [],
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeSampleProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id || 'proj-test-1',
    name: 'Performance Aurora 90d',
    clientId: 'cli-test-1',
    proposalId: 'prop-test-1',
    serviceType: 'Kaizen Performance',
    templateId: 'kaizen_performance',
    status: 'em_andamento',
    ownerName: 'Ian',
    startDate: '2026-10-01',
    dueDate: '2026-12-30',
    documents: [],
    history: [],
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

test('Precisão monetária em centavos inteiros, formatação BRL e validação contra valores inválidos', () => {
  assert.equal(parseBrlToCents('1.250,50'), 125050);
  assert.equal(parseBrlToCents('R$ 497,99'), 49799);
  assert.equal(parseBrlToCents('1250.50'), 125050);
  assert.equal(parseBrlToCents(19.9), 1990);
  assert.ok(Number.isNaN(parseBrlToCents('abc')));
  assert.ok(Number.isNaN(parseBrlToCents('')));

  // Soma decimal exata sem erro de ponto flutuante (0.1 + 0.2 = 0.30)
  const a = parseBrlToCents('0,10');
  const b = parseBrlToCents('0,20');
  assert.equal(a + b, 30);
  assert.match(formatBrlFromCents(125050), /R\$\s*1\.250,50/);

  assert.throws(
    () =>
      createFinancialEntryRecord(
        {
          kind: 'receita',
          description: 'Lançamento inválido zero',
          categoryId: 'fcat-rec-setup',
          amountCents: 0,
          competenceDate: '2026-11-01',
          dueDate: '2026-11-10',
          paymentMethod: 'pix',
        },
        'Ian'
      ),
    /maior que R\$ 0,00/
  );

  assert.throws(
    () =>
      createFinancialEntryRecord(
        {
          kind: 'despesa',
          description: 'Data inválida',
          categoryId: 'fcat-desp-saas',
          amountCents: 5000,
          competenceDate: '2026-02-31',
          dueDate: '2026-03-10',
          paymentMethod: 'pix',
        },
        'Ian'
      ),
    /inválida/
  );
});

test('Lançamentos: criação, edição, cancelamento preservando histórico e não auto-baixa no vencimento', () => {
  const { entry, auditLog } = createFinancialEntryRecord(
    {
      kind: 'receita',
      description: 'Setup Landing Page',
      clientId: 'cli-test-1',
      categoryId: 'fcat-rec-setup',
      amountCents: 180000,
      competenceDate: '2026-11-01',
      dueDate: '2026-11-05',
      paymentMethod: 'pix',
      initialStatus: 'pendente',
    },
    'Ian'
  );

  assert.equal(auditLog.action, 'criacao');
  assert.equal(entry.settledCents, 0);
  // Mesmo com data futura/vencida (todayStr = 2026-11-17), status vira 'atrasada' em leitura, NUNCA 'recebida'
  assert.equal(getEffectiveEntryStatus(entry, '2026-11-17'), 'atrasada');
  assert.equal(getDaysOverdue(entry, '2026-11-17'), 12);
  assert.equal(getEntryPendingCents(entry), 180000);

  // Prorrogação para o futuro restaura status em aberto e gera log vencimento_alterado
  const { entry: extended, auditLog: dueLog } = updateFinancialEntryRecord(
    entry,
    { dueDate: '2026-11-25' },
    'Ian'
  );
  assert.equal(dueLog.action, 'vencimento_alterado');
  assert.equal(getEffectiveEntryStatus(extended, '2026-11-17'), 'pendente');

  // Cancelamento preserva registro, auditoria e bloqueia edições posteriores
  const { entry: cancelled, auditLog: cancelLog } = cancelFinancialEntryRecord(
    extended,
    'Cliente reagendou contrato',
    'Ian'
  );
  assert.equal(cancelled.status, 'cancelada');
  assert.equal(getEntryPendingCents(cancelled), 0);
  assert.equal(cancelLog.action, 'cancelamento');
  assert.throws(
    () => updateFinancialEntryRecord(cancelled, { amountCents: 100000 }, 'Ian'),
    /cancelados não podem ser editados/
  );
});

test('Baixas parciais/totais, bloqueio de recebimento excedente sem ajuste explícito e estorno rastreável', () => {
  const { entry } = createFinancialEntryRecord(
    {
      kind: 'receita',
      description: 'Pacote Tráfego Novembro',
      clientId: 'cli-test-1',
      categoryId: 'fcat-rec-trafego',
      amountCents: 100000,
      competenceDate: '2026-11-01',
      dueDate: '2026-11-10',
      paymentMethod: 'pix',
    },
    'Ian'
  );

  // Baixa parcial R$ 400,00
  const s1 = registerSettlement({
    entry,
    existingTransactions: [],
    amountCents: 40000,
    date: '2026-11-10',
    paymentMethod: 'pix',
    notes: 'Sinal 40%',
    actor: 'Ian',
  });
  assert.equal(s1.updatedEntry.settledCents, 40000);
  assert.equal(s1.updatedEntry.status, 'parcialmente_recebida');
  assert.equal(getEntryPendingCents(s1.updatedEntry), 60000);

  // Tentar baixar R$ 700,00 (excedente de R$ 100,00) sem acréscimo explícito deve falhar
  assert.throws(
    () =>
      registerSettlement({
        entry: s1.updatedEntry,
        existingTransactions: s1.createdTransactions,
        amountCents: 70000,
        date: '2026-11-15',
        paymentMethod: 'pix',
        actor: 'Ian',
      }),
    /excede o saldo pendente/
  );

  // Baixa final dos R$ 600,00 restantes
  const s2 = registerSettlement({
    entry: s1.updatedEntry,
    existingTransactions: s1.createdTransactions,
    amountCents: 60000,
    date: '2026-11-15',
    paymentMethod: 'transferencia_bancaria',
    actor: 'Ian',
  });
  assert.equal(s2.updatedEntry.settledCents, 100000);
  assert.equal(s2.updatedEntry.status, 'recebida');
  assert.equal(getEntryPendingCents(s2.updatedEntry), 0);

  const allTxs = [...s1.createdTransactions, ...s2.createdTransactions];

  // Estorno da 2ª transação volta o título para parcialmente_recebida e preserva histórico
  const rev = reverseTransaction({
    entry: s2.updatedEntry,
    transaction: s2.createdTransactions[0],
    existingTransactions: allTxs,
    reason: 'TED devolvida por divergência de conta',
    date: '2026-11-16',
    actor: 'Ian',
  });
  assert.equal(rev.reversalTransaction.kind, 'estorno');
  assert.equal(rev.updatedEntry.settledCents, 40000);
  assert.equal(rev.updatedEntry.status, 'parcialmente_recebida');
  assert.equal(rev.auditLog.action, 'estorno');
});

test('Categorias padrão (8 receitas + 11 despesas) e proteção contra exclusão de categoria vinculada', () => {
  const { categories, added } = ensureDefaultFinancialCategories([]);
  assert.equal(categories.length, 19);
  assert.equal(added.length, 19);
  assert.equal(categories.filter((c) => c.kind === 'receita').length, 8);
  assert.equal(categories.filter((c) => c.kind === 'despesa').length, 11);

  const freeCat = createFinancialCategory({
    name: 'Eventos e Workshops',
    kind: 'despesa',
  });
  assert.equal(canDeleteFinancialCategory(freeCat.id, [], []).allowed, true);

  const { entry } = createFinancialEntryRecord(
    {
      kind: 'despesa',
      description: 'Domínio agência',
      categoryId: 'fcat-desp-dominio',
      amountCents: 6000,
      competenceDate: '2026-11-01',
      dueDate: '2026-11-05',
      paymentMethod: 'cartao_credito',
    },
    'Ian'
  );
  const guard = canDeleteFinancialCategory('fcat-desp-dominio', [entry], []);
  assert.equal(guard.allowed, false);
  assert.equal(guard.usage.entryCount, 1);
});

test('Fluxo de caixa: separa realizado vs projetado nas 4 granularidades e isola saldo inicial da receita operacional', () => {
  const settings = buildDefaultFinancialSettings('2026-11-01');
  settings.openingBalanceCents = 500000; // R$ 5.000,00 saldo inicial

  const rec = createFinancialEntryRecord(
    {
      kind: 'receita',
      description: 'Contrato A',
      clientId: 'cli-test-1',
      categoryId: 'fcat-rec-mrr',
      amountCents: 200000,
      competenceDate: '2026-11-01',
      dueDate: '2026-11-10',
      paymentMethod: 'pix',
    },
    'Ian'
  );
  const settledRec = registerSettlement({
    entry: rec.entry,
    existingTransactions: [],
    amountCents: 150000, // R$ 1.500 recebidos, R$ 500 ainda projetados
    date: '2026-11-10',
    paymentMethod: 'pix',
    actor: 'Ian',
  });

  const exp = createFinancialEntryRecord(
    {
      kind: 'despesa',
      description: 'Ferramentas SaaS',
      supplierName: 'Vercel',
      categoryId: 'fcat-desp-saas',
      amountCents: 40000, // R$ 400 previstos em aberto
      competenceDate: '2026-11-01',
      dueDate: '2026-11-20',
      paymentMethod: 'cartao_credito',
    },
    'Ian'
  );

  // Saldo de caixa = 5000 + 1500 = 6500 (saldo inicial NUNCA vira receita recebida)
  assert.equal(
    getCurrentRealizedCashBalanceCents(settledRec.createdTransactions, settings),
    650000
  );

  for (const granularity of ['diario', 'semanal', 'mensal', 'anual'] as const) {
    const cf = computeCashFlow({
      entries: [settledRec.updatedEntry, exp.entry],
      transactions: settledRec.createdTransactions,
      settings,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      granularity,
      todayStr: '2026-11-17',
    });

    assert.equal(cf.openingBalanceInPeriodCents, 500000);
    assert.equal(cf.realizedInflowCents, 150000);
    assert.equal(cf.realizedOutflowCents, 0);
    assert.equal(cf.realizedClosingBalanceCents, 650000);
    // Projetado = +500 pendente receita - 400 pendente despesa = +100 -> final 6600
    assert.equal(cf.projectedInflowCents, 50000);
    assert.equal(cf.projectedOutflowCents, 40000);
    assert.equal(cf.projectedClosingBalanceCents, 660000);
    assert.ok(cf.buckets.length >= 1);
  }
});

test('Recorrências: geração idempotente sem duplicar, edição afeta apenas futuro e respeita pausa/encerramento', () => {
  const { recurrence } = createFinancialRecurrenceRecord(
    {
      name: 'Hospedagem Cloud Kaizen',
      kind: 'despesa',
      amountCents: 15000,
      categoryId: 'fcat-desp-hospedagem',
      supplierName: 'DigitalOcean',
      paymentMethod: 'cartao_credito',
      frequency: 'mensal',
      startDate: '2026-09-05',
    },
    'Ian'
  );

  // Gera 3 meses devidos até 2026-11-17 (09/05, 10/05, 11/05)
  const gen1 = generateDueRecurrenceEntries({
    recurrences: [recurrence],
    existingEntries: [],
    referenceDate: '2026-11-17',
    actor: 'Ian',
  });
  assert.equal(gen1.createdEntries.length, 3);
  assert.equal(gen1.updatedRecurrences[0].nextOccurrenceDate, '2026-12-05');
  assert.ok(gen1.createdEntries.every((e) => e.status === 'pendente' && e.settledCents === 0));

  // Reexecução na mesma data não duplica nada (idempotente)
  const gen2 = generateDueRecurrenceEntries({
    recurrences: gen1.updatedRecurrences,
    existingEntries: gen1.createdEntries,
    referenceDate: '2026-11-17',
    actor: 'Ian',
  });
  assert.equal(gen2.createdEntries.length, 0);

  // Edição futura altera o template para R$ 220,00 sem tocar nas 3 parcelas já geradas de R$ 150,00
  const { recurrence: editedRec } = updateFinancialRecurrenceRecord(
    gen1.updatedRecurrences[0],
    { amountCents: 22000 },
    'Ian'
  );
  assert.equal(gen1.createdEntries[0].amountCents, 15000);

  const gen3 = generateDueRecurrenceEntries({
    recurrences: [editedRec],
    existingEntries: gen1.createdEntries,
    referenceDate: '2026-12-10',
    actor: 'Ian',
  });
  assert.equal(gen3.createdEntries.length, 1);
  assert.equal(gen3.createdEntries[0].amountCents, 22000);

  // Pausada não gera nova ocorrência
  const { recurrence: paused } = changeRecurrenceStatus(
    gen3.updatedRecurrences[0],
    'pausada',
    'Ian'
  );
  const genPaused = generateDueRecurrenceEntries({
    recurrences: [paused],
    existingEntries: [...gen1.createdEntries, ...gen3.createdEntries],
    referenceDate: '2027-02-10',
    actor: 'Ian',
  });
  assert.equal(genPaused.createdEntries.length, 0);
});

test('Integrações Cliente, Projeto, Proposta e Dashboard sem dupla contagem e sem auto-baixa', () => {
  const client = makeSampleClient();
  const proposal = makeSampleProposal();
  const project = makeSampleProject();

  // Gerar previsão parcelada (2x setup) + MRR recorrente pela Proposta
  const forecast = buildProposalFinancialForecast(
    {
      proposal,
      mode: 'parcelado',
      installmentsCount: 2,
      firstDueDate: '2026-11-10',
      paymentMethod: 'pix',
      includeSetup: true,
      includeMrr: true,
      actor: 'Ian',
    },
    [],
    []
  );

  // 2 parcelas de R$ 900,00 + 1ª mensalidade de R$ 950,00
  assert.equal(forecast.entries.length, 3);
  assert.equal(forecast.recurrences.length, 1);
  assert.ok(forecast.entries.every((e) => e.settledCents === 0));

  // Bloqueio contra duplicação explícita na mesma proposta
  assert.throws(
    () =>
      buildProposalFinancialForecast(
        {
          proposal,
          mode: 'pontual',
          firstDueDate: '2026-11-10',
          paymentMethod: 'pix',
          actor: 'Ian',
        },
        forecast.entries,
        forecast.recurrences
      ),
    /Já existe previsão financeira vinculada/
  );

  // Vincula primeira parcela ao projeto + lança despesa de freelancer no projeto
  const linkedParcel = { ...forecast.entries[0], projectId: project.id };
  const s1 = registerSettlement({
    entry: linkedParcel,
    existingTransactions: [],
    amountCents: 90000,
    date: '2026-11-12',
    paymentMethod: 'pix',
    actor: 'Ian',
  });

  const projExpense = createFinancialEntryRecord(
    {
      kind: 'despesa',
      description: 'Copywriter Landing Page',
      supplierName: 'Studio Texto',
      projectId: project.id,
      categoryId: 'fcat-desp-freelancers',
      amountCents: 35000,
      competenceDate: '2026-11-10',
      dueDate: '2026-11-15',
      paymentMethod: 'pix',
    },
    'Ian'
  );
  const sExp = registerSettlement({
    entry: projExpense.entry,
    existingTransactions: s1.createdTransactions,
    amountCents: 35000,
    date: '2026-11-14',
    paymentMethod: 'pix',
    actor: 'Ian',
  });

  const allEntries = [
    s1.updatedEntry,
    forecast.entries[1],
    forecast.entries[2],
    sExp.updatedEntry,
  ];
  const allTxs = [...s1.createdTransactions, ...sExp.createdTransactions];

  const cliSummary = computeClientFinancialSummary({
    client,
    proposals: [proposal],
    entries: allEntries,
    transactions: allTxs,
    todayStr: '2026-11-17',
  });
  assert.equal(cliSummary.contractedSetupCents, 180000);
  assert.equal(cliSummary.contractedMrrCents, 95000);
  assert.equal(cliSummary.billedTotalCents, 275000); // 900 + 900 + 950
  assert.equal(cliSummary.receivedTotalCents, 90000);
  assert.equal(cliSummary.pendingTotalCents, 185000);

  const projSummary = computeProjectFinancialSummary({
    project,
    proposals: [proposal],
    entries: allEntries,
  });
  assert.equal(projSummary.receivedRevenueCents, 90000);
  assert.equal(projSummary.paidExpensesCents, 35000);
  assert.equal(projSummary.realizedResultCents, 55000);

  // Dashboard executivo reflete Recebido Real do mês e em aberto sem duplicar
  const dash = computeDashboardMetrics(
    [],
    new Date(2026, 10, 17, 12, 0, 0),
    [client],
    allEntries,
    allTxs
  );
  assert.equal(dash.kpis.financialModuleConfigured, true);
  assert.equal(dash.kpis.monthlyRealizedRevenueCents, 90000);
  assert.equal(dash.kpis.openReceivablesCents, 185000);
});

test('Todos os 15 Relatórios Gerenciais, exportação CSV, Dashboard Financeiro e PDF A4 executivo funcionam integralmente', () => {
  assert.equal(FINANCIAL_REPORT_DEFINITIONS.length, 15);
  const { categories } = ensureDefaultFinancialCategories([]);
  const settings = buildDefaultFinancialSettings('2026-11-01');
  settings.openingBalanceCents = 250000;
  const client = makeSampleClient();
  const project = makeSampleProject();

  const rec = createFinancialEntryRecord(
    {
      kind: 'receita',
      description: 'Mensalidade Aurora Nov',
      clientId: client.id,
      projectId: project.id,
      serviceName: 'Assessoria Performance',
      categoryId: 'fcat-rec-mrr',
      amountCents: 95000,
      competenceDate: '2026-11-01',
      dueDate: '2026-11-05',
      paymentMethod: 'pix',
    },
    'Ian'
  );
  const settledRec = registerSettlement({
    entry: rec.entry,
    existingTransactions: [],
    amountCents: 95000,
    date: '2026-11-05',
    paymentMethod: 'pix',
    actor: 'Ian',
  });

  const overdueRec = createFinancialEntryRecord(
    {
      kind: 'receita',
      description: 'Implantação em atraso',
      clientId: client.id,
      categoryId: 'fcat-rec-setup',
      amountCents: 180000,
      competenceDate: '2026-11-01',
      dueDate: '2026-11-10',
      paymentMethod: 'boleto',
    },
    'Ian'
  );

  const exp = createFinancialEntryRecord(
    {
      kind: 'despesa',
      description: 'Assinatura CRM / APIs',
      supplierName: 'Google Cloud',
      projectId: project.id,
      categoryId: 'fcat-desp-apis',
      amountCents: 30000,
      competenceDate: '2026-11-01',
      dueDate: '2026-11-12',
      paymentMethod: 'cartao_credito',
    },
    'Ian'
  );
  const settledExp = registerSettlement({
    entry: exp.entry,
    existingTransactions: settledRec.createdTransactions,
    amountCents: 10000,
    date: '2026-11-12',
    paymentMethod: 'cartao_credito',
    actor: 'Ian',
  });

  const { recurrence: recRev } = createFinancialRecurrenceRecord(
    {
      name: 'Mensalidade Recorrente Aurora',
      kind: 'receita',
      amountCents: 95000,
      categoryId: 'fcat-rec-mrr',
      clientId: client.id,
      paymentMethod: 'pix',
      frequency: 'mensal',
      startDate: '2026-11-05',
    },
    'Ian'
  );

  const { recurrence: recExp } = createFinancialRecurrenceRecord(
    {
      name: 'Hospedagem Mensal',
      kind: 'despesa',
      amountCents: 12000,
      categoryId: 'fcat-desp-hospedagem',
      supplierName: 'AWS',
      paymentMethod: 'cartao_credito',
      frequency: 'mensal',
      startDate: '2026-11-05',
    },
    'Ian'
  );

  const entries = [settledRec.updatedEntry, overdueRec.entry, settledExp.updatedEntry];
  const txs = [...settledRec.createdTransactions, ...settledExp.createdTransactions];

  const snap = computeFinanceDashboardSnapshot({
    entries,
    transactions: txs,
    categories,
    settings,
    clients: [client],
    preset: 'este_mes',
    todayStr: '2026-11-17',
  });

  assert.equal(snap.receivedRevenueCents, 95000);
  assert.equal(snap.paidExpensesCents, 10000);
  assert.equal(snap.realizedProfitCents, 85000);
  assert.equal(snap.accountsReceivableCents, 180000);
  assert.equal(snap.accountsPayableCents, 20000);
  assert.equal(snap.delinquencyCents, 180000);
  assert.equal(snap.delinquencyCount, 1);
  assert.equal(snap.cashBalanceCents, 250000 + 85000);
  assert.equal(snap.monthlySeries.length, 6);

  // Valida todos os 15 relatórios + exportação CSV
  for (const def of FINANCIAL_REPORT_DEFINITIONS) {
    const report = generateFinancialReport({
      reportId: def.id,
      entries,
      transactions: txs,
      categories,
      recurrences: [recRev, recExp],
      settings,
      clients: [client],
      projects: [project],
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      periodLabel: 'Nov/2026',
      todayStr: '2026-11-17',
    });
    assert.ok(report.columns.length >= 4, `Relatório ${def.id} sem colunas`);
    assert.ok(report.rows.length >= 1, `Relatório ${def.id} retornou vazio inesperadamente`);
    const csv = buildGeneratedReportCsv(report);
    assert.ok(csv.startsWith('\uFEFF'), `CSV de ${def.id} sem BOM UTF-8`);
  }

  // Exportação CSV de lançamentos (com sanitização contra formula injection)
  const { entry: formulaEntry } = createFinancialEntryRecord(
    {
      kind: 'despesa',
      description: '=CMD|calc',
      categoryId: 'fcat-desp-outros',
      amountCents: 1000,
      competenceDate: '2026-11-01',
      dueDate: '2026-11-15',
      paymentMethod: 'pix',
    },
    'Ian'
  );
  const entriesCsv = buildEntriesCsv([...entries, formulaEntry], [client], categories, '2026-11-17');
  assert.ok(entriesCsv.includes("'=CMD|calc"));

  // Geração real de PDF A4 (jsPDF) para relatório financeiro
  const fluxoReport = generateFinancialReport({
    reportId: 'fluxo_de_caixa',
    entries,
    transactions: txs,
    categories,
    recurrences: [recRev, recExp],
    settings,
    clients: [client],
    projects: [project],
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    periodLabel: 'Nov/2026',
    todayStr: '2026-11-17',
  });
  const pdfDoc = buildFinancialReportPdfDocument(fluxoReport, 'Agência Kaizen');
  assert.ok(pdfDoc.getNumberOfPages() >= 1);
  const pdfBuffer = pdfDoc.output('arraybuffer');
  assert.ok(pdfBuffer.byteLength > 1000);

  // Cobertura rápida dos 10 presets de período e utilidades de data
  for (const preset of [
    'hoje',
    'esta_semana',
    'este_mes',
    'mes_anterior',
    'ultimos_30_dias',
    'ultimos_90_dias',
    'este_trimestre',
    'este_semestre',
    'este_ano',
    'personalizado',
  ] as const) {
    const r = resolvePeriodRange(preset, '2026-10-01', '2026-10-15', '2026-11-17');
    assert.ok(r.startDate <= r.endDate);
  }
  assert.equal(addDaysYmd('2026-11-30', 1), '2026-12-01');
  assert.equal(addMonthsYmd('2026-01-31', 1), '2026-02-28');
});

test('Backup v3.0 preserva e valida todas as 6 coleções financeiras com checksum de integridade', () => {
  const { categories } = ensureDefaultFinancialCategories([]);
  const settings = buildDefaultFinancialSettings('2026-11-01');
  const { entry, auditLog } = createFinancialEntryRecord(
    {
      kind: 'receita',
      description: 'Assessoria Kaizen Backup',
      categoryId: 'fcat-rec-mrr',
      amountCents: 120000,
      competenceDate: '2026-11-01',
      dueDate: '2026-11-10',
      paymentMethod: 'pix',
    },
    'Ian'
  );
  const settled = registerSettlement({
    entry,
    existingTransactions: [],
    amountCents: 120000,
    date: '2026-11-10',
    paymentMethod: 'pix',
    actor: 'Ian',
  });
  const { recurrence } = createFinancialRecurrenceRecord(
    {
      name: 'Recorrência Backup',
      kind: 'receita',
      amountCents: 120000,
      categoryId: 'fcat-rec-mrr',
      paymentMethod: 'pix',
      frequency: 'mensal',
      startDate: '2026-12-10',
    },
    'Ian'
  );

  const json = serializeCompleteBackupJson({
    niches: [],
    leads: [],
    importedSheets: [],
    clients: [],
    proposals: [],
    projects: [],
    tasks: [],
    agendaEvents: [],
    socialChannels: [],
    socialPosts: [],
    financialEntries: [settled.updatedEntry],
    financialTransactions: settled.createdTransactions,
    financialCategories: categories,
    financialRecurrences: [recurrence],
    financialSettings: settings,
    financialAuditLogs: [auditLog, ...settled.auditLogs],
    userName: 'Ian',
  });

  const parsed = parseAndValidateBackup(json);
  assert.equal(parsed.ok, true);
  assert.ok(parsed.data);
  assert.equal(parsed.data.financialEntries?.length, 1);
  assert.equal(parsed.data.financialTransactions?.length, 1);
  assert.equal(parsed.data.financialCategories?.length, 19);
  assert.equal(parsed.data.financialRecurrences?.length, 1);
  assert.equal(parsed.data.financialSettings?.id, 'default');
  assert.equal(parsed.data.financialAuditLogs?.length, 2);

  const prepared = prepareBackupRestorePayload(
    parsed.data,
    { niches: [], leads: [], importedSheets: [] },
    'skip_phone_duplicates'
  );
  assert.equal(prepared.financialEntriesToWrite.length, 1);
  assert.equal(prepared.financialTransactionsToWrite.length, 1);
});
