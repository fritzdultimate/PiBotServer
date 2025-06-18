import mongoose from 'mongoose';

const SponsorsSchema = new mongoose.Schema({
    mnemonic: String,
    lastChecked: Date,
    status: String, // idle, checking, claimed, sent, failed, etc.
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Sponsors', SponsorsSchema);