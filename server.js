import cors from 'cors';
import express from 'express';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import { connectToDB } from './db.js';
import passphraseRoutes from './routes/passphrases.js';
import { buildAndSubmitTx } from './utils/fn.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Optional: basic security key to protect API
const AUTH_KEY = process.env.AUTH_KEY || 'secret-key';

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:8888',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
await connectToDB();

app.use('/api/passphrases', passphraseRoutes);

// Ping route
app.get('/', (req, res) => {
  res.send('🔁 Pi Bot Server is running - let me test this though!');
});

app.post('/claim-pi', async (req, res) => {
    const { passphrase, recipient, balanceId, amount } = req.body;
    if (!passphrase) {
        return res.status(404).json({ error: 'Passphrase is required' });
    }

    if (!amount) {
        return res.status(403).json({ error: 'amount is required' });
    }

    try {
        const txResult = await buildAndSubmitTx(passphrase, recipient, balanceId, amount);
        res.json({ success: true, tx: txResult });
    } catch (error) {
        res.status(500).json({ error: error.response?.data || error.message });
    }
})

// Trigger bot
app.post('/run-bot', (req, res) => {
  const { key } = req.body;

  if (key !== AUTH_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  exec('node pi_channel_bot.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Bot error: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
    if (stderr) {
      console.error(`⚠️ Bot stderr: ${stderr}`);
    }
    console.log(`✅ Bot stdout: ${stdout}`);
    res.json({ status: 'Bot executed', output: stdout });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Pi Bot Server running on port ${PORT}`);
});
