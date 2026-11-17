import { Lead, NicheCampaign } from '../../types/crm';
import { Client } from '../../types/kaizen';
import {
  CommercialScript,
  CommercialScriptChannel,
} from '../../types/resources';
import { cleanPhoneForWhatsApp, buildWhatsAppLink } from '../../utils/phone';

export interface ScriptVariableContext {
  nome?: string;
  empresa?: string;
  servico?: string;
  cidade?: string;
  link?: string;
  nome_agencia?: string;
}

export interface InterpolatedScriptResult {
  renderedText: string;
  resolvedVariables: Record<keyof ScriptVariableContext, string>;
  missingVariables: string[];
}

export function generateCommercialScriptId(): string {
  const rand = Math.random().toString(36).substring(2, 7);
  return `cscr-${Date.now()}-${rand}`;
}

export function buildInitialCommercialScripts(
  agencyName: string = 'Agência Kaizen',
  nowIso: string = new Date().toISOString()
): CommercialScript[] {
  const baseScripts: Omit<
    CommercialScript,
    'createdAt' | 'updatedAt' | 'schemaVersion'
  >[] = [
    {
      id: 'cscr-seed-prospeccao-fria',
      title: 'Abordagem Inicial Direta (Com Diagnóstico)',
      categoryId: 'cat-scr-prospeccao-fria',
      channel: 'whatsapp',
      description: 'Primeiro toque para leads qualificados encontrados no Google Maps.',
      content: `Olá {{nome}}, tudo bem? Aqui é da {{nome_agencia}}.\n\nEstava analisando a presença digital da {{empresa}} em {{cidade}} para {{servico}} e notei uma oportunidade clara de captar mais clientes qualificados pelo Google e WhatsApp.\n\nPreparei um material rápido de referência para vocês: {{link}}\n\nFaz sentido trocarmos uma ideia de 10 minutos esta semana?`,
      tags: ['prospeccao', 'diagnostico', 'inicial'],
      favorite: true,
      status: 'ativo',
      usageCount: 0,
      referencedInHistory: false,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'cscr-seed-primeiro-contato',
      title: 'Primeiro Contato Pós-Cadastro',
      categoryId: 'cat-scr-primeiro-contato',
      channel: 'whatsapp',
      description: 'Mensagem objetiva para abertura de conversa com decisor.',
      content: `Oi {{nome}}! Tudo certo?\n\nSou da {{nome_agencia}} e acompanho negócios de {{servico}} na região de {{cidade}}.\n\nVi o perfil da {{empresa}} e queria confirmar se vocês estão aceitando novos clientes este mês — posso te mostrar como estamos estruturando o canal de entrada para empresas do segmento?`,
      tags: ['abertura', 'decisor'],
      favorite: false,
      status: 'ativo',
      usageCount: 0,
      referencedInHistory: false,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'cscr-seed-ligacao',
      title: 'Roteiro de Ligação Consultiva (60s)',
      categoryId: 'cat-scr-ligacao',
      channel: 'ligacao',
      description: 'Abertura rápida para ligação telefônica sem parecer telemarketing.',
      content: `Oi {{nome}}, aqui é da {{nome_agencia}}. Tudo bem?\n\nVou ser bem objetivo porque sei que seu dia na {{empresa}} é corrido.\n\nOlhamos como clientes de {{cidade}} estão encontrando serviços de {{servico}} hoje e vimos pontos de melhoria direta para a {{empresa}}.\n\nConsigo te enviar essa análise por WhatsApp em {{link}} para você olhar quando puder?`,
      tags: ['ligacao', 'cold-call'],
      favorite: true,
      status: 'ativo',
      usageCount: 0,
      referencedInHistory: false,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'cscr-seed-followup',
      title: 'Follow-up 48h Sem Resposta',
      categoryId: 'cat-scr-follow-up',
      channel: 'whatsapp',
      description: 'Retomada leve após 2 dias sem retorno mantendo autoridade.',
      content: `Oi {{nome}}, passando rapidinho por aqui.\n\nVocê chegou a conseguir dar uma olhada no material que enviei para a {{empresa}} ({{link}})?\n\nSe não for prioridade agora para {{servico}} em {{cidade}}, sem problemas — só me avisa para eu alinhar por aqui.`,
      tags: ['followup', 'retomada'],
      favorite: false,
      status: 'ativo',
      usageCount: 0,
      referencedInHistory: false,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'cscr-seed-objecao-preco',
      title: 'Quebra de Objeção — "Está caro / Vou pensar"',
      categoryId: 'cat-scr-objecoes',
      channel: 'whatsapp',
      description: 'Reposicionamento de valor focado em retorno e estrutura comercial.',
      content: `Super entendo, {{nome}}! Decisão de investimento na {{empresa}} precisa mesmo fazer sentido no caixa.\n\nJustamente por isso desenhamos o escopo de {{servico}} para se pagar com os primeiros novos clientes gerados em {{cidade}}.\n\nSe quiser, revisamos juntos os itens da proposta em {{link}} para adequar à prioridade atual de vocês.`,
      tags: ['objecao', 'preco', 'negociacao'],
      favorite: false,
      status: 'ativo',
      usageCount: 0,
      referencedInHistory: false,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'cscr-seed-proposta',
      title: 'Envio e Apresentação de Proposta',
      categoryId: 'cat-scr-proposta',
      channel: 'proposta',
      description: 'Mensagem padrão ao encaminhar proposta em PDF.',
      content: `Olá {{nome}}! Conforme combinamos, segue a proposta estruturada da {{nome_agencia}} para a {{empresa}}.\n\nNela detalhamos o escopo de {{servico}}, cronograma e condições de investimento.\n\nLink de referência / acesso: {{link}}\n\nQual ponto você gostaria de validar primeiro comigo?`,
      tags: ['proposta', 'fechamento'],
      favorite: true,
      status: 'ativo',
      usageCount: 0,
      referencedInHistory: false,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'cscr-seed-contrato',
      title: 'Envio de Contrato para Assinatura',
      categoryId: 'cat-scr-contrato',
      channel: 'proposta',
      description: 'Formalização de fechamento e próximos passos imediatos.',
      content: `Excelente passo, {{nome}}! Seja muito bem-vindo(a) à {{nome_agencia}}.\n\nEstou enviando o contrato da {{empresa}} referente ao projeto de {{servico}} para formalizarmos o início dos trabalhos.\n\nDocumento / Link: {{link}}\n\nAssim que assinado, já liberamos o checklist de onboarding da equipe.`,
      tags: ['contrato', 'fechamento'],
      favorite: false,
      status: 'ativo',
      usageCount: 0,
      referencedInHistory: false,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'cscr-seed-onboarding',
      title: 'Boas-Vindas e Onboarding do Cliente',
      categoryId: 'cat-scr-onboarding',
      channel: 'whatsapp',
      description: 'Abertura da fase de implantação logo após assinatura.',
      content: `Olá {{nome}}! A partir de hoje iniciamos oficialmente a operação de {{servico}} para a {{empresa}}.\n\nAqui na {{nome_agencia}} organizamos todo o cronograma por etapas para você acompanhar com clareza.\n\nNosso primeiro passo está aqui: {{link}}\n\nQualquer dúvida durante o processo, pode contar diretamente comigo!`,
      tags: ['onboarding', 'cliente'],
      favorite: false,
      status: 'ativo',
      usageCount: 0,
      referencedInHistory: false,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'cscr-seed-materiais',
      title: 'Solicitação de Materiais & Acessos',
      categoryId: 'cat-scr-solicitacao-materiais',
      channel: 'whatsapp',
      description: 'Coleta de logo, fotos reais, domínio e acessos para não travar entrega.',
      content: `Oi {{nome}}, tudo bem? Para avançarmos na produção de {{servico}} da {{empresa}} dentro do prazo, precisamos dos seguintes materiais:\n\n1. Logotipo (preferencialmente vetor/PNG transparente)\n2. Fotos reais da estrutura e equipe\n3. Link/acessos previstos para publicação: {{link}}\n\nConsegue me enviar por aqui até amanhã?`,
      tags: ['materiais', 'briefing', 'operacao'],
      favorite: false,
      status: 'ativo',
      usageCount: 0,
      referencedInHistory: false,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'cscr-seed-cobranca',
      title: 'Lembrete Amigável de Pagamento',
      categoryId: 'cat-scr-cobranca',
      channel: 'whatsapp',
      description: 'Comunicação respeitosa sobre vencimento ou pendência financeira.',
      content: `Olá {{nome}}, tudo bem? Passando apenas para lembrar com carinho do vencimento referente ao serviço de {{servico}} da {{empresa}} junto à {{nome_agencia}}.\n\nCaso já tenha realizado o pagamento, por favor desconsidere! Se precisar da segunda via ou chave atualizada, é só me avisar ({{link}}).`,
      tags: ['financeiro', 'cobranca'],
      favorite: false,
      status: 'ativo',
      usageCount: 0,
      referencedInHistory: false,
      createdBy: 'Sistema Kaizen',
    },
    {
      id: 'cscr-seed-posvenda',
      title: 'Pós-Venda e Pedido de Indicação',
      categoryId: 'cat-scr-pos-venda',
      channel: 'whatsapp',
      description: 'Check-in de satisfação após entrega concluída e geração de indicações.',
      content: `Oi {{nome}}! Como estão sendo os resultados da {{empresa}} em {{cidade}} após a entrega de {{servico}}?\n\nFicamos muito felizes com a parceria na {{nome_agencia}}. Se conhecer algum outro empresário de confiança que também precise fortalecer sua presença digital, será um prazer atendê-lo! Link de referência: {{link}}`,
      tags: ['pos-venda', 'indicacao'],
      favorite: false,
      status: 'ativo',
      usageCount: 0,
      referencedInHistory: false,
      createdBy: 'Sistema Kaizen',
    },
  ];

  return baseScripts.map((s) => ({
    ...s,
    createdAt: nowIso,
    updatedAt: nowIso,
    schemaVersion: 1,
  }));
}

/**
 * Interpola variáveis dinâmicas do script SEM inventar dados faltantes.
 * Caso alguma variável usada no texto não possua valor real no contexto,
 * preserva o token `{{variavel}}` e lista em `missingVariables`.
 */
export function interpolateCommercialScript(
  content: string,
  ctx: ScriptVariableContext
): InterpolatedScriptResult {
  const safeCtx: Record<keyof ScriptVariableContext, string> = {
    nome: (ctx.nome || '').trim(),
    empresa: (ctx.empresa || '').trim(),
    servico: (ctx.servico || '').trim(),
    cidade: (ctx.cidade || '').trim(),
    link: (ctx.link || '').trim(),
    nome_agencia: (ctx.nome_agencia || '').trim(),
  };

  const missingSet = new Set<string>();
  const renderedText = (content || '').replace(
    /\{\{\s*(nome|empresa|servico|cidade|link|nome_agencia)\s*\}\}/gi,
    (fullMatch, rawKey: string) => {
      const key = rawKey.toLowerCase() as keyof ScriptVariableContext;
      const val = safeCtx[key];
      if (!val) {
        missingSet.add(`{{${key}}}`);
        return fullMatch;
      }
      return val;
    }
  );

  return {
    renderedText,
    resolvedVariables: safeCtx,
    missingVariables: Array.from(missingSet),
  };
}

export function buildVariableContextFromLead(
  lead: Lead,
  niche?: NicheCampaign | null,
  agencyName: string = 'Agência Kaizen'
): ScriptVariableContext {
  return {
    nome: lead.contactName?.trim() || '',
    empresa: lead.companyName?.trim() || '',
    servico: lead.category?.trim() || niche?.segment?.trim() || '',
    cidade: lead.city?.trim() || niche?.city?.trim() || '',
    link: lead.mockupUrl?.trim() || lead.websiteUrl?.trim() || '',
    nome_agencia: agencyName.trim(),
  };
}

export function buildVariableContextFromClient(
  client: Client,
  agencyName: string = 'Agência Kaizen',
  optionalLink?: string
): ScriptVariableContext {
  return {
    nome: client.contactName?.trim() || '',
    empresa: client.companyName?.trim() || '',
    servico: client.serviceScope?.trim() || client.segment?.trim() || '',
    cidade: client.city?.trim() || '',
    link: optionalLink?.trim() || client.websiteUrl?.trim() || '',
    nome_agencia: agencyName.trim(),
  };
}

export function buildScriptWhatsAppUrl(phone: string, renderedMessage: string): string {
  const clean = cleanPhoneForWhatsApp(phone);
  if (!clean) return '';
  return buildWhatsAppLink(clean, renderedMessage);
}

export function createCommercialScript(params: {
  title: string;
  categoryId: string;
  channel: CommercialScriptChannel;
  description?: string;
  content: string;
  tags?: string[];
  favorite?: boolean;
  createdBy: string;
}): CommercialScript {
  const nowIso = new Date().toISOString();
  return {
    id: generateCommercialScriptId(),
    title: params.title.trim(),
    categoryId: params.categoryId,
    channel: params.channel,
    description: params.description?.trim() || undefined,
    content: params.content,
    tags: (params.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean),
    favorite: Boolean(params.favorite),
    status: 'ativo',
    usageCount: 0,
    referencedInHistory: false,
    createdBy: params.createdBy || 'Ian',
    createdAt: nowIso,
    schemaVersion: 1,
    updatedAt: nowIso,
  };
}

export function duplicateCommercialScript(
  original: CommercialScript,
  createdBy: string
): CommercialScript {
  const nowIso = new Date().toISOString();
  return {
    ...original,
    id: generateCommercialScriptId(),
    title: `${original.title} (Cópia)`,
    tags: [...(original.tags || [])],
    favorite: false,
    status: 'ativo',
    usageCount: 0,
    referencedInHistory: false,
    archivedAt: undefined,
    createdBy: createdBy || original.createdBy,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function archiveCommercialScript(script: CommercialScript): CommercialScript {
  const nowIso = new Date().toISOString();
  return {
    ...script,
    status: 'arquivado',
    archivedAt: script.archivedAt || nowIso,
    updatedAt: nowIso,
  };
}

export function markScriptUsed(script: CommercialScript): CommercialScript {
  return {
    ...script,
    usageCount: (script.usageCount || 0) + 1,
    referencedInHistory: true,
    updatedAt: new Date().toISOString(),
  };
}
