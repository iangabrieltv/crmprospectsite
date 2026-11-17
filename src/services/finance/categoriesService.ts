import {
  FinancialCategory,
  FinancialEntry,
  FinancialKind,
  FinancialRecurrence,
} from '../../types/finance';
import { buildFinancialId } from './money';

export const DEFAULT_FINANCIAL_CATEGORIES: Omit<
  FinancialCategory,
  'createdAt' | 'schemaVersion'
>[] = [
  // Receitas
  {
    id: 'fcat-rec-setup',
    name: 'Setup / Implantação',
    kind: 'receita',
    description: 'Taxas iniciais de implantação, onboarding e estruturação.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-rec-mrr',
    name: 'Mensalidade / Recorrência (MRR)',
    kind: 'receita',
    description: 'Contratos mensais de assessoria e gestão contínua.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-rec-lp',
    name: 'Landing Page',
    kind: 'receita',
    description: 'Desenvolvimento e publicação de páginas de alta conversão.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-rec-trafego',
    name: 'Tráfego Pago',
    kind: 'receita',
    description: 'Gestão de campanhas Meta Ads e Google Ads.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-rec-redes',
    name: 'Gestão de Redes Sociais',
    kind: 'receita',
    description: 'Planejamento editorial, produção de peças e calendário social.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-rec-seo',
    name: 'SEO / Google Business Profile',
    kind: 'receita',
    description: 'Otimização orgânica local, SEO técnico e Google Perfil de Empresa.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-rec-consultoria',
    name: 'Consultoria / Serviço Pontual',
    kind: 'receita',
    description: 'Diagnósticos, mentorias e entregas pontuais fora de pacote mensal.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-rec-outros',
    name: 'Outras Receitas',
    kind: 'receita',
    description: 'Entradas operacionais diversas.',
    active: true,
    isDefault: true,
  },
  // Despesas (todas as 11 obrigatórias)
  {
    id: 'fcat-desp-dominio',
    name: 'Domínio',
    kind: 'despesa',
    description: 'Registro e renovação de domínios (.com.br, .com, etc.).',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-desp-hospedagem',
    name: 'Hospedagem / Servidor',
    kind: 'despesa',
    description: 'Servidores cloud, VPS, CDN e hospedagens web.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-desp-saas',
    name: 'Ferramentas / SaaS',
    kind: 'despesa',
    description: 'Assinaturas de softwares de design, produtividade e CRM.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-desp-trafego',
    name: 'Tráfego Pago',
    kind: 'despesa',
    description: 'Investimento em mídia paga própria da Kaizen ou repasse.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-desp-apis',
    name: 'APIs / IA',
    kind: 'despesa',
    description: 'Consumo de APIs externas, modelos de IA e integrações.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-desp-freelancers',
    name: 'Terceirizados / Freelancers',
    kind: 'despesa',
    description: 'Pagamentos de designers, copywriters, editores e devs parceiros.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-desp-impostos',
    name: 'Impostos / Taxas',
    kind: 'despesa',
    description: 'Guias fiscais, DAS, tarifas bancárias e taxas de gateway.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-desp-prolabore',
    name: 'Pró-labore',
    kind: 'despesa',
    description: 'Remuneração gerencial dos sócios/administradores.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-desp-marketing',
    name: 'Marketing da Kaizen',
    kind: 'despesa',
    description: 'Produção de marca, materiais e ações comerciais da agência.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-desp-equipamentos',
    name: 'Equipamentos',
    kind: 'despesa',
    description: 'Hardware, periféricos, áudio, vídeo e infraestrutura.',
    active: true,
    isDefault: true,
  },
  {
    id: 'fcat-desp-outros',
    name: 'Outros',
    kind: 'despesa',
    description: 'Despesas operacionais diversas não classificadas acima.',
    active: true,
    isDefault: true,
  },
];

export function ensureDefaultFinancialCategories(
  existing: FinancialCategory[]
): { categories: FinancialCategory[]; added: FinancialCategory[] } {
  const existingIds = new Set(existing.map((c) => c.id));
  const now = new Date().toISOString();
  const added: FinancialCategory[] = [];

  for (const def of DEFAULT_FINANCIAL_CATEGORIES) {
    if (!existingIds.has(def.id)) {
      added.push({
        ...def,
        createdAt: now,
        schemaVersion: 1,
      });
    }
  }

  return {
    categories: [...existing, ...added],
    added,
  };
}

export function createFinancialCategory(params: {
  name: string;
  kind: FinancialKind;
  description?: string;
}): FinancialCategory {
  return {
    id: buildFinancialId('fcat'),
    name: params.name.trim(),
    kind: params.kind,
    ...(params.description?.trim() ? { description: params.description.trim() } : {}),
    active: true,
    isDefault: false,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  };
}

export function getCategoryLinkedUsage(
  categoryId: string,
  entries: FinancialEntry[],
  recurrences: FinancialRecurrence[]
): { entryCount: number; recurrenceCount: number; totalCount: number } {
  const entryCount = entries.filter((e) => e.categoryId === categoryId).length;
  const recurrenceCount = recurrences.filter((r) => r.categoryId === categoryId).length;
  return {
    entryCount,
    recurrenceCount,
    totalCount: entryCount + recurrenceCount,
  };
}

export function canDeleteFinancialCategory(
  categoryId: string,
  entries: FinancialEntry[],
  recurrences: FinancialRecurrence[]
): { allowed: boolean; reason?: string; usage: { entryCount: number; recurrenceCount: number; totalCount: number } } {
  const usage = getCategoryLinkedUsage(categoryId, entries, recurrences);
  if (usage.totalCount > 0) {
    return {
      allowed: false,
      usage,
      reason: `Esta categoria está vinculada a ${usage.entryCount} lançamento(s) e ${usage.recurrenceCount} recorrência(s). Para preservar o histórico contábil/gerencial, utilize a opção "Desativar" em vez de excluir.`,
    };
  }
  return { allowed: true, usage };
}

export function getCategoryName(
  categories: FinancialCategory[],
  categoryId: string
): string {
  return categories.find((c) => c.id === categoryId)?.name || 'Sem categoria';
}
