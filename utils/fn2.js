
import { Account, Asset, Memo, Operation, TransactionBuilder } from "stellar-sdk";
import { firstFilteredSponsors, getAccount, getKeypairFromPassphrase, getSDKKeypairFromPassphrase, getSpendableBalance, HORIZONS, submitTransaction } from "./fn.js";
import ColemanSettings from "../models/ColemanSettings.js";

function generateUniqueMemo(prefix = 'PiA') {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  const memoStr = `telegram:@fritzdecode:${prefix}/${time.toUpperCase()}/${rand.toUpperCase()}`.slice(0, 28);
  return Memo.text(memoStr);
}

export async function prebuildAndSignChannelTx(channelPhrase, mainKp, balanceId, recipient, amount, inx, name = null) {
    try {
        

        const channelKp = getSDKKeypairFromPassphrase(channelPhrase);
        const publicKey = channelKp.publicKey();

        // const spendable = await  getSpendableBalance(publicKey)
        const accountData = await getAccount(publicKey);
        const settings = await ColemanSettings.findOne({ name: 'coleman' });
        const customFee = name ? (settings.fee === 'Base Fee' ? 0.01 : settings.fee) : 0.05
        console.log(`Using Custom fee: ${customFee}`)

        const seq = (BigInt(accountData.sequence) + BigInt(inx)).toString();

        const channelAccount = new Account(publicKey, seq);

        const isInFirstFilteredArray = firstFilteredSponsors.includes(channelKp.publicKey());
        const fee = Math.ceil(customFee * 1e7).toString();
        console.log(`Stroops: ${fee}`)

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
        .addMemo(generateUniqueMemo(publicKey.slice(15, 22)))
        .setTimeout(180)
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
