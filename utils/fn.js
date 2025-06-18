import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import bip39 from 'bip39';
import ed25519 from 'ed25519-hd-key';
import { Keypair, Server, TransactionBuilder, Networks, Operation, Asset, Account, MuxedAccount   } from 'stellar-base';

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
    const kp = getKeypairFromPassphrase(passphrase);
    const server = new Server(HORIZON);
    // const account = await server.loadAccount(kp.publicKey());
    const accountData  = await getAccount(kp.publicKey());
    const account = new Account(publicKey, accountData.sequence);
    const muxedRecipient = new MuxedAccount(recipient, BigInt(123456));

    const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: NETWORK_PASSPHRASE,
        // extraSigners
    })
        .addOperation(Operation.claimClaimableBalance({ balanceId }))
        .addOperation(Operation.payment({
        destination: muxedRecipient,
        asset: Asset.native(),
        amount,
        }))
        .setTimeout(30)
        .build();

    tx.sign(kp);

    const res = await axios.post(
        `${HORIZON}/transactions`,
        `tx=${encodeURIComponent(tx.toXDR())}`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return res.data;
}