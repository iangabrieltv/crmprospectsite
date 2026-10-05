import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProd = process.env.NODE_ENV === 'production';
// In dev mode in AI Studio environment, the dev server must run on port 3000
const PORT = !isProd ? 3000 : (Number(process.env.PORT) || 3000);

app.use(express.json({ limit: '10mb' }));

// Shared server-side Gemini client with 'aistudio-build' user-agent
const getGeminiClient = () => {
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

// API: AI Lead Extraction & Cleaning
app.post('/api/gemini/analyze-leads', async (req, res) => {
  try {
    const { rawText, nicheName, nicheSegment, defaultCity } = req.body;
    if (!rawText || typeof rawText !== 'string') {
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
2. "contactName": Nome do profissional/responsável (ex: "Dr. Marcelo", "Dra. Camila", "Carlos") se constar ou null.
3. "phone": Telefone apenas com dígitos, formatado no padrão internacional do Brasil se for BR (ex: 5511999998888 ou 5521988887777). Se o usuário forneceu número sem o 55 mas com DDD de 2 dígitos, adicione 55.
4. "category": Categoria / Atividade do negócio (ex: "Nutricionista", "Clínica de Nutrição", "Academia", "Loja de Suplementos", "Crossfit", "Dentista", "Escritório de Advocacia", etc.).
5. "isNicheMatch": BOOLEAN. Avalie com extremo rigor se a categoria faz sentido com o nicho alvo (${nicheName}).
   - Exemplo clássico: se o nicho for Nutricionista / Nutrição, categorias como "Academia", "Loja de Suplementos", "Crossfit", "Farmácia", "Restaurante" NÃO fazem sentido com o nicho de consultórios de nutricionistas (retorne isNicheMatch: false).
   - Se for do nicho (ex: Nutricionista, Nutrologia, Clínica de Nutrição e Emagrecimento), retorne isNicheMatch: true.
6. "mismatchReason": Se isNicheMatch for false, descreva de forma concisa e clara o motivo (ex: "Academia não faz sentido no nicho de nutricionistas", "Loja de suplementos é comércio, fora de atendimento nutricional"). Se for do nicho, retorne null.
7. "googleMapsUrl": Se houver link do Google Meu Negócio, Google Maps (maps.google.com, goo.gl/maps, g.page, etc.) ou se não houver, gere um link de busca do Maps: "https://www.google.com/maps/search/?api=1&query=" com o nome da empresa e cidade codificados.
8. "websiteUrl": Link do site atual ou rede social se constar no texto/planilha, ou null.
9. "city": Cidade e Estado se detectados (ex: "São Paulo - SP", "Arapiraca - AL"). Se não constar, use "${defaultCity || ''}".
10. "address": Endereço ou bairro se constar.
11. "googleRating": Nota média de avaliação (número decimal de 1.0 a 5.0) ou null se não constar.
12. "recommendedScript": Um dos três: "script1" (Método Simula/Mockup), "script2" (Diagnóstico Google/Site Ausente), ou "script3" (Cold Call Direta).
13. "opportunityAngle": Uma frase curta (máximo 12 palavras) com o melhor gancho de venda de site (ex: "Sem site no Google Maps", "Avaliação alta mas sem agendamento online", "Site atual não funciona no celular").

Retorne a lista em formato JSON estrito conforme o schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
  } catch (error: any) {
    console.error('Error analyzing leads with Gemini:', error);
    res.status(500).json({ error: error.message || 'Falha ao analisar dados com IA' });
  }
});

// API: Generate Tailored Pitch for a Lead
app.post('/api/gemini/generate-pitch', async (req, res) => {
  try {
    const { companyName, niche, city, googleRating, objection, scriptType } = req.body;
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
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({ pitch: response.text?.trim() || '' });
  } catch (error: any) {
    console.error('Error generating pitch:', error);
    res.status(500).json({ error: error.message || 'Falha ao gerar pitch com IA' });
  }
});

// API: Improve / Polish a sales script block
app.post('/api/gemini/improve-script', async (req, res) => {
  try {
    const { currentMessage, instruction, nicheName, blockTitle } = req.body;
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
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({ improvedMessage: response.text?.trim() || currentMessage });
  } catch (error: any) {
    console.error('Error improving script with Gemini:', error);
    res.status(500).json({ error: error.message || 'Falha ao melhorar script' });
  }
});

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
