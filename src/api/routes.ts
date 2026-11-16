import { Router, Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import {
  createFirebaseAuthMiddleware,
  createRateLimiter,
  TokenVerifier,
} from './securityMiddleware';

export interface CreateApiRouterOptions {
  verifyToken?: TokenVerifier;
  projectId?: string;
  authorizedAdminUid?: string;
  authorizedAdminEmail?: string;
  rateLimitMaxRequests?: number;
  rateLimitWindowMs?: number;
}

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';

// Shared server-side Gemini client with 'aistudio-build' user-agent
export const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

function sanitizeString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function isPlainBodyObject(body: unknown): body is Record<string, unknown> {
  return Boolean(body && typeof body === 'object' && !Array.isArray(body));
}

export function createApiRouter(options: CreateApiRouterOptions = {}) {
  const router = Router();
  const requireAuth = createFirebaseAuthMiddleware({
    verifyToken: options.verifyToken,
    projectId: options.projectId,
    authorizedAdminUid: options.authorizedAdminUid,
    authorizedAdminEmail: options.authorizedAdminEmail,
  });
  const rateLimiter = createRateLimiter({
    windowMs: options.rateLimitWindowMs ?? 60_000,
    maxRequests: options.rateLimitMaxRequests ?? 30,
  });

  // Public Health check endpoint (returns no sensitive info)
  const handleHealth = (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  };
  router.get('/api/health', handleHealth);
  router.get('/health', handleHealth);

  // API: AI Lead Extraction & Cleaning (legacy/optional endpoint — kept protected)
  const handleAnalyzeLeads = async (req: Request, res: Response) => {
    try {
      if (!isPlainBodyObject(req.body)) {
        res.status(400).json({ error: 'Corpo da requisição inválido.' });
        return;
      }
      const rawText = sanitizeString(req.body.rawText, 30000);
      const nicheName = sanitizeString(req.body.nicheName, 120);
      const nicheSegment = sanitizeString(req.body.nicheSegment, 120);
      const defaultCity = sanitizeString(req.body.defaultCity, 120);

      if (!rawText) {
        res.status(400).json({ error: 'Texto ou dados de planilha ausentes.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Chave GEMINI_API_KEY não configurada no servidor. Usando importação direta.',
          fallback: true,
        });
        return;
      }

      const prompt = `Você é um analista especialista em CRM de prospecção ativa de vendas de sites e higienização de planilhas comerciais.
Analise a seguinte lista de contatos/empresas fornecida pelo usuário (tabela do Excel, CSV, Google Maps scraper, bloco de notas, etc.).
Nicho/Segmento Alvo: ${nicheName || 'Geral'} (${nicheSegment || nicheName || 'Negócios Locais'})
Cidade Padrão: ${defaultCity || 'Brasil'}

DADOS BRUTOS:
"""
${rawText.slice(0, 15000)}
"""

Extraia e padronize cada lead individualmente.
Regras obrigatórias:
1. "companyName": Nome limpo da empresa/consultório/estabelecimento.
2. "contactName": Nome do profissional/responsável se constar ou null.
3. "phone": Telefone apenas com dígitos, formatado no padrão internacional do Brasil se for BR.
4. "category": Categoria / Atividade do negócio.
5. "isNicheMatch": BOOLEAN.
6. "mismatchReason": Motivo se isNicheMatch for false, ou null.
7. "googleMapsUrl": Link do Google Maps se houver, ou link de busca.
8. "websiteUrl": Site ou rede social se houver, ou null.
9. "city": Cidade e Estado ou "${defaultCity || ''}".
10. "address": Endereço ou bairro se constar.
11. "googleRating": Nota média (1.0 a 5.0) ou null.
12. "recommendedScript": Roteiro recomendado.
13. "opportunityAngle": Frase curta (máx. 12 palavras).

Retorne a lista em formato JSON estrito conforme o schema.`;

      const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                companyName: { type: Type.STRING },
                contactName: { type: Type.STRING },
                phone: { type: Type.STRING },
                category: { type: Type.STRING },
                isNicheMatch: { type: Type.BOOLEAN },
                mismatchReason: { type: Type.STRING },
                googleMapsUrl: { type: Type.STRING },
                websiteUrl: { type: Type.STRING },
                city: { type: Type.STRING },
                address: { type: Type.STRING },
                googleRating: { type: Type.NUMBER },
                recommendedScript: { type: Type.STRING },
                opportunityAngle: { type: Type.STRING },
              },
              required: ['companyName', 'phone', 'category', 'isNicheMatch'],
            },
          },
        },
      });

      const parsed = JSON.parse(response.text || '[]');
      res.json({ leads: parsed });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro interno';
      console.error(`[API /analyze-leads] Falha controlada: ${msg}`);
      res.status(500).json({ error: 'Falha ao analisar dados com IA.' });
    }
  };
  router.post('/api/gemini/analyze-leads', requireAuth, rateLimiter, handleAnalyzeLeads);
  router.post('/gemini/analyze-leads', requireAuth, rateLimiter, handleAnalyzeLeads);

  // API: Generate Tailored Pitch for a Lead
  const handleGeneratePitch = async (req: Request, res: Response) => {
    try {
      if (!isPlainBodyObject(req.body)) {
        res.status(400).json({ error: 'Corpo da requisição inválido.' });
        return;
      }
      const companyName = sanitizeString(req.body.companyName, 200);
      const niche = sanitizeString(req.body.niche, 150);
      const city = sanitizeString(req.body.city, 120);
      const googleRating = sanitizeString(String(req.body.googleRating ?? ''), 20);
      const objection = sanitizeString(req.body.objection, 400);
      const scriptType = sanitizeString(req.body.scriptType, 120);

      if (!companyName) {
        res.status(400).json({ error: 'Nome da empresa é obrigatório para gerar o pitch.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
        return;
      }

      const prompt = `Você é um copywriter de vendas consultivas de sites modernos e de alta conversão.
Gere uma mensagem persuasiva e ultra personalizada de WhatsApp para:
- Empresa: ${companyName}
- Nicho: ${niche || 'Negócio Local'}
- Cidade: ${city || 'Brasil'}
- Avaliação Google: ${googleRating ? googleRating + ' estrelas' : 'boa reputação local'}
- Objeção anterior (se houver): ${objection || 'Nenhuma'}
- Tipo de abordagem desejada: ${scriptType || 'Diagnóstico de oportunidade'}

Diretrizes:
- Mensagem curta, conversacional e direta (máximo 4 a 6 linhas).
- Tom respeitoso, profissional e agregador (sem parecer spam robótico).
- Termine com uma pergunta fácil de responder com sim/não.
- Inclua emojis comedidos.
Retorne apenas a mensagem formatada para WhatsApp.`;

      const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: prompt,
      });

      res.json({ pitch: response.text?.trim() || '' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro interno';
      console.error(`[API /generate-pitch] Falha controlada: ${msg}`);
      res.status(500).json({ error: 'Falha ao gerar pitch com IA.' });
    }
  };
  router.post('/api/gemini/generate-pitch', requireAuth, rateLimiter, handleGeneratePitch);
  router.post('/gemini/generate-pitch', requireAuth, rateLimiter, handleGeneratePitch);

  // API: Improve / Polish a sales script block
  const handleImproveScript = async (req: Request, res: Response) => {
    try {
      if (!isPlainBodyObject(req.body)) {
        res.status(400).json({ error: 'Corpo da requisição inválido.' });
        return;
      }
      const currentMessage = sanitizeString(req.body.currentMessage, 8000);
      const instruction = sanitizeString(req.body.instruction, 1000);
      const nicheName = sanitizeString(req.body.nicheName, 120);
      const blockTitle = sanitizeString(req.body.blockTitle, 150);

      if (!currentMessage) {
        res.status(400).json({ error: 'Mensagem atual é obrigatória para otimização.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
        return;
      }

      const prompt = `Você é um dos maiores especialistas em copywriting de vendas B2B e prospecção ativa de sites modernos para empresas e negócios locais.
O usuário quer otimizar e melhorar o seguinte bloco de script de vendas para o nicho de "${nicheName || 'Negócios Locais'}".
Etapa/Bloco: "${blockTitle || 'Mensagem'}"
Objetivo ou Instrução de melhoria: "${instruction || 'Tornar mais persuasivo, natural e aumentar taxa de resposta no WhatsApp'}"

Mensagem Atual:
"""
${currentMessage}
"""

Regras OBRIGATÓRIAS:
1. Mantenha as tags de variáveis existentes exatamente como estão (ex: {empresa}, {contato}, {cidade}, {seuNome}, {linkMockup}, etc.), sem remover ou inventar tags malucas.
2. Escreva em português brasileiro fluido, tom consultivo, natural, sem parecer robô ou vendedor chato.
3. Seja conciso e direto ao ponto. No WhatsApp, mensagens diretas e bem pontuadas convertem muito mais.
4. Retorne APENAS o novo texto da mensagem melhorada, sem introduções ou explicações.`;

      const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: prompt,
      });

      res.json({ improvedMessage: response.text?.trim() || currentMessage });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro interno';
      console.error(`[API /improve-script] Falha controlada: ${msg}`);
      res.status(500).json({ error: 'Falha ao melhorar script com IA.' });
    }
  };
  router.post('/api/gemini/improve-script', requireAuth, rateLimiter, handleImproveScript);
  router.post('/gemini/improve-script', requireAuth, rateLimiter, handleImproveScript);

  // API: Conversational AI Filter for Imported Spreadsheet Leads (legacy/optional endpoint — kept protected)
  const handleFilterImportedLeads = async (req: Request, res: Response) => {
    try {
      if (!isPlainBodyObject(req.body)) {
        res.status(400).json({ error: 'Corpo da requisição inválido.' });
        return;
      }
      const userInstruction = sanitizeString(req.body.userInstruction, 2000);
      const nicheName = sanitizeString(req.body.nicheName, 120);
      const nicheSegment = sanitizeString(req.body.nicheSegment, 120);
      const rawLeads = req.body.leads;

      if (!userInstruction) {
        res.status(400).json({ error: 'Instrução do usuário não fornecida.' });
        return;
      }
      if (!Array.isArray(rawLeads) || rawLeads.length === 0) {
        res.status(400).json({ error: 'Lista de contatos vazia para filtragem.' });
        return;
      }
      if (rawLeads.length > 500) {
        res.status(400).json({
          error: 'Limite máximo de 500 contatos por requisição excedido.',
        });
        return;
      }

      const leads = rawLeads;
      const ai = getGeminiClient();

      if (!ai) {
        const normalizedInstruction = userInstruction.toLowerCase();
        const terms = normalizedInstruction
          .replace(/retirar|remover|excluir|apagar|tirar|todos|os|que|estao|na|categoria|de|com|sem|por|favor/gi, ' ')
          .split(/\s+/)
          .map((t) => t.trim())
          .filter((t) => t.length > 2);

        const removedDetails: { id: string; companyName: string; reason: string }[] = [];
        const removedIds: string[] = [];
        const removedCategoriesSet = new Set<string>();

        leads.forEach((l: Record<string, unknown>, idx: number) => {
          const leadId = typeof l?.id === 'string' ? l.id : String(idx);
          const cat = typeof l?.category === 'string' ? l.category.toLowerCase() : '';
          const comp = typeof l?.companyName === 'string' ? l.companyName.toLowerCase() : '';

          const match = terms.some((term) => cat.includes(term) || comp.includes(term));
          if (match) {
            removedIds.push(leadId);
            if (typeof l?.category === 'string' && l.category) {
              removedCategoriesSet.add(l.category);
            }
            removedDetails.push({
              id: leadId,
              companyName: typeof l?.companyName === 'string' ? l.companyName : 'Lead',
              reason: `Identificado pelo termo de exclusão "${terms.join(', ')}"`,
            });
          }
        });

        res.json({
          removedIds,
          explanation: `Filtro local aplicado: ${removedIds.length} contatos removidos correspondentes a "${terms.join(', ')}".`,
          removedCategories: Array.from(removedCategoriesSet),
          removedDetails,
          retainedCount: leads.length - removedIds.length,
          removedCount: removedIds.length,
          usedFallback: true,
        });
        return;
      }

      const leadSummaryList = leads.slice(0, 350).map((l: Record<string, unknown>, idx: number) => ({
        id: typeof l?.id === 'string' ? l.id : String(idx),
        empresa: sanitizeString(l?.companyName, 120),
        categoria: sanitizeString(l?.category, 80) || 'Sem categoria',
        cidade: sanitizeString(l?.city, 80),
        telefone: sanitizeString(l?.phone, 30),
        notaGoogle: typeof l?.googleRating === 'number' ? l.googleRating : null,
      }));

      const prompt = `Você é um analista especialista em CRM de prospecção ativa de vendas e higienização de listas comerciais.
O usuário importou uma lista de contatos para a campanha de nicho: "${nicheName || 'Geral'}" (${nicheSegment || nicheName || 'Negócios Locais'}).

O usuário enviou a seguinte instrução para limpar/filtrar a lista de contatos:
"""
${userInstruction}
"""

LISTA DE CONTATOS ATUAIS (${leadSummaryList.length} contatos):
${JSON.stringify(leadSummaryList)}

DIRETRIZES OBRIGATÓRIAS:
1. Avalie com atenção a intenção do usuário e liste IDs em "removedIds".
2. Seja preciso e não remova empresas legítimas do nicho principal a menos que solicitado.
3. Gere uma mensagem explicativa ("explanation") em português do Brasil.
4. Liste as categorias removidas em "removedCategories".
5. Em "removedDetails", inclua id, companyName e reason curta.

Retorne estritamente o JSON no schema especificado.`;

      const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              removedIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              explanation: { type: Type.STRING },
              removedCategories: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              removedDetails: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    companyName: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ['id', 'companyName', 'reason'],
                },
              },
            },
            required: ['removedIds', 'explanation', 'removedCategories'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const removedIds = Array.isArray(parsed.removedIds) ? parsed.removedIds : [];

      res.json({
        removedIds,
        explanation:
          parsed.explanation ||
          `Foram filtrados ${removedIds.length} contatos com base na sua instrução.`,
        removedCategories: parsed.removedCategories || [],
        removedDetails: parsed.removedDetails || [],
        retainedCount: leads.length - removedIds.length,
        removedCount: removedIds.length,
        usedFallback: false,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro interno';
      console.error(`[API /filter-imported-leads] Falha controlada: ${msg}`);
      res.status(500).json({ error: 'Falha ao processar filtragem com IA.' });
    }
  };
  router.post(
    '/api/gemini/filter-imported-leads',
    requireAuth,
    rateLimiter,
    handleFilterImportedLeads
  );
  router.post(
    '/gemini/filter-imported-leads',
    requireAuth,
    rateLimiter,
    handleFilterImportedLeads
  );

  return router;
}

export const apiRouter = createApiRouter();
