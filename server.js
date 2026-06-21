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

        let completion;
        
        // --- TENTATIVA 1: API Principal ---
        try {
            const apiKey1 = process.env.GROQ_API_KEY; // Sua chave principal
            if (!apiKey1) throw new Error("Chave 1 não configurada");

            const openai = new OpenAI({
                baseURL: "https://api.groq.com/openai/v1",
                apiKey: apiKey1,
            });

            console.log("Tentando API 1...");
            completion = await openai.chat.completions.create({
                model: "llama3-8b-8192", // Modelo atualizado e ativo
                messages: [
                    { role: "system", content: "Você é um assistente focado em formatação JSON." },
                    { role: "user", content: `Retorne um JSON baseado em: ${itemDataAnswerless}` }
                ],
                temperature: 0.1,
                response_format: { type: "json_object" }
            });

        } catch (errorApi1) {
            console.warn("API 1 falhou ou o modelo foi descontinuado. Erro:", errorApi1.message);
            
            // --- TENTATIVA 2: API de Backup (Fallback) ---
            const apiKey2 = process.env.GROQ_API_KEY2; // Sua chave secundária
            if (!apiKey2) {
                return res.status(500).json({ error: "API 1 falhou e a API 2 não está configurada." });
            }

            const openaiBackup = new OpenAI({
                baseURL: "https://api.groq.com/openai/v1",
                apiKey: apiKey2,
            });

            console.log("Tentando API 2 (Backup)...");
            completion = await openaiBackup.chat.completions.create({
                model: "llama-3.1-8b-instant", // Um modelo alternativo que esteja ativo
                messages: [
                    { role: "system", content: "Você é um assistente focado em formatação JSON." },
                    { role: "user", content: `Retorne um JSON baseado em: ${itemDataAnswerless}` }
                ],
                temperature: 0.1,
                response_format: { type: "json_object" }
            });
        }

        // Processa o resultado da API que funcionou
        const responseText = completion.choices[0].message.content.trim();
        const responseData = JSON.parse(responseText);

        res.json(responseData);

    } catch (error) {
        console.error("Erro crítico em ambas as APIs:", error);
        res.status(500).json({ error: "Erro ao processar a requisição com os provedores de IA." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});
