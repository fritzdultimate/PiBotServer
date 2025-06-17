import Passphrase from './models/Passphrase.js';
import Log from './models/Log.js';
import { claimAndSend } from './pi_channel_bot.js'; // reuse your logic

export async function runBotLoop() {
  const all = await Passphrase.find({});
  for (const pass of all) {
    try {
      const result = await claimAndSend(pass.mnemonic);
      await Log.create({ mnemonic: pass.mnemonic, action: 'auto-claim', result: result.status });
    } catch (e) {
      await Log.create({ mnemonic: pass.mnemonic, action: 'auto-claim', result: 'error: ' + e.message });
    }
  }
}
