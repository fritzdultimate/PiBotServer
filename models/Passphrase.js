import mongoose from 'mongoose';

const PassphraseSchema = new mongoose.Schema({
    mnemonic: String,
    lastChecked: Date,
    status: String, // idle, checking, claimed, sent, failed, etc.
    createdAt: { type: Date, default: Date.now },
    receiverAddress: String,
    claimableAt: Date,
    balanceId: String,
    amount: String
});

export default mongoose.model('Passphrase', PassphraseSchema);