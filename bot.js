import TelegramBot from "node-telegram-bot-api";
const token = '8144700718:AAH5n9nbQXvwjMtNUqk_Qpp24V3vCLNv5io';

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Welcome to PiBot! Type /help to see commands.");
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