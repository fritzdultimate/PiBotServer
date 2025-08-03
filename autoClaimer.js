import { connectToDB } from "./db.js";
import Passphrase from "./models/Passphrase.js";
import Sponsors from "./models/Sponsors.js";
import { firstFilteredSponsors, getKeypairFromPassphrase, getSDKKeypairFromPassphrase, HORIZONS, PI_PUBLIC_ADDRESS, submitTransaction } from "./utils/fn.js";
import { prebuildAndSignChannelTx } from "./utils/fn2.js";

await connectToDB();
const pendingXDRs = {};
const rawSponsors = await Sponsors.find();

const sponsors = [];
const MAX_FLOOD_COUNT = 2;
    
for (const sponsor of rawSponsors) {
    const kp = getKeypairFromPassphrase(sponsor.mnemonic);
    const pubKey = kp.publicKey();

    if (firstFilteredSponsors.includes(pubKey)) {
        sponsors.push(sponsor);
    }
}

async function getXDRsReady(mainPhrase, balanceId, recipient, amount, time) {
    const mainKp = getSDKKeypairFromPassphrase(mainPhrase);
    pendingXDRs[time] = [];
    let retries = 0;

    try {
        while (retries < MAX_FLOOD_COUNT) {
            retries++;
            console.log(`Storing xdrs ${retries} times`);
            const xdrs = [];

            for (const s of sponsors) {
                try {
                    const xdr = await prebuildAndSignChannelTx(s.mnemonic, mainKp, balanceId, recipient, amount);
                    console.log(`Prebuilt and Presigned xdr: ${xdr}`);
                    xdrs.push(xdr);
                } catch (innerErr) {
                    console.error(`Error building XDR from sponsor ${s.name || s.mnemonic.slice(0, 5)}:`, innerErr);
                }
            }

            pendingXDRs[time].push(xdrs);
        }

        console.log(`XDRS:`, pendingXDRs[time]);
        console.log(`XDRS Length:`, pendingXDRs[time][0].length);
    } catch (err) {
        console.error(`Error in getXDRsReady:`, err);
    }
}


// [
//     'time' => [[], []]
// ]

export async function autoPrepareForClaiming() {
    if(global.isPreparing) return;
    global.isPreparing = true;
    
    console.log(`autoPrepare is running`)
    console.log(`XDRS: ${JSON.stringify(pendingXDRs)}`)
    console.log(`XDRS Keys: ${JSON.stringify(Object.keys(pendingXDRs))}`);

    const now = new Date();
    const aMinuteFromNow = new Date(now.getTime() + (10 * 1000 * 60));

    const readyPassphrases = await Passphrase.find({
        claimableAt: { $lte: aMinuteFromNow },
        status: 'pending',
        name: { $in: [null, undefined] }
    });
    if(readyPassphrases.length) {
        for(const p of readyPassphrases) {
            const timeKey = new Date(p.claimableAt).toISOString();
            console.log(`Using key: ${timeKey}`);
            console.log(`Key exist: ${pendingXDRs.hasOwnProperty(timeKey)}`);
            if(!pendingXDRs.hasOwnProperty(timeKey)) {
                await getXDRsReady(p.mnemonic, p.balanceId, PI_PUBLIC_ADDRESS, p.amount, timeKey);
            }
        }
    };

    
    global.isPreparing = false;
}

export async function autoSubmitXDR() {
    if(global.isSubmittingTx) return;
    global.isSubmittingTx = true;
    for (const key in pendingXDRs) {
        console.log(`Claiming for ${key}`);
        const now = new Date();
        const claimableAt = new Date(key);
        console.log(`Difference in sec ${now-claimableAt}`);
        if((now - claimableAt) >= -6000) continue;
        const xdrGroup = pendingXDRs[key];

        for(const xdrs of xdrGroup) {
            const result = await Promise.allSettled(xdrs.map(async (xdr, i) => {
                const server = HORIZONS[i % HORIZONS.length] || "https://api.mainnet.minepi.com";
                try {
                    const result = await submitTransaction(xdr, server);
                    console.log(`✅ Submitted on ${server}`, result);
                } catch (err) {
                    console.error(`❌ Submit error on ${server}:`, err?.response?.data || err.message);
                }
            }));
            console.log(result)
        }
        delete pendingXDRs[key];
    }
    global.isSubmittingTx = false;
}

setInterval(autoPrepareForClaiming, 1000);
// setInterval(autoSubmitXDR, 100);