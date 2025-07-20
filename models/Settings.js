import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
    funderMnemonic: String,
    mainAddress: String,
    maxFlood: String,
    name: String,
}, {
    timestamps: { createdAt: 'createdAt', updatedAt: 'lastUpdatedAt' }
});

export default mongoose.model('Settings', SettingsSchema);