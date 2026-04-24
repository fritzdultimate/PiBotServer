import express from 'express';
import dotenv from 'dotenv';
import { connectToDB } from './db.js';
import { arrayBatches, autoSweepSponsor, fundWallet, getAccount, getBalance, getKeypairFromPassphrase, sleep, sweepWallet } from './utils/fn.js';
import Passphrase from './models/Passphrase.js';
import Sponsors from './models/Sponsors.js';
import ColemanSettings from './models/ColemanSettings.js';
import { autoPrepareForClaiming, autoSubmitXDR } from './autoClaimer.js';
dotenv.config();


const app = express();
const PORT = 3001;
app.set('trust proxy', 1);
app.use(express.json());
await connectToDB();

const settings = await ColemanSettings.findOne({ name: 'coleman' });
const MIN_SPONSOR_BALANCE = Number(settings.minSponsorBalance) || 0.1;
const BOT_PHRASE = settings.funderMnemonic;
const MAIN_ADDRESS = settings.botAddress;
const activeSponsors = Number(settings.activeSponsors) || 50;
const sweepActivated = settings.sweep;


// const instanceId = process.env.S_INSTANCE_ID || 0;
const sponsors = await Sponsors.find({ name: 'coleman' });
// const chunkSize = Math.floor(sponsors.length/2);

setInterval(() => autoPrepareForClaiming('coleman', MAIN_ADDRESS, activeSponsors), 1000);
setInterval(() => autoSubmitXDR('coleman'), 100);


async function getUpcomingClaimables(start = 0) {
    const now = new Date();
    const tenMin = 20 * 60 * 1000;
    const x = start * 60 * 1000;
    const xMinutesFrom = new Date(now.getTime() - x);
    const tenMinutesFromNow = new Date(now.getTime() + tenMin);
    const upcomingClaimables = await Passphrase.find({
        claimableAt: {
            $gte: xMinutesFrom,
            $lte: tenMinutesFromNow
        },
        status: 'pending',
        // name: 'coleman'
    });

    return upcomingClaimables;
}

const kp = getKeypairFromPassphrase(settings.funderMnemonic);

// setInterval(() => autoSweepSponsor('coleman', kp.publicKey()), 1000);


// Auto Fund
setInterval(async() => {

        const upcomingClaimables = await getUpcomingClaimables(0.5);
        if (!upcomingClaimables.length) return;
        if(global.isFunding) return;
        global.isFunding = true;
    
        const usingSponsors = sponsors.slice(0, activeSponsors)
        console.log(`Coleman is funding`);
    
        for (const p of usingSponsors) {
            try {
    
    
                const sponsorKp = getKeypairFromPassphrase(p.mnemonic);
                const accountData  = await getAccount(sponsorKp.publicKey());
    
                const balanceString = getBalance(accountData);
                const balance = parseFloat(balanceString) - 0.98;
    
                const change = balance - MIN_SPONSOR_BALANCE;
    
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
                        console.log(`✅ coleman funded ${result.amount} Pi. Hash: ${success.hash}`);
                        
                    } else {
                        // console.log(`❌ Shepherd Failed to fund ${result.amount} PI}`);
                    }
                } else {
                    if(botBalance < Math.abs(change)) {
                        console.log(`Skipping, reason funder insufficeian, funder: ${botBalance} Pi`)
                    }
                    if(change >= 0) {
                        console.log(`Skipping, sponsor is enough, sponsor: ${balance} Pi`)
                    }
                }
                await sleep(5000);
    
            } catch (err) {
                // console.error('❌ Error funding Pi:', err.message || err);
            }
        }
        global.isFunding = false;
}, 1000);

// Auto Sweep
setInterval(async() => {
    if(!sweepActivated) return;
    if(global.isSweeping) return;
    global.isSweeping = true
    const upcomingClaimables = await getUpcomingClaimables();
    if (upcomingClaimables.length > 0) {
        for(const claimable of upcomingClaimables) {
            if(claimable.name !== 'coleman') continue;
            await sweepWallet(claimable.mnemonic, MAIN_ADDRESS);
            await sleep(1000);
        }
    } else {
        const readyPassphrases = await Passphrase.find({ name: 'coleman' });
        const passphraseBatches = arrayBatches(readyPassphrases, 80);
    
        for(const passphrases of passphraseBatches) {
            await Promise.all(passphrases.map(async (phrase, i) => {
                try {
                    const r = await sweepWallet(phrase.mnemonic, MAIN_ADDRESS);
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
    }
    global.isSweeping = false;
}, 1000);


app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Pi Bot Server running on port ${PORT}`);
}); 


