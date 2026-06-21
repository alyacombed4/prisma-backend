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

        // Obtém a chave ou usa uma string temporária para não quebrar o servidor ao iniciar no Render
        const apiKey = process.env.GROQ_API_KEY2 || process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.error("ERRO: GROQ_API_KEY2 não configurada nas variáveis de ambiente.");
            return res.status(500).json({ error: "Chave de API não configurada no servidor." });
        }

        // Inicializa o cliente apenas na hora da requisição
        const openai = new OpenAI({
            baseURL: "https://api.groq.com/openai/v1",
            apiKey: apiKey,
        });

        const completion = await openai.chat.completions.create({
            model: "llama3-70b-8192",
            messages: [
                {
                    role: "system",
                    content: "Você é um resolvedor automático do Khan Academy. Responda apenas com o JSON solicitado."
                },
                {
                    role: "user",
                    content: `
                    Analise os dados deste Perseus Widget (questão do Khan Academy sem resposta):
                    ${itemDataAnswerless}

                    Resolva a questão e retorne obrigatoriamente apenas o objeto JSON no formato:
                    {
                      "khanmigo": {
                        "answer": {
                          "attemptContent": "string_da_resposta_correta",
                          "attemptState": {}, 
                          "userInput": {}
                        }
                      }
                    }
                    `
                }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const responseText = completion.choices[0].message.content.trim();
        const responseData = JSON.parse(responseText);

        res.json(responseData);
    } catch (error) {
        console.error("Erro no processamento:", error);
        res.status(500).json({ error: "Erro ao processar resposta com a IA." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});
