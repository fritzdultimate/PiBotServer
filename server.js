import cors from 'cors';
import express from 'express';
import dotenv from 'dotenv';
import { connectToDB } from './db.js';
import passphraseRoutes from './routes/passphrases.js';
import sponsorRoutes from './routes/sponsors.js';
import { autoClaimUnlocked, autoDeleteWallet, autoFundWallet, autoFundWalletBeforeAndAfterClaim, autoSweepWallet, autoSweepWalletBeforeAndAfter, FloodchannelTransaction, getAccount, getClaimableBalance, sweepWallet } from './utils/fn.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Optional: basic security key to protect API
const AUTH_KEY = process.env.AUTH_KEY || 'secret-key';
const allowedOrigins = ['http://localhost:8888', 'https://piclaimer.netlify.app'];
app.use(express.json());
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            return callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// app.use((req, res, next) => {
//   const authHeader = req.headers.authorization;
//   const secretKey = 'hfhryeujhshbxhdsjjskaas';

//   if (!authHeader || authHeader !== `Bearer ${secretKey}`) {
//     return res.status(403).json({ error: 'Forbidden' });
//   }

//   next();
// });

await connectToDB();

app.use('/api/passphrases', passphraseRoutes);
app.use('/api/sponsors', sponsorRoutes);

// Ping route
app.get('/', (req, res) => {
  res.send('🔁 Pi Bot Server is running - Time: ' + new Date().toLocaleString());
});

app.post('/claimable-balance', async (req, res) => {
    const { publicKey } = req.body;
    if(!publicKey) {
        return res.status(400).json({error: "Valid public key is required"});
    }

    try {
        const claimable = await getClaimableBalance(publicKey);
        res.json({ success: true, claimable });
    } catch(err) {
        res.status(500).json({ error: err.response?.data || err.message });
    }
    
})

app.post('/get-account', async (req, res) => {
    const { publicKey } = req.body;

    try {
        const account = await getAccount(publicKey);
        res.json({ account });
    } catch(err) {
        res.status(500).json({ error: err.response?.data || err.message });
    }
    
})

app.post('/sweep', async (req, res) => {
    const { phrase, recipient } = req.body;
    if(!phrase) {
        return res.status(400).json({error: "Passphrase is required"});
    }

    if(!recipient) {
        return res.status(400).json({error: "Valid recipient is required"});
    }

    try {
        const {data, amount} = await sweepWallet(phrase, recipient);
        if(!data.hash) {
            res.json({ success: false, reason: "Failed", amount });
        } else {
            res.json({ success: true, reason: "success", hash: data.hash, amount });
        }
    } catch(err) {
        res.status(500).json({ error: err.response?.data || err.message });
    }
    
})

app.post('/claim-pi', async (req, res) => {
    const { passphrase, recipient, balanceId, amount } = req.body;
    if (!passphrase) {
        return res.status(404).json({ error: 'Passphrase is required' });
    }

    if (!amount) {
        return res.status(403).json({ error: 'amount is required' });
    }

    try {
        const txResult = await FloodchannelTransaction(passphrase, balanceId, recipient, amount);
        if(txResult) {
            const findSuccessfulTx = txResult.find(result => result.hash !== undefined);
            if(!findSuccessfulTx) {
                res.json({ success: false, reason: "Failed in ledger" });
            } else {
                res.json({ success: true, hash: findSuccessfulTx.hash, reason: "successful" })
            }
        } else {
            res.json({ success: true, reason: "Failed before ledger" });
        }
    } catch (error) {
        res.status(500).json({ error: error.response?.data || error.message });
    }
})

setInterval(autoClaimUnlocked, 100);
setInterval(autoSweepWallet, 18000000);
setInterval(autoSweepWalletBeforeAndAfter, 100);

setInterval(autoFundWallet, 40000000);
setInterval(autoFundWalletBeforeAndAfterClaim, 500);
setInterval(autoDeleteWallet, 10000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Pi Bot Server running on port ${PORT}`);
});
