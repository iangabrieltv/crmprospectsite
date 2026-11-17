export const ALLOWED_FILE_EXTENSIONS = [
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
] as const;

export type AllowedFileExtension = (typeof ALLOWED_FILE_EXTENSIONS)[number];

export const DANGEROUS_FILE_EXTENSIONS = [
  'exe',
  'bat',
  'cmd',
  'msi',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'vbs',
  'vbe',
  'js',
  'mjs',
  'cjs',
  'jse',
  'jar',
  'app',
  'dmg',
  'iso',
  'dll',
  'so',
  'dylib',
  'php',
  'py',
  'rb',
  'pl',
  'cgi',
  'html',
  'htm',
  'hta',
  'scr',
  'com',
  'pif',
  'reg',
  'apk',
  'deb',
  'rpm',
] as const;

export const MAX_UPLOAD_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export type ResourceStorageProvider =
  | 'firebase_storage'
  | 'indexeddb_dev'
  | 'external_link';

export type ResourceFileStatus = 'ativo' | 'arquivado';

export type ResourceClientSection =
  | 'contratos'
  | 'propostas'
  | 'briefings'
  | 'identidade_visual'
  | 'imagens'
  | 'videos'
  | 'materiais_cliente'
  | 'entregaveis'
  | 'outros';

export type ResourceProjectSection =
  | 'referencia'
  | 'producao'
  | 'artes'
  | 'documentos'
  | 'entregaveis'
  | 'arquivos_finais';

export interface ResourceFile {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  extension: AllowedFileExtension;
  sizeBytes: number;
  categoryId: string;
  description?: string;
  tags: string[];
  folderId?: string;
  favorite: boolean;
  status: ResourceFileStatus;
  clientId?: string;
  projectId?: string;
  proposalId?: string;
  linkedTaskIds?: string[];
  linkedSocialPostIds?: string[];
  clientSection?: ResourceClientSection;
  projectSection?: ResourceProjectSection;
  storagePath: string;
  storageProvider: ResourceStorageProvider;
  downloadUrl?: string;
  localBlobKey?: string;
  checksum?: string;
  uploadedBy: string;
  uploadedAt: string;
  archivedAt?: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export type ResourceFolderScope =
  | 'geral'
  | 'cliente'
  | 'projeto'
  | 'interno'
  | 'marketing';

export interface ResourceFolder {
  id: string;
  name: string;
  parentId?: string;
  scope: ResourceFolderScope;
  clientId?: string;
  projectId?: string;
  description?: string;
  colorAccent?: string;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export type ResourceCategoryKind = 'arquivo' | 'script' | 'modelo';

export interface ResourceCategory {
  id: string;
  name: string;
  kind: ResourceCategoryKind;
  slug: string;
  description?: string;
  active: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  createdAt: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export type CommercialScriptChannel =
  | 'whatsapp'
  | 'ligacao'
  | 'email'
  | 'reuniao'
  | 'proposta'
  | 'geral';

export type CommercialScriptStatus = 'ativo' | 'arquivado';

export interface CommercialScript {
  id: string;
  title: string;
  categoryId: string;
  channel: CommercialScriptChannel;
  description?: string;
  content: string;
  tags: string[];
  favorite: boolean;
  status: CommercialScriptStatus;
  usageCount?: number;
  referencedInHistory?: boolean;
  createdBy: string;
  createdAt: string;
  archivedAt?: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export type ModelTemplateDomain =
  | 'comercial'
  | 'operacional'
  | 'marketing'
  | 'gestao';

export type ModelTemplateKind =
  | 'proposta'
  | 'contrato'
  | 'checklist'
  | 'projeto'
  | 'tarefa'
  | 'plano_trabalho'
  | 'processo_interno'
  | 'texto_padrao'
  | 'apresentacao';

export type ModelTemplateStatus = 'ativo' | 'arquivado';

export interface ModelTemplateProposalItemDraft {
  title: string;
  description?: string;
  billingType: 'setup' | 'mensal' | 'pontual';
  quantity: number;
  unitPrice: number;
}

export interface ModelTemplateProposalDraft {
  kind: 'proposta' | 'contrato';
  summary?: string;
  paymentTerms?: string;
  deliveryDeadlineDays?: number;
  clausesText?: string;
  items?: ModelTemplateProposalItemDraft[];
}

export interface ModelTemplateTaskDraft {
  title: string;
  description?: string;
  priority: 'baixa' | 'media' | 'alta' | 'urgente';
  checklist?: string[];
}

export interface ModelTemplate {
  id: string;
  title: string;
  domain: ModelTemplateDomain;
  kind: ModelTemplateKind;
  categoryId: string;
  description?: string;
  content: string;
  tags: string[];
  favorite: boolean;
  status: ModelTemplateStatus;
  linkedProjectTemplateId?: 'kaizen_start' | 'kaizen_performance';
  proposalDraft?: ModelTemplateProposalDraft;
  taskDrafts?: ModelTemplateTaskDraft[];
  usageCount?: number;
  createdBy: string;
  createdAt: string;
  archivedAt?: string;
  schemaVersion?: number;
  updatedAt?: string;
}

export const RESOURCE_CLIENT_SECTIONS: {
  id: ResourceClientSection;
  label: string;
  description: string;
}[] = [
  { id: 'contratos', label: 'Contratos', description: 'Contratos assinados, aditivos e termos.' },
  { id: 'propostas', label: 'Propostas', description: 'Propostas comerciais e orçamentos.' },
  { id: 'briefings', label: 'Briefings', description: 'Questionários, escopos e alinhamentos.' },
  {
    id: 'identidade_visual',
    label: 'Identidade Visual',
    description: 'Logotipos, paletas, tipografias e manuais da marca.',
  },
  { id: 'imagens', label: 'Imagens', description: 'Fotos reais, banners e criativos estáticos.' },
  { id: 'videos', label: 'Vídeos', description: 'Reels, institucionais e materiais audiovisuais.' },
  {
    id: 'materiais_cliente',
    label: 'Materiais Enviados pelo Cliente',
    description: 'Acervo bruto enviado pelo cliente para produção.',
  },
  {
    id: 'entregaveis',
    label: 'Entregáveis',
    description: 'Peças aprovadas, relatórios e entregas finais.',
  },
  { id: 'outros', label: 'Outros Documentos', description: 'Documentos complementares diversos.' },
];

export const RESOURCE_PROJECT_SECTIONS: {
  id: ResourceProjectSection;
  label: string;
  description: string;
}[] = [
  { id: 'referencia', label: 'Referência', description: 'Benchmarks, inspirações e guias.' },
  { id: 'producao', label: 'Produção', description: 'Arquivos de trabalho e versões em edição.' },
  { id: 'artes', label: 'Artes', description: 'Criativos visuais, layouts e peças de social.' },
  { id: 'documentos', label: 'Documentos', description: 'Briefings, atas e especificações.' },
  { id: 'entregaveis', label: 'Entregáveis', description: 'Entregas parciais e revisões.' },
  {
    id: 'arquivos_finais',
    label: 'Arquivos Finais',
    description: 'Pacote final homologado e entregue.',
  },
];

export const MODEL_DOMAIN_OPTIONS: {
  id: ModelTemplateDomain;
  label: string;
  description: string;
}[] = [
  { id: 'comercial', label: 'Comercial', description: 'Propostas, contratos e apresentações.' },
  {
    id: 'operacional',
    label: 'Operacional',
    description: 'Projetos, tarefas, checklists e planos de trabalho.',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description: 'Calendários, copys, briefings criativos e textos padrão.',
  },
  { id: 'gestao', label: 'Gestão', description: 'Processos internos, governança e rituais.' },
];

export const MODEL_KIND_OPTIONS: {
  id: ModelTemplateKind;
  label: string;
}[] = [
  { id: 'proposta', label: 'Modelo de Proposta' },
  { id: 'contrato', label: 'Modelo de Contrato' },
  { id: 'projeto', label: 'Modelo de Projeto' },
  { id: 'tarefa', label: 'Modelo de Tarefa' },
  { id: 'checklist', label: 'Checklist Operacional' },
  { id: 'plano_trabalho', label: 'Plano de Trabalho' },
  { id: 'processo_interno', label: 'Processo Interno (SOP)' },
  { id: 'texto_padrao', label: 'Texto Padrão' },
  { id: 'apresentacao', label: 'Roteiro de Apresentação' },
];

export const SCRIPT_CHANNEL_OPTIONS: {
  id: CommercialScriptChannel;
  label: string;
}[] = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'ligacao', label: 'Ligação' },
  { id: 'email', label: 'E-mail' },
  { id: 'reuniao', label: 'Reunião' },
  { id: 'proposta', label: 'Proposta / Contrato' },
  { id: 'geral', label: 'Geral' },
];

export const SCRIPT_PLACEHOLDERS = [
  { token: '{{nome}}', label: 'Nome do contato' },
  { token: '{{empresa}}', label: 'Nome da empresa' },
  { token: '{{servico}}', label: 'Serviço / Nicho' },
  { token: '{{cidade}}', label: 'Cidade' },
  { token: '{{link}}', label: 'Link / Prévia / Proposta' },
  { token: '{{nome_agencia}}', label: 'Nome da agência' },
] as const;

export const FILE_FORMAT_LABELS: Record<AllowedFileExtension, string> = {
  pdf: 'PDF',
  doc: 'Word (.doc)',
  docx: 'Word (.docx)',
  xls: 'Excel (.xls)',
  xlsx: 'Excel (.xlsx)',
  ppt: 'PowerPoint (.ppt)',
  pptx: 'PowerPoint (.pptx)',
  png: 'Imagem PNG',
  jpg: 'Imagem JPG',
  jpeg: 'Imagem JPEG',
  svg: 'Vetor SVG',
  mp4: 'Vídeo MP4',
  txt: 'Texto (.txt)',
  csv: 'Planilha CSV',
  zip: 'Arquivo ZIP',
};
