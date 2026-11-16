import test from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeCompleteBackupJson,
  parseAndValidateBackup,
  analyzeBackupRestore,
  prepareBackupRestorePayload,
} from '../src/services/backupService';
import { ImportedSheet, Lead, NicheCampaign } from '../src/types/crm';

const sampleNiches: NicheCampaign[] = [
  {
    id: 'niche-padrao',
    name: 'Prospecção Geral',
    segment: 'Sites',
    city: 'Brasil',
    emoji: '🚀',
    targetMrr: 5000,
    createdAt: '2026-01-01T00:00:00.000Z',
    scripts: {},
  },
];

const sampleLeads: Lead[] = [
  {
    id: 'lead-1',
    nicheId: 'niche-padrao',
    companyName: 'Clínica Alpha',
    phone: '5511999991111',
    displayPhone: '+55 (11) 99999-1111',
    city: 'São Paulo - SP',
    stage: 'leads_sem_contato',
    scriptUsed: 'script_mensagem',
    notes: [{ id: 'n1', date: '01/01/2026', text: 'Nota preservada', author: 'Ian' }],
    callbackDate: '2026-11-20',
    callbackTime: '14:00',
    callbackStatus: 'pendente',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const sampleSheets: ImportedSheet[] = [
  {
    id: 'sheet-1',
    name: 'lista-sp.xlsx',
    nicheId: 'niche-padrao',
    nicheName: 'Prospecção Geral',
    importedAt: '2026-01-05T12:00:00.000Z',
    totalLeads: 1,
    format: 'Excel (.xlsx)',
  },
];

test('serializeCompleteBackupJson inclui leads, nichos, importedSheets, checksum e zero credenciais', () => {
  const json = serializeCompleteBackupJson({
    niches: sampleNiches,
    leads: sampleLeads,
    importedSheets: sampleSheets,
    userName: 'Ian',
  });

  assert.equal(json.includes('apiKey'), false, 'Não deve expor apiKey no backup');
  assert.equal(json.includes('oAuthClientId'), false, 'Não deve expor oAuthClientId no backup');

  const validated = parseAndValidateBackup(json);
  assert.equal(validated.ok, true);
  assert.ok(validated.data);
  assert.equal(validated.data.version, '3.0');
  assert.equal(validated.data.leads.length, 1);
  assert.equal(validated.data.niches.length, 1);
  assert.equal(validated.data.importedSheets.length, 1);
  assert.equal(validated.data.leads[0].callbackDate, '2026-11-20');
  assert.equal(validated.data.leads[0].notes[0].text, 'Nota preservada');
});

test('parseAndValidateBackup rejeita arquivo v3.0 adulterado ou corrompido', () => {
  const json = serializeCompleteBackupJson({
    niches: sampleNiches,
    leads: sampleLeads,
    importedSheets: sampleSheets,
    userName: 'Ian',
  });

  const tampered = json.replace('Clínica Alpha', 'Empresa Adulterada');
  const validated = parseAndValidateBackup(tampered);
  assert.equal(validated.ok, false);
  assert.match(validated.error || '', /integridade/i);
});

test('parseAndValidateBackup mantém retrocompatibilidade com backup legado v2.0', () => {
  const legacyV2 = JSON.stringify({
    version: '2.0',
    exportedAt: '2026-05-01T10:00:00.000Z',
    userName: 'Ian',
    niches: sampleNiches,
    leads: sampleLeads,
  });

  const validated = parseAndValidateBackup(legacyV2);
  assert.equal(validated.ok, true);
  assert.equal(validated.data?.version, '2.0');
  assert.equal(validated.warnings.length, 1);
});

test('analyzeBackupRestore e prepareBackupRestorePayload detectam e tratam duplicidades por telefone', () => {
  const backupJson = serializeCompleteBackupJson({
    niches: sampleNiches,
    leads: [
      ...sampleLeads,
      {
        ...sampleLeads[0],
        id: 'lead-dup-phone-different-id',
        companyName: 'Clínica Alpha Duplicada',
      },
      {
        ...sampleLeads[0],
        id: 'lead-unique-2',
        companyName: 'Clínica Beta',
        phone: '5511988887777',
      },
    ],
    importedSheets: sampleSheets,
    userName: 'Ian',
  });

  const validated = parseAndValidateBackup(backupJson);
  assert.ok(validated.data);

  const analysis = analyzeBackupRestore(validated.data, {
    niches: sampleNiches,
    leads: sampleLeads,
    importedSheets: sampleSheets,
  });

  assert.equal(analysis.leadsExistingById, 1);
  assert.equal(analysis.leadsNew, 2);
  assert.equal(analysis.leadsPotentialPhoneDuplicates, 1);

  const preparedSkip = prepareBackupRestorePayload(
    validated.data,
    { niches: sampleNiches, leads: sampleLeads, importedSheets: sampleSheets },
    'skip_phone_duplicates'
  );
  assert.equal(preparedSkip.skippedDuplicates, 1);
  assert.equal(preparedSkip.leadsToWrite.length, 2);
});
