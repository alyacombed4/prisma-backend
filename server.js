const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/answers', async (req, res) => {
    try {
        const { id, sha, itemDataAnswerless } = req.body;

        if (!itemDataAnswerless) {
            return res.status(400).json({ error: "Dados da questão ausentes." });
        }

        // Obtém a chave principal das variáveis de ambiente
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.error("ERRO: GROQ_API_KEY não configurada nas variáveis de ambiente do Render.");
            return res.status(500).json({ error: "Chave de API não configurada no servidor." });
        }

        // Inicializa o cliente apontando corretamente para o baseURL da Groq
        const openai = new OpenAI({
            baseURL: "https://api.groq.com/openai/v1",
            apiKey: apiKey,
        });

        console.log("Enviando requisição para o modelo llama-3.3-70b-versatile...");

        const completion = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `Você é um resolvedor especialista em Khan Academy. 
Analise a estrutura técnica JSON fornecida em 'itemDataAnswerless', descubra qual é a alternativa correta ou a resposta da questão e retorne OBRIGATORIAMENTE um objeto JSON exatamente com a seguinte estrutura:

{
  "khanmigo": {
    "answer": {
      "attemptContent": "Escreva aqui uma breve justificativa da resposta",
      "attemptState": null,
      "userInput": {
        "choices": ["Texto exato da alternativa correta ou valor numérico"]
      }
    }
  }
}`
                },
                {
                    role: "user",
                    content: `Aqui estão os dados estruturais da questão para você analisar e resolver: ${itemDataAnswerless}`
                }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const responseText = completion.choices[0].message.content.trim();
        const responseData = JSON.parse(responseText);

        // Retorna o JSON processado com sucesso para o seu script do navegador
        res.json(responseData);

    } catch (error) {
        console.error("Erro no processamento do backend:", error.message);
        res.status(500).json({ error: "Erro interno ao processar requisição com a IA." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Prisma rodando com sucesso na porta ${PORT}`);
});
