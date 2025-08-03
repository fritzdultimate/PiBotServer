import { connectToDB } from "./db.js";
import Passphrase from "./models/Passphrase.js";
import Sponsors from "./models/Sponsors.js";
import { firstFilteredSponsors, getKeypairFromPassphrase, HORIZONS, PI_PUBLIC_ADDRESS, submitTransaction } from "./utils/fn.js";
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
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    pendingXDRs[time] = []
    let retries = 0;
    while(retries < MAX_FLOOD_COUNT) {
        console.log(`Storing xdrs ${retries + 1 } times`)
        const xdrs = [];
        for(const s of sponsors) {
            const xdr = await prebuildAndSignChannelTx(s.mnemonic, mainKp, balanceId, recipient, amount);
            xdrs.push(xdr);
        }
        retries++;
        pendingXDRs[time].push(xdrs);
    }
    console.log(`XDRS: ${pendingXDRs[time]}`)
}

// [
//     'time' => [[], []]
// ]

export async function autoPrepareForClaiming() {
    console.log(`autoPrepare is running`)
    console.log(`XDRS: ${pendingXDRs}`)
    const now = new Date();
    const aMinuteFromNow = new Date(now.getTime() + (8 * 1000 * 60));

    const readyPassphrases = await Passphrase.find({
        claimableAt: { $lte: aMinuteFromNow },
        status: 'pending',
        name: { $in: [null, undefined] }
    });
    if(!readyPassphrases.length) return;

    for(const p of readyPassphrases) {
        const timeKey = new Date(p.claimableAt).toISOString();
        if(!pendingXDRs.hasOwnProperty(timeKey)) {
            console.log(`Using key: ${timeKey}`);
            await getXDRsReady(p.mnemonic, p.balanceId, PI_PUBLIC_ADDRESS, p.amount, timeKey);
        }
    }
}

export async function autoSubmitXDR() {
    if(global.isSubmittingTx) return;
    global.isSubmittingTx = true;
    for (const key in pendingXDRs) {
        console.log(`Claiming for ${key}`);
        const now = new Date();
        const claimableAt = new Date(key);
        console.log(`Difference in sec ${now-claimableAt}`);
        if(now - claimableAt > 6000) continue;
        const xdrGroup = pendingXDRs[key];

        for(const xdrs of xdrGroup) {
            const result = await Promise.allSettled(xdrs.map(async (xdr, i) => {
                const server = HORIZONS[i % HORIZONS.length] || "https://api.mainnet.minepi.com";
                try {
                    const result = await submitTransaction(xdr.xdr, server);
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
setInterval(autoSubmitXDR, 100);