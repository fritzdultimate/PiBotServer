import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import bip39 from 'bip39';
import ed25519 from 'ed25519-hd-key';
import { Keypair, TransactionBuilder, Operation, Asset, Account, MuxedAccount   } from 'stellar-base';
import Sponsors from '../models/Sponsors.js';

const HORIZON = 'https://api.mainnet.minepi.com';
const NETWORK_PASSPHRASE = 'Pi Network';


export function getKeypairFromPassphrase(mnemonic) {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const derived = ed25519.derivePath("m/44'/314159'/0'", seed);
    return Keypair.fromRawEd25519Seed(derived.key);
}

export async function getAccount(publicKey) {
    const sessionId = Math.random().toString(36).substring(2, 10);
    const proxy = `http://customer-fritz_52wU3-cc-US-session-${sessionId}:Justonlymefritz+22565@pr.oxylabs.io:7777`;
    const agent = new HttpsProxyAgent(proxy);

    try {
        const response = await axios.get(
            `${HORIZON}/accounts/${publicKey}`,
            {
                headers: { 'Content-Type': 'application/json' },
                httpsAgent: agent,
            }
        );
        return response.data;
    } catch(err) {
        console.error(`❌ Failed to fetch account [${publicKey}]:`, err.response?.data || err.message);
        throw err;
    }
}

export async function buildAndSubmitTx(passphrase, recipient, balanceId, amount) {
    const sessionId = Math.random().toString(36).substring(2, 10);
    const proxy = `http://customer-fritz_52wU3-cc-US-session-${sessionId}:Justonlymefritz+22565@pr.oxylabs.io:7777`;
    const agent = new HttpsProxyAgent(proxy);

    const kp = getKeypairFromPassphrase(passphrase);
    const accountData  = await getAccount(kp.publicKey());
    const account = new Account(kp.publicKey(), accountData.sequence);

    const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: NETWORK_PASSPHRASE,
        // extraSigners
    })
        .addOperation(Operation.claimClaimableBalance({ balanceId }))
        .addOperation(Operation.payment({
        destination: recipient,
        asset: Asset.native(),
        amount,
        }))
        .setTimeout(30)
        .build();

    tx.sign(kp);

    const res = await axios.post(
        `${HORIZON}/transactions`,
        `tx=${encodeURIComponent(tx.toXDR())}`,
        { 
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            httpsAgent: agent,
        }
    );

    return res.data;
}

export async function buildChannelTx(channelPhrase, mainKp, balanceId, recipient, amount) {
    const channelKp = getKeypairFromPassphrase(channelPhrase);
    const accountData  = await getAccount(channelKp.publicKey());
    const channelAccount = new Account(channelKp.publicKey(), accountData.sequence);

	const tx = new TransactionBuilder(channelAccount, {
		fee: '100000',
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
    .setTimeout(30)
    .build();

  	tx.sign(mainKp);
  	tx.sign(channelKp);

  	return tx.toXDR();
}

export async function submitTransaction(txXdr) {
    try {
        const sessionId = Math.random().toString(36).substring(2, 10);
        const proxy = `http://customer-fritz_52wU3-cc-US-session-${sessionId}:Justonlymefritz+22565@pr.oxylabs.io:7777`;
        const agent = new HttpsProxyAgent(proxy);

        const res = await axios.post(
            `${HORIZON}/transactions`,
            `tx=${encodeURIComponent(txXdr)}`,
            { 
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                httpsAgent: agent,
            }
        );

        return res.data;
    } catch (err) {
        console.log('❌ Client error submitting TX:', err);
        return { success: false, error: err.response?.data || err.message}
    }
}

export async function getClaimableBalance(publicKey) {
        const sessionId = Math.random().toString(36).substring(2, 10);
        const proxy = `http://customer-fritz_52wU3-cc-US-session-${sessionId}:Justonlymefritz+22565@pr.oxylabs.io:7777`;
        const agent = new HttpsProxyAgent(proxy);

        const res = await axios.get(
            `${HORIZON}/claimable_balances?claimant=${publicKey}`,
            { 
                headers: { 'Content-Type': 'application/json' },
                httpsAgent: agent,
            }
        );
}

export async function FloodchannelTransaction(mainPhrase, balanceId, recipient, amount) {
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    const allSponsors = await Sponsors.find();
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


const FEE_CACHE_TTL = 10_000;

let cachedFee= null;
let lastFeeFetchTime = 0;
async function getBaseFee() {
    const sessionId = Math.random().toString(36).substring(2, 10);
    const proxy = `http://customer-fritz_52wU3-cc-US-session-${sessionId}:Justonlymefritz+22565@pr.oxylabs.io:7777`;
    const agent = new HttpsProxyAgent(proxy);

    const now = Date.now();
    if (cachedFee && (now - lastFeeFetchTime < FEE_CACHE_TTL)) {
        return cachedFee;
    }

    try {
        const response = await axios.get(`${HORIZON}/fee_stats`, 
            {
                headers: { 'Content-Type': 'application/json' },
                httpsAgent: agent,
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