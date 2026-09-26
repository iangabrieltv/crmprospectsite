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
    const { rawText, nicheName, defaultCity } = req.body;
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

    const prompt = `Você é um analista especialista em CRM de prospecção ativa de vendas de sites.
Analise a seguinte lista de contatos/empresas fornecida pelo usuário (que pode ser tabela copiada do Excel, CSV, Google Maps, bloco de notas, etc.).
Nicho/Segmento Alvo: ${nicheName || 'Geral'}
Cidade Padrão: ${defaultCity || 'Brasil'}

DADOS BRUTOS:
"""
${rawText.slice(0, 15000)}
"""

Extraia e padronize cada lead individualmente.
Regras obrigatórias:
1. "companyName": Nome limpo da empresa/profissional.
2. "phone": Telefone apenas com dígitos, formatado no padrão internacional do Brasil se for BR (ex: 5511999998888 ou 5521988887777). Se o usuário forneceu número sem o 55 mas com DDD de 2 dígitos, adicione 55.
3. "city": Cidade e Estado se detectados (ex: "São Paulo - SP"). Se não constar, use "${defaultCity || ''}".
4. "address": Endereço ou bairro se constar.
5. "googleRating": Nota média de avaliação (número decimal de 1.0 a 5.0) ou null se não constar.
6. "recommendedScript": Um dos três: "script1" (Método Simula/Mockup), "script2" (Diagnóstico Google/Site Ausente), ou "script3" (Cold Call Direta).
7. "opportunityAngle": Uma frase curta (máximo 12 palavras) com o melhor gancho de venda de site (ex: "Sem site no Google Maps", "Avaliação alta mas sem agendamento online", "Site atual não funciona no celular").

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
              phone: { type: Type.STRING },
              city: { type: Type.STRING },
              address: { type: Type.STRING },
              googleRating: { type: Type.NUMBER },
              recommendedScript: { type: Type.STRING },
              opportunityAngle: { type: Type.STRING },
            },
            required: ['companyName', 'phone'],
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
