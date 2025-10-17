// /root/PiBotServer/webhook.js
import express from 'express';
import { exec } from 'child_process';
import crypto from 'crypto';

const app = express();
app.use(express.json({ limit: '1mb' })); // protect against huge payloads

const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'change-me-to-a-strong-secret';

// helper to verify GitHub signature (sha256)
function verifySignature(req) {
  const sigHeader = req.get('x-hub-signature-256') || '';
  if (!sigHeader.startsWith('sha256=')) return false;
  const signature = sigHeader.slice(7);

  const payload = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(signature, 'hex'));
}

app.post('/webhook', (req, res) => {
  // quick handshake endpoint for test pings
  if (req.get('x-github-event') === 'ping') {
    console.log('📨 GitHub ping received');
    return res.status(200).json({ ok: true, msg: 'pong' });
  }

  if (!verifySignature(req)) {
    console.warn('⚠️ Webhook signature verification failed');
    return res.status(401).send('Invalid signature');
  }

  // You can restrict to specific events:
  const event = req.get('x-github-event') || 'unknown';
  console.log(`📨 Webhook event: ${event}`);

  // Optional: only run on pushes to main
  const payload = req.body || {};
  const ref = payload.ref || '';
  if (event === 'push' && ref !== 'refs/heads/main') {
    console.log(`Ignoring push to ${ref}`);
    return res.status(200).send('Ignored non-main push');
  }

  // Execute deploy script (async)
  exec('sh /root/PiBotServer/deploy.sh', { env: process.env, shell: '/bin/bash' }, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Deployment error:', stderr || error.message);
      return res.status(500).send('Deployment failed');
    }
    console.log('✅ Deployment success:', stdout);
    res.status(200).send('Deployed!');
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Webhook listener running on port ${PORT}`);
});
