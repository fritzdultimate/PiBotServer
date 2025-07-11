import Passphrase from "../models/Passphrase.js";
import Sponsors from "../models/Sponsors.js";
import { getClaimableBalance } from "./fn.js";

export async function storeLockedPi(mnemonic, derivedPublicKey, receiverAddress) {
    const existing = await Passphrase.findOne({ mnemonic });
    if (existing) {
        return {success: false, message: 'Passphrase already exists' };
    }

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
                    claimableAt = predicate.not.abs_before; // this means claimable *after* that time
                }

                entries.push({
                    mnemonic,
                    receiverAddress,
                    claimableAt,
                    balanceId: record.id,
                    amount: record.amount,
                });
            }
        }

        if (entries.length > 0) {
            await Passphrase.insertMany(entries);
            return {success: true, message: 'Passphrase and balances saved' };
        }

        await Passphrase.create({ mnemonic, receiverAddress });
        return {success: true, message: 'No locked coin found.' };
    }

    await Passphrase.create({ mnemonic, receiverAddress });
    return {success: false, message: 'No locked coin found.' };
}

export async function storeSponsor(mnemonic, name) {
    const existing = await Sponsors.findOne({ mnemonic });
    
        if (existing) {
            return { success: false, message: 'Sponsor already exists' };
        }

        const saved = await Sponsors.create({ mnemonic, name });
        return { success: true, message: 'Sponsor saved' };
}