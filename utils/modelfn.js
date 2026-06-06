import Passphrase from "../models/Passphrase.js";
import Settings from "../models/Settings.js";
import Sponsors from "../models/Sponsors.js";
import { getClaimableBalance } from "./fn.js";

export async function storeLockedPi(mnemonic, derivedPublicKey, receiverAddress, local = false, name = null, owner = null) {
    // const existing = await Passphrase.findOne({ mnemonic });
    // if (existing) {
    //     return {success: false, message: 'Passphrase already exists' };
    // }

    const claimableBalance = await getClaimableBalance(derivedPublicKey);

    const records = claimableBalance?._embedded?.records || [];
    
    if (records.length > 0) {
        const entries = [];

        for (const record of records) {
            const claimant = record.claimants.find(
                (c) => c.destination === derivedPublicKey
            );

            if (claimant) {
                const predicate = claimant.predicate;
                let claimableAt = null;

                if (predicate?.not?.abs_before) {
                    claimableAt = new Date(predicate.not.abs_before); // this means claimable *after* that time
                } else if(predicate.unconditional) {
                    const now = new Date();
                    const tenMin = 10 * 60 * 1000;
                    claimableAt = new Date(now.getTime() + tenMin);
                }

                const isClaimablePassed = claimableAt && new Date() > claimableAt;

                if(isClaimablePassed) {
                    const now = new Date();
                    const tenMin = 10 * 60 * 1000;
                    claimableAt = new Date(now.getTime() + tenMin);
                }

                const existing = await Passphrase.findOne({ mnemonic, balanceId: record.id, name });
                if (existing) {
                    continue;
                }

                entries.push({
                    mnemonic,
                    receiverAddress,
                    claimableAt,
                    balanceId: record.id,
                    amount: record.amount,
                    name,
                    owner
                });
            }
        }

        if (entries.length > 0) {
            await Passphrase.insertMany(entries);
            return {success: true, message: 'Passphrase and balances saved' };
        }
    }
    if(!local) {
        const existing = await Passphrase.findOne({ mnemonic, name });
        if (existing) {
            return {success: false, message: 'No locked coin found.' };
        }

        await Passphrase.create({ mnemonic, receiverAddress, name });
        return {success: false, message: 'No locked coin found, or already uploaded.' };
    }
}

export async function storeSponsor(mnemonic, name = 'whoami5677') {
    const existing = await Sponsors.findOne({ mnemonic });
    
        if (existing) {
            if(existing.name === 'whoami5677' && name !== 'whoami5677') {
                existing.name = name;
                await existing.save();
                return { success: true, message: 'Sponsor saved' };
            }
            return { success: false, message: 'Sponsor already exists' };
        }

        const saved = await Sponsors.create({ mnemonic, name });
        return { success: true, message: 'Sponsor saved' };
}

export const upsertSettings = async (newSettings) => {
    const updatedSettings = await Settings.findOneAndUpdate(
        {},
        { $set: newSettings },
        {
            new: true,
            upsert: true
        }
    );

    return updatedSettings;
};
