// backend/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { analyzeCode } from './services/llmClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.post('/analyze', async (req, res) => {
    try {
        const {
            code,
            language,
            skillLevel,
            provider,
            model,
        } = req.body || {};

        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid "code" in request body.' });
        }

        const result = await analyzeCode({
            code,
            language,
            skillLevel,
            provider,
            model,
        });

        res.json(result);
    } catch (err) {
        console.error('Error in /analyze:', err);
        res.status(500).json({
            error: 'Something went wrong while analyzing the code.',
        });
    }
});

app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
});
