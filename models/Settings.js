import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
    funderMnemonic: String,
    mainAddress: String,
    createdAt: { type: Date, default: Date.now },
    maxFlood: String,
    name: String
});

export default mongoose.model('Settings', SettingsSchema);