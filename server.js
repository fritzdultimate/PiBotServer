import cors from 'cors';
import express from 'express';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectToDB } from './db.js';
import passphraseRoutes from './routes/passphrases.js';
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
  res.send('🔁 Pi Bot Server is running');
});

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
