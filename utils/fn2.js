
import { Account, Asset, Memo, Operation, TransactionBuilder } from "stellar-sdk";
import { BUMP_FEE, getAccount, getBalance, getSDKKeypairFromPassphrase, HORIZONS, randomServer, sleep, submitTransaction } from "./fn.js";
import ColemanSettings from "../models/ColemanSettings.js";
import axios from "axios";
import Passphrase from "../models/Passphrase.js";

function generateUniqueMemo() {
    return Memo.text("tm:@fritzdecode");
}
function generatePiMemo(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let memo = '';
    for (let i = 0; i < length; i++) {
        memo += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return memo;
}

export async function prebuildAndSignChannelTx(channelPhrase, mainKp, balanceId, recipient, amount, inx, name = null) {
    try {
        

        const channelKp = getSDKKeypairFromPassphrase(channelPhrase);
        const publicKey = channelKp.publicKey();

        const accountData = await getAccount(publicKey);
        const settings = name ? await ColemanSettings.findOne({ name }) : await ColemanSettings.findOne({ name: 'whoami5677' });
        let customFee = settings.fee === 'Base Fee' ? 0.01 : settings.fee;


        const seq = (BigInt(accountData.sequence) + BigInt(inx)).toString();

        const channelAccount = new Account(publicKey, seq);

        const fee = Math.ceil(customFee * 1e7).toString();

        const txBuilder = new TransactionBuilder(channelAccount, {
            fee,
            networkPassphrase: 'Pi Network',
            withMuxing: true
        })
        .addOperation(Operation.claimClaimableBalance({
            balanceId,
            source: mainKp.publicKey(),
            withMuxing: true
        }))
        .addOperation(Operation.payment({
            destination: recipient,
            asset: Asset.native(),
            amount,
            source: mainKp.publicKey(),
            withMuxing: true
        }))
        .addMemo(Memo.text(generatePiMemo()))
        .setTimeout(140 + (inx * 5))
        .build();

        txBuilder.sign(mainKp);
        txBuilder.sign(channelKp);

        return txBuilder.toXDR();
    } catch (err) {
        console.error(`Error in prebuildAndSignChannelTx for channel ${channelPhrase.slice(0, 5)}...:`, err);
        return null;
    }
}

export async function prebuildAndSignClaimable(channelPhrase, mainKp, balanceId, inx, name = null, bumpfee = false) {
    try{
        const channelKp = getSDKKeypairFromPassphrase(channelPhrase);
        const publicKey = channelKp.publicKey();

        const accountData = await getAccount(publicKey);
        const settings = name ? await ColemanSettings.findOne({ name }) : await ColemanSettings.findOne({ name: 'whoami5677' });
        let customFee = settings.fee === 'Base Fee' ? 0.01 : settings.fee;
        customFee = customFee * 2;
        customFee = bumpfee ? BUMP_FEE : customFee;



        const seq = (BigInt(accountData.sequence) + BigInt(inx)).toString();

        const channelAccount = new Account(publicKey, seq);

        const fee = Math.ceil(customFee * 1e7).toString();

        const txBuilder = new TransactionBuilder(channelAccount, {
            fee,
            networkPassphrase: 'Pi Network',
            withMuxing: true
        })
        .addOperation(Operation.claimClaimableBalance({
            balanceId,
            source: mainKp.publicKey(),
            withMuxing: true
        }))
        .addMemo(Memo.text(generatePiMemo()))
        .setTimeout(140 + (inx * 5))
        .build();

        txBuilder.sign(mainKp);
        txBuilder.sign(channelKp);

        return txBuilder.toXDR();
    } catch (err) {
        console.error(`Error in prebuildAndSignClaimable for channel ${channelPhrase.slice(0, 5)}...:`, err);
        return null;
    }
}

export async function prebuildAnSignPayment(channelPhrase, mainKp, recipient, amount, inx, name = null, bumpfee = false) {
    try {
        

        const channelKp = getSDKKeypairFromPassphrase(channelPhrase);
        const publicKey = channelKp.publicKey();

        const accountData = await getAccount(publicKey);
        const settings = name ? await ColemanSettings.findOne({ name }) : await ColemanSettings.findOne({ name: 'whoami5677' });
        let customFee = settings.fee === 'Base Fee' ? 0.01 : settings.fee;
        customFee = customFee * 2;
        customFee = bumpfee ? BUMP_FEE : customFee;


        const seq = (BigInt(accountData.sequence) + BigInt(inx)).toString();

        const channelAccount = new Account(publicKey, seq);

        const fee = Math.ceil(customFee * 1e7).toString();

        const txBuilder = new TransactionBuilder(channelAccount, {
            fee,
            networkPassphrase: 'Pi Network',
            withMuxing: true
        })
        .addOperation(Operation.payment({
            destination: recipient,
            asset: Asset.native(),
            amount,
            source: mainKp.publicKey(),
            withMuxing: true
        }))
        .addMemo(Memo.text(generatePiMemo()))
        .setTimeout(140 + (inx * 5))
        .build();

        txBuilder.sign(mainKp);
        txBuilder.sign(channelKp);

        return txBuilder.toXDR();
    } catch (err) {
        console.error(`Error in prebuildAndSignChannelTx for channel ${channelPhrase.slice(0, 5)}...:`, err);
        return null;
    }
}


export async function FloodchannelTransaction(mainPhrase, balanceId, recipient, amount, sponsors) {
    const mainKp = getSDKKeypairFromPassphrase(mainPhrase);
    if(sponsors) {
        const result = await Promise.all(sponsors.map(async (sponsor, i) => {
            const server = HORIZONS[i % HORIZONS.length] || "https://api.mainnet.minepi.com";
            try {
                const data = await prebuildAndSignChannelTx(sponsor.mnemonic, mainKp, balanceId, recipient, amount);
                scheduleSubmission(data, server);
                return { success: true, channel: sponsor.name || `#${i}` };
            } catch (err) {
                console.error(`❌ Error on channel ${i}:`, err?.response?.data || err.message);
                return { success: false, channel: sponsor.name || `#${i}`, error: err.message };
            }
        }));

        return result;
    }
    return { success: false, error: "No sponsored accounts found"}
}

function scheduleSubmission({ xdr, hash, channel, submitAt }, server) {
	const delay = Math.max(0, submitAt - Date.now());

	setTimeout(async () => {
        try {
            const result = await submitTransaction(xdr, server);
            console.log(`✅ Submitted tx ${hash} via ${channel} on ${server}`, result);
        } catch (err) {
            console.error(`❌ Submission failed for tx ${hash} on ${server}:`, err?.response?.data || err.message);
        }
  }, delay);
}

export async function sweepToMuxedWallet(mainPhrase, recipient, useFeePayer = false) {

    try {
        const mainKp = getSDKKeypairFromPassphrase(mainPhrase);
        const accountData  = await getAccount(mainKp.publicKey());

        const seq = (BigInt(accountData.sequence)).toString();
        const account = new Account(mainKp.publicKey(), seq);
        const balanceString = getBalance(accountData);
        const baseFee = 100001;

        const balance = parseFloat(balanceString);
        const txCharge = 0.0100001;
        const baseReserve = 0.5 * (accountData?.num_sponsoring ?? 0);
        const minReserve = 0.98 + baseReserve;
        const epsilon = 1e-7;
        const raw = balance - minReserve - txCharge;
        const withdrawable = raw > epsilon ? raw : 0;

            if(withdrawable === 0) {
                return;
            }

            const tx = new TransactionBuilder(account, {
                fee: baseFee.toString(),
                networkPassphrase: 'Pi Network',
                withMuxing: true
            })
            .addOperation(Operation.payment({
                destination: recipient,
                asset: Asset.native(),
                amount: withdrawable.toFixed(7),
                withMuxing: true
            }))
            .addMemo(Memo.text("GOOOOOODx1222222222"))
            .setTimeout(20)
            .build();
            tx.sign(mainKp);

            try {
                const res = await axios.post(
                    `${randomServer()}/transactions`,
                    `tx=${encodeURIComponent(tx.toXDR())}`,
                    { 
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                    }
                );

                if(res.data.hash) {
                    console.log(`Sweeped ${withdrawable.toFixed(7)}`)
                    return {data: res.data, amount: withdrawable.toFixed(7)};
                }
            } catch (error) {
                return { error: error.message, amount: 0.000 };
            }
            
        
        
        return {data: { error: "No Pi sweeped" }, amount: 0.000};
    } catch(err) {
        console.log(err)
    }
}

export async function sweepXMinToClaimable() {
    if(global.sweepXMinToClaimable) return;
    global.sweepXMinToClaimable = true;
    const now = new Date();
    const futureMin = 0.8 * 60 * 1000;
    const gracePeriod = 30 * 60 * 1000;
    const xMinutesFrom = new Date(now.getTime() - gracePeriod);
    const minutesFromNow = new Date(now.getTime() + futureMin);
    const upcomingClaimables = await Passphrase.find({
        claimableAt: {
            $gte: xMinutesFrom,
            $lte: minutesFromNow
        },
        status: { $in: ['pending', 'failed'] },
        name: { $in: [null, undefined] }
    });
    const settings = await ColemanSettings.findOne({ name: 'whoami5677' });
    const SWEEP_ADDRESS = settings.sweepAddress;

    for(const claimable of upcomingClaimables) {
        await sweepToMuxedWallet(claimable.mnemonic, SWEEP_ADDRESS);
        await sleep(500);
    }
    global.sweepXMinToClaimable = false;
}
