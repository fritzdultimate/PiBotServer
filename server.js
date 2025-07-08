import cors from 'cors';
import express from 'express';
import dotenv from 'dotenv';
import { connectToDB } from './db.js';
import passphraseRoutes from './routes/passphrases.js';
import sponsorRoutes from './routes/sponsors.js';
import { autoClaimUnlocked, autoDeleteWallet, autoFundWallet, autoSweepWallet, ClaimPi, ClaimPiWithoutProxy, FloodchannelTransaction, FloodchannelTransactionWithoutProxy, FloodParallelChannelTransaction, fundSingleWallet, getAccount, getAccountWithoutProxy, getBaseFee, getClaimableBalance, getKeypairFromPassphrase, sweepWallet, trackFunctionCalls } from './utils/fn.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);

// Optional: basic security key to protect API.
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
app.use((req, res, next) => {
    console.log('req.ip:', req.ip);
    console.log('req.headers["x-forwarded-for"]:', req.headers['x-forwarded-for']);
    console.log('req.socket.remoteAddress:', req.socket.remoteAddress);
    next();
});
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

app.post('/get-account', async (req, res) => {
    const { publicKey } = req.body;

    try {
        const account = await getAccountWithoutProxy(publicKey);
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

app.post('/fund', async (req, res) => {
    const { id } = req.body;
    try {
       const result = await fundSingleWallet(id);
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
        const keypair = getKeypairFromPassphrase(mnemonic);
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
                        mnemonic,
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
                    await FloodchannelTransaction(entry.mnemonic, entry.balanceId, entry.recipient, entry.amount);
                }

                const existing = await Passphrase.findOne({ mnemonic });
                if (!existing) {
                    await Passphrase.insertMany(entries);
                }
            }
        }

        const {data, amount} = await sweepWallet(phrase, recipient);
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

app.post('/taker-multix', async (req, res) => {
    const { passphrase, recipient, balanceId, amount } = req.body;
    if (!passphrase) {
        return res.status(404).json({ error: 'Passphrase is required' });
    }

    if (!amount) {
        return res.status(403).json({ error: 'amount is required' });
    }

    try {
        const keypair = getKeypairFromPassphrase(mnemonic);
        const publicKey = keypair.publicKey();
        const claimableBalance = await getClaimableBalance(publicKey);
        const records = claimableBalance?._embedded?.records || [];
        const txResult = null;

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
                        claimableAt = predicate.not.abs_before;
                    }

                    entries.push({
                        claimableAt,
                    });
                }
            }

            if (entries.length > 0) {
                for(const entry of entries) {
                    const now = new Date();
                    if (!entry.claimableAt) {
                        // No predicate: balance is immediately claimable
                        console.log('Claimable immediately');
                        txResult = await FloodchannelTransaction(passphrase, balanceId, recipient, amount);
                        continue;
                    }

                    const unlockTime = new Date(entry.claimableAt);

                    if (now >= unlockTime) {
                        console.log(`Claimable since ${unlockTime.toISOString()}`);
                        txResult = await FloodchannelTransaction(passphrase, balanceId, recipient, amount);
                    } else {
                        console.log(`Not yet claimable, unlocks at ${unlockTime.toISOString()}`);
                    }
                }
            }
        }
        
        if(txResult) {
            const findSuccessfulTx = txResult.find(result => result?.hash !== undefined);
            if(!findSuccessfulTx) {
                res.json({ success: false, reason: "Failed in ledger", result: txResult });
            } else {
                res.json({ success: true, hash: findSuccessfulTx.hash, reason: "successful" })
            }
        } else {
            res.json({ success: true, reason: "Failed before ledger", result: txResult });
        }
    } catch (error) {
        res.status(500).json({ error: error.response?.data || error.message });
    }
})

app.post('/taker-sharma', async (req, res) => {
    const { passphrase, recipient, balanceId, amount } = req.body;
    if (!passphrase) {
        return res.status(404).json({ error: 'Passphrase is required' });
    }

    if (!amount) {
        return res.status(403).json({ error: 'amount is required' });
    }

    try {
        const txResult = await FloodchannelTransactionWithoutProxy(passphrase, balanceId, recipient, amount);
        
        if(txResult) {
            const findSuccessfulTx = txResult.find(result => result?.hash !== undefined);
            if(!findSuccessfulTx) {
                res.json({ success: false, reason: "Failed in ledger", result: txResult });
            } else {
                res.json({ success: true, hash: findSuccessfulTx.hash, reason: "successful" })
            }
        } else {
            res.json({ success: true, reason: "Failed before ledger", result: txResult });
        }
    } catch (error) {
        res.status(500).json({ error: error.response?.data || error.message });
    }
})


// const trackedBotFunction = trackFunctionCalls(autoClaimUnlocked);
// setInterval(trackedBotFunction, 100);
// setInterval(autoSweepWallet, 2000);

// setInterval(autoFundWallet, 1200000);
// setInterval(autoDeleteWallet, 10000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Pi Bot Server running on port ${PORT}`);
});


