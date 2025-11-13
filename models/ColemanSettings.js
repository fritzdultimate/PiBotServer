import mongoose from 'mongoose';

const ColemanSettingsSchema = new mongoose.Schema({
    funderMnemonic: String,
    botAddress: String,
    sweepAddress: String,
    steal: Boolean,
    useAllSponsors: Boolean,
    maxFlood: String,
    activeSponsors: String,
    name: String,
    fee: String,
    sweep: Boolean,
    name: String,
    minSponsorBalance: String,
    password: String
}, {
    timestamps: { createdAt: 'createdAt', updatedAt: 'lastUpdatedAt' }
});

export default mongoose.model('ColemanSettings', ColemanSettingsSchema);