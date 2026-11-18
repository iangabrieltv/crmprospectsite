import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_UPLOAD_FILE_BYTES,
  ResourceFile,
  CommercialScript,
  ModelTemplate,
} from '../src/types/resources';
import {
  Client,
  Project,
  ProposalContract,
  SocialPost,
} from '../src/types/kaizen';
import { Lead, NicheCampaign } from '../src/types/crm';
import {
  validateUploadFile,
  getPreviewModeForExtension,
  buildDefaultResourceCategories,
  ensureDefaultCategories,
  createResourceCategory,
  countCategoryReferences,
  uploadResourceBinary,
  resolveResourceBlob,
  removeResourceBinary,
  createUploadedResourceFile,
  getFilesForClientContext,
  getFilesForProjectContext,
  getFilesForTaskContext,
  getFilesForSocialPostContext,
  linkFileToTask,
  unlinkFileFromTask,
  linkFileToSocialPost,
  unlinkFileFromSocialPost,
  renameResourceFile,
  toggleResourceFileFavorite,
  archiveResourceFile,
  restoreResourceFile,
  hasHistoricalLinks,
  createResourceFolder,
  canDeleteFolder,
  buildInitialCommercialScripts,
  interpolateCommercialScript,
  buildVariableContextFromLead,
  buildVariableContextFromClient,
  markScriptUsed,
  duplicateCommercialScript,
  archiveCommercialScript,
  buildInitialModelTemplates,
  createModelTemplate,
  duplicateModelTemplate,
  buildIndependentProposalFromTemplate,
  buildIndependentProjectFromTemplateModel,
  buildIndependentTasksFromTemplate,
  filterResourceFiles,
  filterCommercialScripts,
  filterModelTemplates,
  paginateItems,
  clearMemoryBlobStoreForTests,
  StorageDriver,
} from '../src/services/resources';
import {
  buildCompleteBackupData,
  parseAndValidateBackup,
  prepareBackupRestorePayload,
} from '../src/services/backupService';

function makeDummyFile(overrides: Partial<ResourceFile> = {}): ResourceFile {
  return {
    id: overrides.id || 'rfile-test-1',
    name: overrides.name || 'Manual de Marca',
    originalName: overrides.originalName || 'manual-marca.pdf',
    mimeType: overrides.mimeType || 'application/pdf',
    extension: overrides.extension || 'pdf',
    sizeBytes: overrides.sizeBytes ?? 1024,
    categoryId: overrides.categoryId || 'cat-doc-identidade',
    tags: overrides.tags || ['marca', 'manual'],
    favorite: overrides.favorite ?? false,
    status: overrides.status || 'ativo',
    storagePath: overrides.storagePath || 'workspaces/adm_equipeie/resources/rfile-test-1/manual-marca.pdf',
    storageProvider: overrides.storageProvider || 'indexeddb_dev',
    uploadedBy: overrides.uploadedBy || 'Ian',
    uploadedAt: overrides.uploadedAt || '2026-11-18T10:00:00.000Z',
    schemaVersion: 1,
    updatedAt: overrides.updatedAt || '2026-11-18T10:00:00.000Z',
    ...overrides,
  };
}

test('validateUploadFile aceita os 15 formatos permitidos e bloqueia executáveis, duplas extensões, vazios e > 25MB', () => {
  const allowedExts = [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'png',
    'jpg',
    'jpeg',
    'svg',
    'mp4',
    'txt',
    'csv',
    'zip',
  ];

  for (const ext of allowedExts) {
    const res = validateUploadFile({
      name: `Documento Teste (${ext}).${ext}`,
      size: 2048,
    });
    assert.equal(res.ok, true, `Deveria aceitar extensão .${ext}`);
    assert.equal(res.extension, ext);
    assert.ok(res.sanitizedOriginalName);
  }

  assert.equal(getPreviewModeForExtension('png'), 'image');
  assert.equal(getPreviewModeForExtension('pdf'), 'pdf');
  assert.equal(getPreviewModeForExtension('mp4'), 'video');
  assert.equal(getPreviewModeForExtension('csv'), 'text');
  assert.equal(getPreviewModeForExtension('xlsx'), 'spreadsheet');
  assert.equal(getPreviewModeForExtension('zip'), 'unsupported');

  for (const dangerous of ['virus.exe', 'script.sh', 'macro.bat', 'loader.js', 'site.html', 'shell.ps1']) {
    const blocked = validateUploadFile({ name: dangerous, size: 512 });
    assert.equal(blocked.ok, false, `Deveria bloquear ${dangerous}`);
  }

  const doubleExt = validateUploadFile({ name: 'contrato.pdf.exe', size: 1024 });
  assert.equal(doubleExt.ok, false);

  const nestedDangerous = validateUploadFile({ name: 'anexo.bat.txt', size: 1024 });
  assert.equal(nestedDangerous.ok, false);

  const dangerousMime = validateUploadFile({
    name: 'falso.pdf',
    size: 1024,
    type: 'application/x-msdownload',
  });
  assert.equal(dangerousMime.ok, false);

  const zeroByte = validateUploadFile({ name: 'vazio.pdf', size: 0 });
  assert.equal(zeroByte.ok, false);

  const tooBig = validateUploadFile({
    name: 'video-gigante.mp4',
    size: MAX_UPLOAD_FILE_BYTES + 1,
  });
  assert.equal(tooBig.ok, false);
});

test('uploadResourceBinary usa cofre local IndexedDB/memória no fallback auto e exige nuvem em require_cloud', async () => {
  clearMemoryBlobStoreForTests();

  const failingDriver: StorageDriver = {
    async uploadToCloud() {
      throw new Error('storage/unauthorized');
    },
    async downloadFromCloud() {
      throw new Error('storage/unauthorized');
    },
    async deleteFromCloud() {
      throw new Error('storage/unauthorized');
    },
  };

  const payload = new TextEncoder().encode('Conteudo real do contrato PDF simulado');

  // Em ambiente Node (typeof window === 'undefined') ou falha de Storage em mode=auto:
  const autoRes = await uploadResourceBinary(
    {
      fileId: 'rfile-fallback-1',
      sanitizedOriginalName: 'contrato.txt',
      mimeType: 'text/plain',
      data: payload,
      mode: 'auto',
    },
    failingDriver
  );
  assert.equal(autoRes.ok, true);
  assert.equal(autoRes.storageProvider, 'indexeddb_dev');
  assert.ok(autoRes.localBlobKey);
  assert.ok(autoRes.checksum);
  assert.equal(autoRes.sizeBytes, payload.byteLength);

  // Recupera blob salvo localmente
  const dummy = makeDummyFile({
    id: 'rfile-fallback-1',
    localBlobKey: autoRes.localBlobKey,
    storageProvider: autoRes.storageProvider,
  });
  const resolved = await resolveResourceBlob(dummy, failingDriver);
  assert.ok(resolved.blob);
  assert.equal(await resolved.blob!.text(), 'Conteudo real do contrato PDF simulado');

  await removeResourceBinary(dummy, failingDriver);
  const afterRemove = await resolveResourceBlob(dummy, failingDriver);
  assert.equal(afterRemove.blob, null);

  // mode = require_cloud deve recusar quando cloud indisponível
  const strictRes = await uploadResourceBinary(
    {
      fileId: 'rfile-strict-1',
      sanitizedOriginalName: 'contrato.txt',
      mimeType: 'text/plain',
      data: payload,
      mode: 'require_cloud',
    },
    failingDriver
  );
  assert.equal(strictRes.ok, false);
  assert.ok(strictRes.cloudError);
});

test('createUploadedResourceFile valida, cria metadados limpos e integra ao cofre local sem duplicar blob no objeto', async () => {
  clearMemoryBlobStoreForTests();
  const data = new TextEncoder().encode('Briefing completo cliente X');
  const outcome = await createUploadedResourceFile({
    file: {
      name: 'Briefing Cliente X.txt',
      size: data.byteLength,
      type: 'text/plain',
      data,
    },
    categoryId: 'cat-doc-cliente',
    tags: ['Briefing', 'Cliente', 'briefing'],
    clientId: 'cli-1',
    uploadedBy: 'Ian',
  });

  assert.equal(outcome.ok, true);
  assert.ok(outcome.file);
  assert.equal(outcome.file!.name, 'Briefing Cliente X');
  assert.equal(outcome.file!.extension, 'txt');
  assert.deepEqual(outcome.file!.tags, ['briefing', 'cliente']);
  assert.equal(outcome.file!.clientId, 'cli-1');
  assert.equal(outcome.file!.status, 'ativo');
});

test('Herança Cliente <-> Projeto <-> Tarefa <-> Social funciona sem duplicar registros', () => {
  const projects: Project[] = [
    {
      id: 'proj-1',
      name: 'Site Clínica Alfa',
      clientId: 'cli-1',
      serviceType: 'Landing Page',
      templateId: 'kaizen_start',
      status: 'em_andamento',
      ownerName: 'Ian',
      startDate: '2026-11-01',
      dueDate: '2026-11-15',
      documents: [],
      history: [],
      createdAt: '2026-11-01T10:00:00.000Z',
    },
  ];
  const socialPosts: SocialPost[] = [
    {
      id: 'post-1',
      title: 'Carrossel Novembro',
      ownerType: 'client',
      clientId: 'cli-1',
      platform: 'instagram',
      format: 'carrossel',
      assignee: 'Ian',
      status: 'producao',
      createdAt: '2026-11-02T10:00:00.000Z',
    },
  ];

  const fDirectClient = makeDummyFile({ id: 'f1', clientId: 'cli-1' });
  const fProjectOnly = makeDummyFile({ id: 'f2', projectId: 'proj-1' });
  const fPostOnly = linkFileToSocialPost(makeDummyFile({ id: 'f3' }), 'post-1', undefined);
  const fOther = makeDummyFile({ id: 'f4', clientId: 'cli-99' });
  const fArchived = makeDummyFile({ id: 'f5', clientId: 'cli-1', status: 'arquivado' });

  const allFiles = [fDirectClient, fProjectOnly, fPostOnly, fOther, fArchived];

  // Cliente cli-1 vê f1 (direto), f2 (herdado do projeto) e f3 (vinculado ao post), ignorando arquivados por padrão
  const cliFiles = getFilesForClientContext(allFiles, 'cli-1', projects, socialPosts);
  assert.deepEqual(
    cliFiles.map((f) => f.id),
    ['f1', 'f2', 'f3']
  );

  // Projeto proj-1 vê f2
  const projFiles = getFilesForProjectContext(allFiles, 'proj-1');
  assert.deepEqual(
    projFiles.map((f) => f.id),
    ['f2']
  );

  // Vínculo e desvínculo em Tarefa
  const linkedTask = linkFileToTask(fDirectClient, 'task-10');
  assert.deepEqual(
    getFilesForTaskContext([linkedTask, fProjectOnly], 'task-10').map((f) => f.id),
    ['f1']
  );
  const unlinkedTask = unlinkFileFromTask(linkedTask, 'task-10');
  assert.equal(getFilesForTaskContext([unlinkedTask], 'task-10').length, 0);

  // Desvínculo de Social Post
  assert.deepEqual(
    getFilesForSocialPostContext([fPostOnly], 'post-1').map((f) => f.id),
    ['f3']
  );
  const unlinkedPost = unlinkFileFromSocialPost(fPostOnly, 'post-1');
  assert.equal(getFilesForSocialPostContext([unlinkedPost], 'post-1').length, 0);
});

test('Arquivo, renomeio, favorito, pastas e proteção contra exclusão destrutiva preservam integridade', () => {
  const file = makeDummyFile({ id: 'f-hist', clientId: 'cli-1' });
  assert.equal(hasHistoricalLinks(file), true);
  assert.equal(hasHistoricalLinks(makeDummyFile({ id: 'f-solto' })), false);

  const renamed = renameResourceFile(file, 'Novo Nome Oficial');
  assert.equal(renamed.name, 'Novo Nome Oficial');

  const fav = toggleResourceFileFavorite(renamed);
  assert.equal(fav.favorite, true);

  const archived = archiveResourceFile(fav);
  assert.equal(archived.status, 'arquivado');
  assert.ok(archived.archivedAt);

  const restored = restoreResourceFile(archived);
  assert.equal(restored.status, 'ativo');
  assert.equal(restored.archivedAt, undefined);

  const parentFolder = createResourceFolder({ name: 'Clientes', scope: 'cliente' });
  const childFolder = createResourceFolder({
    name: 'Clínica Vida',
    parentId: parentFolder.id,
    scope: 'cliente',
  });
  const fileInChild = makeDummyFile({ id: 'f-folder', folderId: childFolder.id });

  assert.equal(canDeleteFolder(parentFolder.id, [parentFolder, childFolder], []).allowed, false);
  assert.equal(canDeleteFolder(childFolder.id, [parentFolder, childFolder], [fileInChild]).allowed, false);
  assert.equal(canDeleteFolder(childFolder.id, [parentFolder, childFolder], []).allowed, true);
});

test('Categorias padrão garantem 25 categorias nos 3 tipos e contagem de uso impede quebra de vínculo', () => {
  const cats = buildDefaultResourceCategories();
  assert.equal(cats.filter((c) => c.kind === 'arquivo').length, 7);
  assert.equal(cats.filter((c) => c.kind === 'script').length, 14);
  assert.equal(cats.filter((c) => c.kind === 'modelo').length, 4);

  const customCat = createResourceCategory({ name: 'Vídeos Depoimento', kind: 'arquivo' });
  assert.equal(customCat.slug, 'videos-depoimento');
  assert.equal(customCat.isDefault, false);

  const partial = ensureDefaultCategories(cats.slice(0, 3));
  assert.equal(partial.categories.length, 25);
  assert.equal(partial.added.length, 22);

  const refsCount = countCategoryReferences('cat-doc-identidade', {
    files: [makeDummyFile({ categoryId: 'cat-doc-identidade' })],
    scripts: [],
    templates: [],
  });
  assert.equal(refsCount, 1);
});

test('Scripts comerciais interpolam variáveis reais sem inventar dados faltantes e incrementam uso', () => {
  const seeds = buildInitialCommercialScripts('Kaizen Digital');
  assert.equal(seeds.length, 11);

  const lead: Lead = {
    id: 'lead-scr-1',
    nicheId: 'niche-1',
    companyName: 'Clínica Sorriso Real',
    contactName: 'Dra. Marina',
    phone: '5582999991111',
    displayPhone: '(82) 99999-1111',
    city: 'Maceió',
    category: 'Odontologia',
    stage: 'leads_sem_contato',
    scriptUsed: 'script_mensagem',
    notes: [],
    createdAt: '2026-11-18T10:00:00.000Z',
  };

  // Sem link no lead -> {{link}} deve permanecer intacto e reportado em missingVariables (nunca inventado!)
  const ctx = buildVariableContextFromLead(lead, undefined, 'Kaizen Digital');
  const firstScript = seeds[0];
  const res = interpolateCommercialScript(firstScript.content, ctx);

  assert.match(res.renderedText, /Dra\. Marina/);
  assert.match(res.renderedText, /Clínica Sorriso Real/);
  assert.match(res.renderedText, /Maceió/);
  assert.match(res.renderedText, /Odontologia/);
  assert.match(res.renderedText, /Kaizen Digital/);
  assert.match(res.renderedText, /\{\{link\}\}/);
  assert.deepEqual(res.missingVariables, ['{{link}}']);

  // Com cliente completo -> 0 variáveis faltantes
  const client: Client = {
    id: 'cli-scr-1',
    companyName: 'Instituto Pele Saudável',
    contactName: 'Dr. Lucas',
    phone: '5582988887777',
    displayPhone: '(82) 98888-7777',
    city: 'Arapiraca',
    serviceScope: 'Landing Page + SEO',
    websiteUrl: 'https://institutopele.com.br',
    status: 'ativo',
    monthlyMrr: 497,
    setupValue: 1800,
    timeline: [],
    createdAt: '2026-11-18T10:00:00.000Z',
  };
  const clientCtx = buildVariableContextFromClient(client, 'Kaizen Digital');
  const clientRes = interpolateCommercialScript(firstScript.content, clientCtx);
  assert.equal(clientRes.missingVariables.length, 0);
  assert.match(clientRes.renderedText, /https:\/\/institutopele\.com\.br/);

  const used = markScriptUsed(firstScript);
  assert.equal(used.usageCount, 1);
  assert.equal(used.referencedInHistory, true);

  const copy = duplicateCommercialScript(used, 'Ian');
  assert.notEqual(copy.id, used.id);
  assert.equal(copy.usageCount, 0);
  assert.equal(copy.referencedInHistory, false);

  const archived = archiveCommercialScript(used);
  assert.equal(archived.status, 'arquivado');
});

test('Biblioteca de Modelos instancia cópias independentes (editar modelo depois não altera registros criados)', () => {
  const templates = buildInitialModelTemplates();
  assert.equal(templates.length, 7);

  const propTemplate = templates.find((t) => t.id === 'tmpl-seed-proposta-start')!;
  const existingProposals: ProposalContract[] = [];

  const client: Client = {
    id: 'cli-tmpl-1',
    companyName: 'Academia Corpo Forte',
    contactName: 'Ricardo',
    phone: '5511977776666',
    displayPhone: '(11) 97777-6666',
    city: 'São Paulo',
    status: 'ativo',
    monthlyMrr: 0,
    setupValue: 0,
    timeline: [],
    createdAt: '2026-11-18T10:00:00.000Z',
  };

  const generatedProposal = buildIndependentProposalFromTemplate({
    template: propTemplate,
    existingProposals,
    issuerName: 'Ian',
    client,
  });

  assert.equal(generatedProposal.clientId, 'cli-tmpl-1');
  assert.equal(generatedProposal.recipientCompany, 'Academia Corpo Forte');
  assert.equal(generatedProposal.items.length, 3);
  assert.equal(generatedProposal.setupTotal, 1994);
  assert.equal(generatedProposal.monthlyMrr, 247);

  // Mutar o template original NÃO pode alterar a proposta gerada
  propTemplate.proposalDraft!.items![0].unitPrice = 99999;
  propTemplate.title = 'Modelo Alterado Depois';
  assert.equal(generatedProposal.items[0].unitPrice, 1497);
  assert.match(generatedProposal.title, /Kaizen Start/);

  // Instanciar projeto e tarefas independentes
  const projTemplate = templates.find((t) => t.id === 'tmpl-seed-projeto-start')!;
  const { project, initialTasks } = buildIndependentProjectFromTemplateModel({
    template: projTemplate,
    name: 'Implantação Start — Academia',
    clientId: 'cli-tmpl-1',
    ownerName: 'Ian',
    includePinnedInstagramPosts: true,
  });
  assert.equal(project.clientId, 'cli-tmpl-1');
  assert.ok(initialTasks.length >= 4);
  assert.ok(initialTasks.every((t) => t.projectId === project.id));

  // Instanciar tarefas de modelo de checklist
  const checklistTemplate = templates.find((t) => t.id === 'tmpl-seed-checklist-onboarding')!;
  const originalTaskTitle = checklistTemplate.taskDrafts![0].title;
  const generatedTasks = buildIndependentTasksFromTemplate({
    template: checklistTemplate,
    clientId: 'cli-tmpl-1',
  });
  assert.equal(generatedTasks.length, 1);
  assert.equal(generatedTasks[0].title, originalTaskTitle);

  checklistTemplate.taskDrafts![0].title = 'Alterado no Modelo';
  assert.equal(generatedTasks[0].title, originalTaskTitle);

  const customTmpl = createModelTemplate({
    title: 'Modelo Customizado',
    domain: 'gestao',
    kind: 'processo_interno',
    categoryId: 'cat-mod-gestao',
    content: 'Passo 1\nPasso 2',
    createdBy: 'Ian',
  });
  const copiedTmpl = duplicateModelTemplate(customTmpl, 'Ian');
  assert.notEqual(copiedTmpl.id, customTmpl.id);
  assert.match(copiedTmpl.title, /\(Cópia\)/);
});

test('Busca avançada, filtros cruzados e paginação de Recursos funcionam corretamente', () => {
  const f1 = makeDummyFile({
    id: 's1',
    name: 'Contrato Site A',
    categoryId: 'cat-doc-comercial',
    extension: 'pdf',
    tags: ['contrato', 'vip'],
    favorite: true,
    uploadedAt: '2026-11-10T10:00:00.000Z',
  });
  const f2 = makeDummyFile({
    id: 's2',
    name: 'Logo Vetor B',
    categoryId: 'cat-doc-identidade',
    extension: 'svg',
    tags: ['logo'],
    favorite: false,
    uploadedAt: '2026-11-15T10:00:00.000Z',
  });
  const f3 = makeDummyFile({
    id: 's3',
    name: 'Arquivo Antigo',
    status: 'arquivado',
    uploadedAt: '2026-10-01T10:00:00.000Z',
  });

  const onlyFav = filterResourceFiles([f1, f2, f3], { favoritesOnly: true });
  assert.deepEqual(
    onlyFav.map((f) => f.id),
    ['s1']
  );

  const byDateAndTag = filterResourceFiles([f1, f2, f3], {
    dateFrom: '2026-11-12',
    tag: 'logo',
  });
  assert.deepEqual(
    byDateAndTag.map((f) => f.id),
    ['s2']
  );

  const includeArchived = filterResourceFiles([f1, f2, f3], { status: 'all' });
  assert.equal(includeArchived.length, 3);

  const scripts = buildInitialCommercialScripts();
  const filteredScripts = filterCommercialScripts(scripts, { channel: 'ligacao' });
  assert.equal(filteredScripts.length, 1);

  const templates = buildInitialModelTemplates();
  const filteredTemplates = filterModelTemplates(templates, { domain: 'comercial' });
  assert.equal(filteredTemplates.length, 2);

  const page = paginateItems([1, 2, 3, 4, 5], 2, 2);
  assert.deepEqual(page.items, [3, 4]);
  assert.equal(page.totalPages, 3);
});

test('Backup v3.0 serializa, valida checksum e prepara restauração com as 5 coleções da Etapa 5', () => {
  const niche: NicheCampaign = {
    id: 'niche-1',
    name: 'Nicho Teste',
    segment: 'Saúde',
    city: 'Maceió',
    emoji: '🚀',
    targetMrr: 5000,
    scripts: {},
    createdAt: '2026-11-01T00:00:00.000Z',
  };

  const file = makeDummyFile({ id: 'rfile-bkp-1' });
  const folder = createResourceFolder({ name: 'Pasta Bkp', scope: 'geral' });
  const categories = buildDefaultResourceCategories();
  const scripts: CommercialScript[] = buildInitialCommercialScripts();
  const templates: ModelTemplate[] = buildInitialModelTemplates();

  const backup = buildCompleteBackupData({
    niches: [niche],
    leads: [],
    importedSheets: [],
    resourceFiles: [file],
    resourceFolders: [folder],
    resourceCategories: categories,
    commercialScripts: scripts,
    modelTemplates: templates,
    userName: 'Ian',
  });

  assert.equal(backup.version, '3.0');
  assert.equal(backup.counts?.resourceFiles, 1);
  assert.equal(backup.counts?.resourceFolders, 1);
  assert.equal(backup.counts?.resourceCategories, 25);
  assert.equal(backup.counts?.commercialScripts, 11);
  assert.equal(backup.counts?.modelTemplates, 7);

  const validation = parseAndValidateBackup(JSON.stringify(backup));
  assert.equal(validation.ok, true);
  assert.ok(validation.data);

  const prepared = prepareBackupRestorePayload(
    validation.data!,
    { niches: [], leads: [], importedSheets: [] },
    'skip_phone_duplicates'
  );
  assert.equal(prepared.resourceFilesToWrite.length, 1);
  assert.equal(prepared.resourceFoldersToWrite.length, 1);
  assert.equal(prepared.resourceCategoriesToWrite.length, 25);
  assert.equal(prepared.commercialScriptsToWrite.length, 11);
  assert.equal(prepared.modelTemplatesToWrite.length, 7);
});
