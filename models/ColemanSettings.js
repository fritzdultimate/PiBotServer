import mongoose from 'mongoose';

const ColemanSettingsSchema = new mongoose.Schema({
    funderMnemonic: String,
    botAddress: String,
    maxFlood: String,
    activeSponsors: String,
    name: String,
    fee: String,
    sweep: Boolean,
    name: String,
    minSponsorBalance: String
}, {
    timestamps: { createdAt: 'createdAt', updatedAt: 'lastUpdatedAt' }
});

export default mongoose.model('ColemanSettings', ColemanSettingsSchema);