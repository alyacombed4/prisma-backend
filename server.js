/**
 * PRISMA SCRIPTS™ - Backend Server v3.0
 * Servidor para resolver questões do Khan Academy usando Groq (Llama)
 */

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');

// Carrega .env da pasta atual ou da raiz do projeto
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
if (!process.env.GROQ_API_KEY) {
    require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
}

const app = express();

// ── CORS: aceita qualquer origem (necessário para o userscript rodar no browser)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-prisma-key']
}));
app.use(express.json({ limit: '10mb' }));

// ── Health check
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'PRISMA Backend',
        version: '3.0.0',
        model: 'llama-3.3-70b-versatile',
        hasKey: !!process.env.GROQ_API_KEY
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Rota principal: resolver questão
app.post('/answers', async (req, res) => {
    const { id, sha, itemDataAnswerless, exerciseId, ancestorIds } = req.body;

    if (!itemDataAnswerless) {
        return res.status(400).json({ error: 'Campo itemDataAnswerless ausente no body.' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.error('[PRISMA] ERRO CRÍTICO: GROQ_API_KEY não está definida.');
        return res.status(500).json({ error: 'Chave de API não configurada no servidor.' });
    }

    const groq = new OpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: apiKey,
    });

    console.log(`\n[PRISMA] ──────────────────────────────`);
    console.log(`[PRISMA] Nova questão recebida`);
    console.log(`[PRISMA] id=${id} | sha=${sha}`);

    // Tenta parsear o itemDataAnswerless
    let parsedItem = null;
    try {
        parsedItem = JSON.parse(itemDataAnswerless);
    } catch (e) {
        console.warn('[PRISMA] itemDataAnswerless não é JSON válido, enviando como string bruta.');
    }

    const systemPrompt = `Você é um resolvedor especialista de questões do Khan Academy.

Sua tarefa:
1. Analise o JSON da questão fornecido (campo itemDataAnswerless)
2. Identifique a resposta correta com base no conteúdo, widgets e estrutura da questão
3. Retorne OBRIGATORIAMENTE apenas um objeto JSON com esta estrutura exata:

{
  "khanmigo": {
    "answer": {
      "attemptContent": "<breve justificativa da resposta em português>",
      "attemptState": null,
      "userInput": {
        "choices": ["<texto exato da alternativa correta>"]
      }
    }
  }
}

REGRAS IMPORTANTES:
- Para múltipla escolha: "choices" deve conter o texto EXATO de UMA alternativa correta
- Para resposta numérica: coloque o valor numérico em "choices" como string (ex: ["42"])
- Para expressão matemática: coloque a expressão LaTeX em "choices" (ex: ["x^2 + 3x"])
- Para verdadeiro/falso: coloque "Verdadeiro" ou "Falso"
- Nunca invente dados — analise o JSON cuidadosamente
- Se não tiver certeza, escolha a alternativa mais plausível matematicamente
- Responda SOMENTE com o JSON, sem texto, markdown ou explicações extras`;

    const userContent = parsedItem
        ? `Resolva esta questão do Khan Academy:\n\n${JSON.stringify(parsedItem, null, 2)}`
        : `Resolva esta questão do Khan Academy:\n\n${itemDataAnswerless}`;

    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            temperature: 0.05,
            max_tokens: 1024,
            response_format: { type: 'json_object' }
        });

        const rawText = completion.choices[0].message.content.trim();
        console.log('[PRISMA] Resposta bruta da IA:', rawText.substring(0, 300));

        let responseData;
        try {
            responseData = JSON.parse(rawText);
        } catch (e) {
            console.error('[PRISMA] ERRO: IA retornou JSON inválido:', rawText);
            return res.status(500).json({ error: 'IA retornou resposta em formato inválido.' });
        }

        // Normaliza a estrutura caso a IA não siga o formato exato
        if (!responseData?.khanmigo?.answer) {
            console.warn('[PRISMA] Estrutura fora do padrão, normalizando...');
            responseData = {
                khanmigo: {
                    answer: {
                        attemptContent: responseData?.attemptContent
                            || responseData?.answer?.attemptContent
                            || 'Resposta processada pelo PRISMA',
                        attemptState: null,
                        userInput: responseData?.userInput
                            || responseData?.answer?.userInput
                            || { choices: [] }
                    }
                }
            };
        }

        console.log('[PRISMA] ✅ Questão resolvida!');
        console.log('[PRISMA] Resposta:', JSON.stringify(responseData.khanmigo.answer.userInput));
        return res.json(responseData);

    } catch (error) {
        console.error('[PRISMA] Erro ao chamar Groq API:', error.message);

        if (error.status === 429) {
            return res.status(429).json({
                error: 'Limite de requisições da API atingido. Aguarde alguns segundos.'
            });
        }
        if (error.status === 401) {
            return res.status(401).json({
                error: 'GROQ_API_KEY inválida ou expirada. Verifique o arquivo .env'
            });
        }
        if (error.status === 413) {
            return res.status(413).json({
                error: 'Questão muito grande para processar.'
            });
        }

        return res.status(500).json({
            error: 'Erro interno ao processar a questão.',
            detail: error.message
        });
    }
});

// ── 404 fallback
app.use((req, res) => {
    res.status(404).json({ error: `Rota '${req.path}' não encontrada.` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n💎 PRISMA Backend v3.0 rodando em http://localhost:${PORT}`);
    console.log(`   GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ configurada' : '❌ NÃO ENCONTRADA'}`);
    console.log(`   Modelo: llama-3.3-70b-versatile\n`);
});
