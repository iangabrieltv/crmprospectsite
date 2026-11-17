import {
  ResourceCategory,
  ResourceCategoryKind,
  ResourceFile,
  CommercialScript,
  ModelTemplate,
} from '../../types/resources';

export const DEFAULT_SCRIPT_CATEGORIES: Omit<ResourceCategory, 'createdAt'>[] = [
  { id: 'cat-scr-prospeccao-fria', name: 'Prospecção fria', kind: 'script', slug: 'prospeccao-fria', active: true, isDefault: true, sortOrder: 1 },
  { id: 'cat-scr-primeiro-contato', name: 'Primeiro contato', kind: 'script', slug: 'primeiro-contato', active: true, isDefault: true, sortOrder: 2 },
  { id: 'cat-scr-whatsapp', name: 'WhatsApp', kind: 'script', slug: 'whatsapp', active: true, isDefault: true, sortOrder: 3 },
  { id: 'cat-scr-ligacao', name: 'Ligação', kind: 'script', slug: 'ligacao', active: true, isDefault: true, sortOrder: 4 },
  { id: 'cat-scr-email', name: 'E-mail', kind: 'script', slug: 'email', active: true, isDefault: true, sortOrder: 5 },
  { id: 'cat-scr-follow-up', name: 'Follow-up', kind: 'script', slug: 'follow-up', active: true, isDefault: true, sortOrder: 6 },
  { id: 'cat-scr-objecoes', name: 'Objeções', kind: 'script', slug: 'objecoes', active: true, isDefault: true, sortOrder: 7 },
  { id: 'cat-scr-diagnostico', name: 'Reunião de diagnóstico', kind: 'script', slug: 'reuniao-diagnostico', active: true, isDefault: true, sortOrder: 8 },
  { id: 'cat-scr-proposta', name: 'Apresentação de proposta', kind: 'script', slug: 'apresentacao-proposta', active: true, isDefault: true, sortOrder: 9 },
  { id: 'cat-scr-contrato', name: 'Envio de contrato', kind: 'script', slug: 'envio-contrato', active: true, isDefault: true, sortOrder: 10 },
  { id: 'cat-scr-onboarding', name: 'Onboarding', kind: 'script', slug: 'onboarding', active: true, isDefault: true, sortOrder: 11 },
  { id: 'cat-scr-solicitacao-materiais', name: 'Solicitação de materiais', kind: 'script', slug: 'solicitacao-materiais', active: true, isDefault: true, sortOrder: 12 },
  { id: 'cat-scr-cobranca', name: 'Cobrança amigável', kind: 'script', slug: 'cobranca-amigavel', active: true, isDefault: true, sortOrder: 13 },
  { id: 'cat-scr-pos-venda', name: 'Pós-venda e indicação', kind: 'script', slug: 'pos-venda-indicacao', active: true, isDefault: true, sortOrder: 14 },
];

export const DEFAULT_FILE_CATEGORIES: Omit<ResourceCategory, 'createdAt'>[] = [
  { id: 'cat-doc-interno', name: 'Documentos Internos da Agência', kind: 'arquivo', slug: 'documentos-internos', active: true, isDefault: true, sortOrder: 1 },
  { id: 'cat-doc-cliente', name: 'Arquivos de Clientes', kind: 'arquivo', slug: 'arquivos-clientes', active: true, isDefault: true, sortOrder: 2 },
  { id: 'cat-doc-projeto', name: 'Arquivos de Projetos', kind: 'arquivo', slug: 'arquivos-projetos', active: true, isDefault: true, sortOrder: 3 },
  { id: 'cat-doc-referencia', name: 'Materiais de Referência', kind: 'arquivo', slug: 'materiais-referencia', active: true, isDefault: true, sortOrder: 4 },
  { id: 'cat-doc-marketing', name: 'Materiais de Marketing & Social', kind: 'arquivo', slug: 'materiais-marketing', active: true, isDefault: true, sortOrder: 5 },
  { id: 'cat-doc-identidade', name: 'Identidade Visual & Branding', kind: 'arquivo', slug: 'identidade-visual', active: true, isDefault: true, sortOrder: 6 },
  { id: 'cat-doc-comercial', name: 'Propostas, Contratos & Briefings', kind: 'arquivo', slug: 'comercial-briefings', active: true, isDefault: true, sortOrder: 7 },
];

export const DEFAULT_MODEL_CATEGORIES: Omit<ResourceCategory, 'createdAt'>[] = [
  { id: 'cat-mod-comercial', name: 'Comercial (Propostas, Contratos e Decks)', kind: 'modelo', slug: 'modelo-comercial', active: true, isDefault: true, sortOrder: 1 },
  { id: 'cat-mod-operacional', name: 'Operacional (Projetos, Tarefas e Checklists)', kind: 'modelo', slug: 'modelo-operacional', active: true, isDefault: true, sortOrder: 2 },
  { id: 'cat-mod-marketing', name: 'Marketing (Briefings, Social e Copys)', kind: 'modelo', slug: 'modelo-marketing', active: true, isDefault: true, sortOrder: 3 },
  { id: 'cat-mod-gestao', name: 'Gestão (SOPs, Rituais e Processos Internos)', kind: 'modelo', slug: 'modelo-gestao', active: true, isDefault: true, sortOrder: 4 },
];

export function buildDefaultResourceCategories(
  nowIso: string = new Date().toISOString()
): ResourceCategory[] {
  return [
    ...DEFAULT_FILE_CATEGORIES,
    ...DEFAULT_SCRIPT_CATEGORIES,
    ...DEFAULT_MODEL_CATEGORIES,
  ].map((cat) => ({
    ...cat,
    createdAt: nowIso,
    schemaVersion: 1,
    updatedAt: nowIso,
  }));
}

export function ensureDefaultCategories(existing: ResourceCategory[]): {
  categories: ResourceCategory[];
  added: ResourceCategory[];
} {
  const existingIds = new Set(existing.map((c) => c.id));
  const defaults = buildDefaultResourceCategories();
  const added = defaults.filter((d) => !existingIds.has(d.id));
  if (added.length === 0) {
    return { categories: existing, added: [] };
  }
  return {
    categories: [...existing, ...added].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99)),
    added,
  };
}

export function slugifyCategoryName(name: string): string {
  return (name || 'categoria')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'categoria';
}

export function generateResourceCategoryId(kind: ResourceCategoryKind): string {
  const prefix = kind === 'arquivo' ? 'rcat-doc' : kind === 'script' ? 'rcat-scr' : 'rcat-mod';
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

export function createResourceCategory(params: {
  name: string;
  kind: ResourceCategoryKind;
  description?: string;
  sortOrder?: number;
}): ResourceCategory {
  const nowIso = new Date().toISOString();
  return {
    id: generateResourceCategoryId(params.kind),
    name: params.name.trim(),
    kind: params.kind,
    slug: slugifyCategoryName(params.name),
    description: params.description?.trim() || undefined,
    active: true,
    isDefault: false,
    sortOrder: params.sortOrder ?? 50,
    createdAt: nowIso,
    schemaVersion: 1,
    updatedAt: nowIso,
  };
}

export function countCategoryReferences(
  categoryId: string,
  refs: {
    files: ResourceFile[];
    scripts: CommercialScript[];
    templates: ModelTemplate[];
  }
): number {
  const fileCount = refs.files.filter((f) => f.categoryId === categoryId).length;
  const scriptCount = refs.scripts.filter((s) => s.categoryId === categoryId).length;
  const templateCount = refs.templates.filter((t) => t.categoryId === categoryId).length;
  return fileCount + scriptCount + templateCount;
}
