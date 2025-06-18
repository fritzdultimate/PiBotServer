import bip39 from 'bip39';
import ed25519 from 'ed25519-hd-key';
import { Keypair, Server, TransactionBuilder, Networks, Operation, Asset } from 'stellar-base';

const HORIZON = 'https://api.mainnet.minepi.com';
const NETWORK_PASSPHRASE = 'Pi Network';


export function getKeypairFromPassphrase(mnemonic) {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const derived = ed25519.derivePath("m/44'/314159'/0'", seed);
    return Keypair.fromRawEd25519Seed(derived.key);
}

async function buildAndSubmitTx(passphrase, recipient, balanceId, amount) {
    const kp = getKeypairFromPassphrase(passphrase);
    const server = new Server(HORIZON);
    const account = await server.loadAccount(kp.publicKey());

    const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: NETWORK_PASSPHRASE,
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
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return res.data;
}