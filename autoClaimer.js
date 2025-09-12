import { connectToDB } from "./db.js";
import Log from "./models/Log.js";
import Passphrase from "./models/Passphrase.js";
import Sponsors from "./models/Sponsors.js";
import { firstFilteredSponsors, getAccount, getBalance, getKeypairFromPassphrase, getSDKKeypairFromPassphrase, HORIZONS, PI_PUBLIC_ADDRESS, PI_PUBLIC_MUXED_ADDRESS, sleep, submitTransaction } from "./utils/fn.js";
import { prebuildAndSignChannelTx } from "./utils/fn2.js";
import { getRandomAddress } from "./utils/helper.js";


await connectToDB();
const pendingXDRs = {};
const rawSponsors = await Sponsors.find();

const sponsors = [];
const MAX_FLOOD_COUNT = 2;
let CURRENT_KEY = null;
    
for (const sponsor of rawSponsors) {
    const kp = getKeypairFromPassphrase(sponsor.mnemonic);
    const pubKey = kp.publicKey();

    if (firstFilteredSponsors.includes(pubKey)) {
        sponsors.push(sponsor);
    }
}

async function getXDRsReady(mainPhrase, balanceId, recipient, amount, time, name, sponsorsCount) {
    CURRENT_KEY = time;
    const mainKp = getSDKKeypairFromPassphrase(mainPhrase);
    pendingXDRs[time] = [];
    let retries = 0;

    try {
        await Log.create({ mnemonic: mainPhrase, action: `Building & Signing Tx for ${amount} PI`, result: 'default', name: name });
        while (retries < MAX_FLOOD_COUNT) {
            const xdrs = [];
            let usingSponsors = name ? await Sponsors.find({ name: name }) : sponsors;
            usingSponsors = name ? usingSponsors.slice(0, sponsorsCount) : usingSponsors;
            for (const s of usingSponsors) {
                const r = name ? recipient : getRandomAddress()
                // const r = recipient;
                try {
                    const kp = getSDKKeypairFromPassphrase(s.mnemonic);
                    const accountData  = await getAccount(kp.publicKey());
                    const balanceString = getBalance(accountData);
                    const balance = parseFloat(balanceString) - 0.98;
                    if(balance < 0.08) continue;
                    // Change amount
                    // const mutatedAmount = name ? (Number(amount) + 0.01).toString() : amount;
                    const xdr = await prebuildAndSignChannelTx(s.mnemonic, mainKp, balanceId, r, amount, retries, name);
                    xdrs.push({xdr, balanceId});
                } catch (innerErr) {
                    console.error(`Error building XDR from sponsor ${s.name || s.mnemonic.slice(0, 5)}:`, innerErr);
                }
            }
            retries++;
            pendingXDRs[time].push(xdrs);
            await sleep(5000)
        }
        console.log(`The below is the pending xdr`);
        console.log(pendingXDRs)

    } catch (err) {
        console.error(`Error in getXDRsReady:`, err);
    }
}

export async function autoPrepareForClaiming(name, address, sponsorsCount) {
    if(global.isPreparing) return;
    global.isPreparing = true;
    
    try {
        console.log(`autoPrepare is running for ${name ? name : 'Main'}`)

        const now = new Date();
        const min = (2 * 1000 * 60)
        const aMinuteFromNow = new Date(now.getTime() + min);

        const readyPassphrases = await Passphrase.find({
            claimableAt: { $lte: aMinuteFromNow },
            status: 'pending',
            name: name ? name : { $in: [null, undefined] }
        });

        if(readyPassphrases.length) {
            const receiverAddress = address ? address : PI_PUBLIC_ADDRESS;
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
        // if(name) {
        //     await sleep(100)
        // }
        if((now - claimableAt) <= -200) continue;
        const xdrGroup = pendingXDRs[key]; // [[], []]

        let success = false;
        let balanceId = null;

        for(const xdrs of xdrGroup) {
            const result = await Promise.all(xdrs.map(async (xdr, i) => {
                let server = HORIZONS[i % HORIZONS.length] || "https://api.mainnet.minepi.com";
                server = name ? HORIZONS[0] : server;
                console.log(server);
                try {
                    const result = await submitTransaction(xdr.xdr, server);
                    balanceId = xdr.balanceId;
                    console.log(result)
                    return result;

                } catch (err) {
                    console.error(`❌ Submit error on ${server}:`, err?.response?.data || err.message);
                }
            }));
            const found = result.find((r) => r.hash);
            if (found) {
                await Log.create({ mnemonic: 'Direct above', action: `✅ Claimed Pi. Hash: ${found.hash}`, result: 'success', name: name })
                // console.log(`✅ Claimed Pi. Hash: ${found.hash}`);
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
            await Log.create({ mnemonic: 'Direct above', action: `❌ Claiming failed`, result: 'error', name: name })
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
    const threeMinutesAgo = new Date(now.getTime() - 0.5 * 60 * 1000);

    await Passphrase.updateMany(
        { claimableAt: { $lt: threeMinutesAgo }, status: 'pending' },
        { $set: { status: 'failed' } }
    );
}