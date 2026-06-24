/**
 * PRISMA SCRIPTS™ - Backend Server
 * @author PRISMA
 * Servidor para resolver questões do Khan Academy usando Groq (Llama)
 */

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');
// Tenta .env na pasta atual, depois na pasta pai (raiz do projeto)
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
if (!process.env.GROQ_API_KEY) {
    require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
}

const app = express();

// ── CORS: aceita qualquer origem (necessário para o script rodar no navegador)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-prisma-key']
}));

app.use(express.json({ limit: '10mb' }));

// ── Health check
app.get('/', (req, res) => {
    res.json({ status: 'online', service: 'PRISMA Backend', version: '2.0.0' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// ── Rota principal: resolver questão
app.post('/answers', async (req, res) => {
    try {
        const { id, sha, itemDataAnswerless, exerciseId, ancestorIds } = req.body;

        if (!itemDataAnswerless) {
            return res.status(400).json({ error: 'Dados da questão ausentes.' });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.error('[PRISMA] ERRO: GROQ_API_KEY não configurada.');
            return res.status(500).json({ error: 'Chave de API não configurada no servidor.' });
        }

        const openai = new OpenAI({
            baseURL: 'https://api.groq.com/openai/v1',
            apiKey: apiKey,
        });

        console.log(`[PRISMA] Processando questão: id=${id}, sha=${sha}`);

        // Parse o itemDataAnswerless para extrair info útil
        let parsedItem = null;
        try {
            parsedItem = JSON.parse(itemDataAnswerless);
        } catch (e) {
            console.warn('[PRISMA] Não foi possível parsear itemDataAnswerless como JSON, enviando como string.');
        }

        const systemPrompt = `Você é um resolvedor especialista de questões do Khan Academy.

Sua tarefa:
1. Analise o JSON da questão fornecido em 'itemDataAnswerless'
2. Identifique qual é a resposta correta
3. Retorne OBRIGATORIAMENTE apenas um objeto JSON com esta estrutura exata:

{
  "khanmigo": {
    "answer": {
      "attemptContent": "<breve justificativa da resposta>",
      "attemptState": null,
      "userInput": {
        "choices": ["<texto exato da alternativa correta>"]
      }
    }
  }
}

REGRAS:
- Se for múltipla escolha, o campo "choices" deve conter o texto EXATO da alternativa correta
- Se for resposta numérica, coloque o valor em "choices" como string
- Se for expressão matemática, coloque a expressão em "choices"
- Nunca invente dados, analise o JSON cuidadosamente
- Responda SOMENTE com o JSON, sem texto adicional`;

        const userContent = parsedItem
            ? `Resolva esta questão do Khan Academy:\n\n${JSON.stringify(parsedItem, null, 2)}`
            : `Resolva esta questão do Khan Academy:\n\n${itemDataAnswerless}`;

        const completion = await openai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            temperature: 0.1,
            max_tokens: 1024,
            response_format: { type: 'json_object' }
        });

        const responseText = completion.choices[0].message.content.trim();
        console.log('[PRISMA] Resposta da IA:', responseText.substring(0, 200));

        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.error('[PRISMA] IA retornou JSON inválido:', responseText);
            return res.status(500).json({ error: 'IA retornou resposta inválida.' });
        }

        // Garante que a estrutura esperada existe
        if (!responseData?.khanmigo?.answer) {
            console.warn('[PRISMA] Estrutura inesperada, normalizando...');
            responseData = {
                khanmigo: {
                    answer: {
                        attemptContent: responseData?.attemptContent || 'Resposta processada pelo PRISMA',
                        attemptState: null,
                        userInput: responseData?.userInput || { choices: [] }
                    }
                }
            };
        }

        console.log('[PRISMA] ✅ Questão resolvida com sucesso!');
        res.json(responseData);

    } catch (error) {
        console.error('[PRISMA] Erro no backend:', error.message);

        if (error.status === 429) {
            return res.status(429).json({ error: 'Limite de requisições atingido. Tente novamente em alguns segundos.' });
        }
        if (error.status === 401) {
            return res.status(401).json({ error: 'Chave de API inválida ou expirada.' });
        }

        res.status(500).json({ error: 'Erro interno ao processar a questão.', detail: error.message });
    }
});

// ── Rota de fallback
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n💎 PRISMA Backend v2.0 rodando na porta ${PORT}\n`);
});
