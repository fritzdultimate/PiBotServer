import mongoose from 'mongoose';

const ColemanSettingsSchema = new mongoose.Schema({
    funderMnemonic: String,
    botAddress: String,
    maxFlood: String,
    name: String,
    fee: String,
    sweep: Boolean,
    name: String
}, {
    timestamps: { createdAt: 'createdAt', updatedAt: 'lastUpdatedAt' }
});

export default mongoose.model('ColemanSettings', ColemanSettingsSchema);