import express from 'express';
import { exec } from 'child_process';

const app = express();
app.use(express.json());

const PORT = 9000;

app.post('/webhook', (req, res) => {
    console.log('📨 Webhook received:', req.body);

    exec('sh /root/PiBotServer/deploy.sh', (error, stdout, stderr) => {
        if (error) {
        console.error('❌ Deployment error:', stderr);
        return res.status(500).send('Deployment failed');
        }

        console.log('✅ Deployment success:', stdout);
        res.status(200).send('Deployed!');
    });
});

app.listen(PORT, () => {
  console.log(`🚀 Webhook listener is running on port ${PORT}`);
});
