const express = require('express');
    const cors = require('cors');
    const OpenAI = require('openai');
    require('dotenv').config();

    const app = express();
    app.use(cors());
    app.use(express.json());

    // Inicializa a API da Groq utilizando a sua chave e biblioteca OpenAI
    const api2Key = process.env.GROQ_API_KEY2 || process.env.GROQ_API_KEY;
    const openai = new OpenAI({
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: api2Key,
    });

    // Modelo Llama da Groq (ex: llama3-70b-8192 ou o modelo que você preferir usar da Llama 3)
    const LLAMA_MODEL = "llama3-70b-8192";

    app.post('/answers', async (req, res) => {
        try {
            const { id, sha, itemDataAnswerless } = req.body;

            if (!itemDataAnswerless) {
                return res.status(400).json({ error: "Dados da questão ausentes." });
            }

            // Criando a chamada de chat para a Llama resolver a questão
            const completion = await openai.chat.completions.create({
                model: LLAMA_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "Você é um assistente especializado em resolver e preencher respostas do Khan Academy no formato JSON estruturado."
                    },
                    {
                        role: "user",
                        content: `
                        Analise os dados deste Perseus Widget (questão do Khan Academy sem resposta):
                        ${itemDataAnswerless}

                        Resolva a questão corretamente.
                        Retorne obrigatoriamente apenas o objeto JSON abaixo, sem formatações em markdown ou
  explicações de texto adicionais:
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
                temperature: 0.1, // Temperatura baixa para respostas mais exatas
                response_format: { type: "json_object" } // Garante que o retorno seja um JSON válido
            });

            const responseText = completion.choices[0].message.content.trim();
            const responseData = JSON.parse(responseText);

            res.json(responseData);
        } catch (error) {
            console.error("Erro no servidor Prisma:", error);
            res.status(500).json({ error: "Erro interno ao processar resposta da IA." });
        }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Servidor Prisma rodando na porta ${PORT} conectado à Groq (Llama)`);
    });