import { Lead, NicheCampaign } from '../../types/crm';
import {
  Client,
  Project,
  ProposalContract,
  ProposalHistoryEvent,
  ProposalLineItem,
  Task,
} from '../../types/kaizen';
import {
  ModelTemplate,
  ModelTemplateDomain,
  ModelTemplateKind,
} from '../../types/resources';
import {
  DEFAULT_CONTRACT_CLAUSES,
  calculateProposalTotals,
  generateNextProposalCode,
  generateProposalItemId,
} from '../proposalService';
import {
  PROJECT_TEMPLATES,
  addDaysToIsoDate,
  createProjectWithTemplateTasks,
  generateProjectHistoryId,
  generateProjectId,
  getTodayIsoDate,
} from '../projectService';
import { generateTaskChecklistId, generateTaskId } from '../taskService';
import { cleanPhoneForWhatsApp } from '../../utils/phone';

export function generateModelTemplateId(): string {
  const rand = Math.random().toString(36).substring(2, 7);
  return `tmpl-${Date.now()}-${rand}`;
}

export function buildInitialModelTemplates(
  nowIso: string = new Date().toISOString()
): ModelTemplate[] {
  const list: Omit<ModelTemplate, 'createdAt' | 'updatedAt' | 'schemaVersion'>[] = [
    {
      id: 'tmpl-seed-proposta-start',
      title: 'Proposta Padrão — Kaizen Start',
      domain: 'comercial',
      kind: 'proposta',
      categoryId: 'cat-mod-comercial',
      description:
        'Proposta comercial pronta para presença digital inicial (Landing Page, Google Business Profile e SEO local).',
      content:
        'Proposta de implantação digital com foco em posicionamento local, página de alta conversão e integração imediata com WhatsApp comercial.',
      tags: ['proposta', 'kaizen-start', 'landing-page'],
      favorite: true,
      status: 'ativo',
      proposalDraft: {
        kind: 'proposta',
        summary:
          'Implantação completa do pacote Kaizen Start: Landing Page responsiva de alta conversão, otimização do Perfil da Empresa no Google e SEO técnico inicial.',
        paymentTerms:
          '50% na aprovação da proposta e 50% na homologação final · Recorrência mensal após publicação.',
        deliveryDeadlineDays: 14,
        items: [
          {
            title: 'Landing Page Profissional & Copywriting de Conversão',
            description:
              'Estrutura responsiva mobile-first, CTA direto para WhatsApp e formulário.',
            billingType: 'setup',
            quantity: 1,
            unitPrice: 1497,
          },
          {
            title: 'Otimização Google Business Profile + SEO On-Page',
            description:
              'Categorias locais, palavras-chave estratégicas, sitemap e indexação.',
            billingType: 'setup',
            quantity: 1,
            unitPrice: 497,
          },
          {
            title: 'Gestão Técnica, Hospedagem & Monitoramento Mensal',
            description: 'SSL, backups, segurança e atualizações contínuas.',
            billingType: 'mensal',
            quantity: 1,
            unitPrice: 247,
          },
        ],
      },
      usageCount: 0,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'tmpl-seed-contrato-recorrente',
      title: 'Contrato de Prestação de Serviços Digitais (Mensal + Setup)',
      domain: 'comercial',
      kind: 'contrato',
      categoryId: 'cat-mod-comercial',
      description:
        'Minuta base para formalização de projetos digitais com cláusulas de entrega, propriedade intelectual e aviso prévio.',
      content: DEFAULT_CONTRACT_CLAUSES,
      tags: ['contrato', 'juridico', 'recorrencia'],
      favorite: true,
      status: 'ativo',
      proposalDraft: {
        kind: 'contrato',
        summary:
          'Contrato de prestação de serviços de desenvolvimento web, posicionamento digital e suporte técnico contínuo.',
        paymentTerms:
          'Implantação (Setup) via PIX/Transferência na assinatura + mensalidade todo dia 10.',
        deliveryDeadlineDays: 14,
        clausesText: DEFAULT_CONTRACT_CLAUSES,
        items: [
          {
            title: 'Setup Inicial de Estrutura Digital',
            description: 'Configuração técnica, layout aprovado e implantação em produção.',
            billingType: 'setup',
            quantity: 1,
            unitPrice: 1800,
          },
          {
            title: 'Acompanhamento Mensal & Manutenção Gerenciada',
            description: 'Suporte técnico, backups e melhorias contínuas dentro do escopo.',
            billingType: 'mensal',
            quantity: 1,
            unitPrice: 397,
          },
        ],
      },
      usageCount: 0,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'tmpl-seed-projeto-start',
      title: 'Modelo de Projeto — Kaizen Start (Entrega 14 Dias)',
      domain: 'operacional',
      kind: 'projeto',
      categoryId: 'cat-mod-operacional',
      description:
        'Reaproveita diretamente o template operacional Kaizen Start (Landing Page, GBP, SEO e posts fixados) gerando tarefas independentes.',
      content: PROJECT_TEMPLATES.kaizen_start.description,
      tags: ['projeto', 'kaizen-start', 'operacao'],
      favorite: true,
      status: 'ativo',
      linkedProjectTemplateId: 'kaizen_start',
      usageCount: 0,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'tmpl-seed-projeto-performance',
      title: 'Modelo de Projeto — Kaizen Performance (90 Dias)',
      domain: 'operacional',
      kind: 'projeto',
      categoryId: 'cat-mod-operacional',
      description:
        'Reaproveita o programa contínuo de 90 dias (Estruturação 1–30, Execução 31–60, Otimização & Relatório 61–90).',
      content: PROJECT_TEMPLATES.kaizen_performance.description,
      tags: ['projeto', 'kaizen-performance', '90-dias'],
      favorite: false,
      status: 'ativo',
      linkedProjectTemplateId: 'kaizen_performance',
      usageCount: 0,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'tmpl-seed-checklist-onboarding',
      title: 'Checklist Padrão de Onboarding de Novo Cliente',
      domain: 'operacional',
      kind: 'checklist',
      categoryId: 'cat-mod-operacional',
      description:
        'Lista de verificação essencial para iniciar qualquer contrato sem esquecer acessos ou aprovações.',
      content:
        '1. Confirmar pagamento do setup\n2. Receber logo e identidade visual\n3. Validar domínio e DNS\n4. Alinhar oferta principal e WhatsApp de atendimento\n5. Criar pasta do cliente e vincular briefing',
      tags: ['onboarding', 'checklist'],
      favorite: false,
      status: 'ativo',
      taskDrafts: [
        {
          title: 'Executar Checklist de Onboarding do Cliente',
          description:
            'Validar acessos, materiais de marca, oferta e cronograma antes do início da produção.',
          priority: 'alta',
          checklist: [
            'Confirmar assinatura e pagamento inicial',
            'Coletar logotipo, paleta e fotos reais',
            'Validar acesso ao domínio/hospedagem',
            'Registrar briefing estratégico na Central de Materiais',
          ],
        },
      ],
      usageCount: 0,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'tmpl-seed-plano-social',
      title: 'Plano de Trabalho — Cadência Social Mensal (3 Posts/Semana)',
      domain: 'marketing',
      kind: 'plano_trabalho',
      categoryId: 'cat-mod-marketing',
      description:
        'Estrutura editorial equilibrada entre autoridade, prova social e conversão direta.',
      content:
        'Segunda: Conteúdo de Autoridade / Educação\nQuarta: Bastidores, Caso Real ou Prova Social\nSexta: Oferta Direta com CTA para WhatsApp\nStories diários de conexão e reforço.',
      tags: ['redes-sociais', 'calendario', 'marketing'],
      favorite: false,
      status: 'ativo',
      taskDrafts: [
        {
          title: 'Planejar pauta mensal de conteúdos (Autoridade + Prova + Oferta)',
          description: 'Definir temas das 12 peças do mês e vincular roteiros/artes em Redes Sociais.',
          priority: 'media',
          checklist: [
            'Definir 4 pautas de autoridade',
            'Definir 4 pautas de prova social/bastidores',
            'Definir 4 pautas comerciais com CTA',
          ],
        },
      ],
      usageCount: 0,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'tmpl-seed-sop-homologacao',
      title: 'SOP Interno — Homologação e Go-Live de Páginas',
      domain: 'gestao',
      kind: 'processo_interno',
      categoryId: 'cat-mod-gestao',
      description:
        'Processo padrão da agência antes de liberar qualquer site ou landing page em produção.',
      content:
        'Conferência obrigatória de SSL ativo, tempo de carregamento mobile, testes reais de todos os botões de WhatsApp, revisão ortográfica e verificação de meta tags OpenGraph.',
      tags: ['sop', 'qualidade', 'go-live'],
      favorite: false,
      status: 'ativo',
      taskDrafts: [
        {
          title: 'SOP: Revisão Técnica e Go-Live em Produção',
          description: 'Executar inspeção completa de qualidade antes da entrega formal.',
          priority: 'urgente',
          checklist: [
            'Testar todos os links de WhatsApp e formulários',
            'Validar layout em 375px (mobile) e 1440px (desktop)',
            'Conferir título, meta description e favicon',
            'Registrar URL final no cadastro do cliente',
          ],
        },
      ],
      usageCount: 0,
      createdBy: 'Sistema Kaizen',
    },
  ];

  return list.map((m) => ({
    ...m,
    createdAt: nowIso,
    updatedAt: nowIso,
    schemaVersion: 1,
  }));
}

export function createModelTemplate(params: {
  title: string;
  domain: ModelTemplateDomain;
  kind: ModelTemplateKind;
  categoryId: string;
  description?: string;
  content: string;
  tags?: string[];
  favorite?: boolean;
  linkedProjectTemplateId?: 'kaizen_start' | 'kaizen_performance';
  proposalDraft?: ModelTemplate['proposalDraft'];
  taskDrafts?: ModelTemplate['taskDrafts'];
  createdBy: string;
}): ModelTemplate {
  const nowIso = new Date().toISOString();
  return {
    id: generateModelTemplateId(),
    title: params.title.trim(),
    domain: params.domain,
    kind: params.kind,
    categoryId: params.categoryId,
    description: params.description?.trim() || undefined,
    content: params.content,
    tags: (params.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean),
    favorite: Boolean(params.favorite),
    status: 'ativo',
    linkedProjectTemplateId: params.linkedProjectTemplateId,
    proposalDraft: params.proposalDraft
      ? {
          ...params.proposalDraft,
          items: params.proposalDraft.items?.map((i) => ({ ...i })),
        }
      : undefined,
    taskDrafts: params.taskDrafts
      ? params.taskDrafts.map((t) => ({
          ...t,
          checklist: t.checklist ? [...t.checklist] : undefined,
        }))
      : undefined,
    usageCount: 0,
    createdBy: params.createdBy || 'Ian',
    createdAt: nowIso,
    schemaVersion: 1,
    updatedAt: nowIso,
  };
}

export function duplicateModelTemplate(
  original: ModelTemplate,
  createdBy: string
): ModelTemplate {
  const nowIso = new Date().toISOString();
  return {
    ...original,
    id: generateModelTemplateId(),
    title: `${original.title} (Cópia)`,
    tags: [...(original.tags || [])],
    favorite: false,
    status: 'ativo',
    archivedAt: undefined,
    usageCount: 0,
    proposalDraft: original.proposalDraft
      ? {
          ...original.proposalDraft,
          items: original.proposalDraft.items?.map((i) => ({ ...i })),
        }
      : undefined,
    taskDrafts: original.taskDrafts
      ? original.taskDrafts.map((t) => ({
          ...t,
          checklist: t.checklist ? [...t.checklist] : undefined,
        }))
      : undefined,
    createdBy: createdBy || original.createdBy,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function archiveModelTemplate(template: ModelTemplate): ModelTemplate {
  const nowIso = new Date().toISOString();
  return {
    ...template,
    status: 'arquivado',
    archivedAt: template.archivedAt || nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Gera um rascunho de Proposta ou Contrato TOTALMENTE INDEPENDENTE a partir de um ModelTemplate.
 * Preserva os dados reais do cliente/lead selecionados; alterar o modelo depois nunca muta o documento criado.
 */
export function buildIndependentProposalFromTemplate(params: {
  template: ModelTemplate;
  existingProposals: ProposalContract[];
  issuerName: string;
  client?: Client | null;
  lead?: Lead | null;
  niche?: NicheCampaign | null;
}): Omit<ProposalContract, 'id' | 'createdAt'> {
  const { template, existingProposals, issuerName, client, lead, niche } = params;
  const now = new Date();
  const kind =
    template.proposalDraft?.kind ||
    (template.kind === 'contrato' ? 'contrato' : 'proposta');
  const validDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const recipientCompany = client?.companyName || lead?.companyName || '';
  const recipientContact = client?.contactName || lead?.contactName || '';
  const recipientPhone = cleanPhoneForWhatsApp(client?.phone || lead?.phone || '');
  const recipientCity = client?.city || lead?.city || niche?.city || '';
  const recipientDocument = client?.document || '';
  const recipientEmail = client?.email || '';

  const draftItems = template.proposalDraft?.items;
  const items: ProposalLineItem[] =
    draftItems && draftItems.length > 0
      ? draftItems.map((it) => ({
          id: generateProposalItemId(),
          title: it.title,
          description: it.description,
          billingType: it.billingType,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        }))
      : [
          {
            id: generateProposalItemId(),
            title: template.title,
            description: template.description || template.content.slice(0, 240),
            billingType: 'setup',
            quantity: 1,
            unitPrice: client?.setupValue ?? lead?.creationValue ?? 997,
          },
        ];

  const totals = calculateProposalTotals(items, 0);
  const docLabel = kind === 'contrato' ? 'Contrato' : 'Proposta Comercial';

  const history: ProposalHistoryEvent[] = [
    {
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: now.toISOString(),
      status: 'rascunho',
      title: `${docLabel} gerada a partir do modelo "${template.title}"`,
      note: client
        ? `Cópia independente vinculada ao cliente ${client.companyName}.`
        : lead
        ? `Cópia independente originada do lead ${lead.companyName}.`
        : 'Cópia independente criada a partir da Biblioteca de Modelos.',
      author: issuerName,
    },
  ];

  return {
    code: generateNextProposalCode(existingProposals, kind, now),
    kind,
    title: recipientCompany
      ? `${template.title} — ${recipientCompany}`
      : template.title,
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
      template.proposalDraft?.summary ||
      template.description ||
      template.content.slice(0, 400),
    items,
    discountValue: 0,
    setupTotal: totals.setupTotal,
    monthlyMrr: totals.monthlyMrr,
    deliveryDeadlineDays: template.proposalDraft?.deliveryDeadlineDays ?? 14,
    paymentTerms:
      template.proposalDraft?.paymentTerms ||
      '50% na aprovação e 50% na entrega final · Recorrência mensal após publicação.',
    clausesText:
      kind === 'contrato'
        ? template.proposalDraft?.clausesText ||
          (template.kind === 'contrato' ? template.content : DEFAULT_CONTRACT_CLAUSES)
        : undefined,
    validUntil: validDate,
    notes: `Gerado a partir do modelo ${template.id} (${template.title}).`,
    history,
    schemaVersion: 1,
    updatedAt: now.toISOString(),
  };
}

/**
 * Instancia um Projeto e Tarefas TOTALMENTE INDEPENDENTES a partir de um ModelTemplate.
 * Reaproveita `PROJECT_TEMPLATES` quando `linkedProjectTemplateId` está definido.
 */
export function buildIndependentProjectFromTemplateModel(params: {
  template: ModelTemplate;
  name: string;
  clientId: string;
  ownerName: string;
  proposalId?: string;
  startDate?: string;
  dueDate?: string;
  includePinnedInstagramPosts?: boolean;
}): { project: Project; initialTasks: Task[] } {
  if (params.template.linkedProjectTemplateId) {
    return createProjectWithTemplateTasks({
      name: params.name,
      clientId: params.clientId,
      proposalId: params.proposalId,
      templateId: params.template.linkedProjectTemplateId,
      ownerName: params.ownerName,
      startDate: params.startDate,
      dueDate: params.dueDate,
      includePinnedInstagramPosts: params.includePinnedInstagramPosts,
      notes: `Instanciado a partir da Biblioteca de Modelos (${params.template.title}).`,
    });
  }

  const nowIso = new Date().toISOString();
  const startDate = params.startDate || getTodayIsoDate();
  const dueDate = params.dueDate || addDaysToIsoDate(startDate, 15);
  const projectId = generateProjectId();

  const initialTasks: Task[] = (params.template.taskDrafts || []).map((draft, idx) => {
    const taskId = generateTaskId();
    return {
      id: taskId,
      title: draft.title,
      description: draft.description,
      projectId,
      clientId: params.clientId,
      startDate,
      dueDate: addDaysToIsoDate(startDate, Math.min(15, (idx + 1) * 3)),
      priority: draft.priority,
      status: 'a_fazer',
      checklist: (draft.checklist || []).map((itemTitle) => ({
        id: generateTaskChecklistId(),
        title: itemTitle,
        done: false,
      })),
      createdAt: nowIso,
      schemaVersion: 1,
      updatedAt: nowIso,
    };
  });

  const project: Project = {
    id: projectId,
    name: params.name.trim(),
    clientId: params.clientId,
    proposalId: params.proposalId || undefined,
    serviceType: params.template.title,
    description: params.template.description || params.template.content,
    templateId: 'personalizado',
    status: 'nao_iniciado',
    ownerName: params.ownerName || 'Ian',
    startDate,
    dueDate,
    documents: [],
    history: [
      {
        id: generateProjectHistoryId('pinit'),
        date: nowIso,
        type: 'criacao',
        title: `Projeto gerado do modelo "${params.template.title}"`,
        description: `${initialTasks.length} tarefas copiadas de forma independente.`,
        author: params.ownerName,
      },
    ],
    notes: params.template.content,
    createdAt: nowIso,
    schemaVersion: 1,
    updatedAt: nowIso,
  };

  return { project, initialTasks };
}

/**
 * Gera uma ou mais Tarefas independentes a partir de um ModelTemplate operacional/checklist.
 */
export function buildIndependentTasksFromTemplate(params: {
  template: ModelTemplate;
  projectId?: string;
  clientId?: string;
}): Task[] {
  const nowIso = new Date().toISOString();
  const today = getTodayIsoDate();

  if (params.template.taskDrafts && params.template.taskDrafts.length > 0) {
    return params.template.taskDrafts.map((draft) => ({
      id: generateTaskId(),
      title: draft.title,
      description: draft.description,
      projectId: params.projectId || undefined,
      clientId: params.clientId || undefined,
      startDate: today,
      priority: draft.priority,
      status: 'a_fazer',
      checklist: (draft.checklist || []).map((title) => ({
        id: generateTaskChecklistId(),
        title,
        done: false,
      })),
      notes: `Gerada a partir do modelo "${params.template.title}".`,
      createdAt: nowIso,
      schemaVersion: 1,
      updatedAt: nowIso,
    }));
  }

  const lines = params.template.content
    .split('\n')
    .map((l) => l.replace(/^\d+[.)]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 12);

  return [
    {
      id: generateTaskId(),
      title: params.template.title,
      description: params.template.description || params.template.content,
      projectId: params.projectId || undefined,
      clientId: params.clientId || undefined,
      startDate: today,
      priority: 'media',
      status: 'a_fazer',
      checklist: lines.map((item) => ({
        id: generateTaskChecklistId(),
        title: item,
        done: false,
      })),
      notes: `Gerada a partir do modelo "${params.template.title}".`,
      createdAt: nowIso,
      schemaVersion: 1,
      updatedAt: nowIso,
    },
  ];
}
