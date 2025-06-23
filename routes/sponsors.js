// routes/passphrases.js
import express from 'express';
import Sponsors from '../models/Sponsors.js';

const router = express.Router();

// POST /api/passphrases - Add a new passphrase
router.post('/', async (req, res) => {
    const { mnemonic, name } = req.body;

    if (!mnemonic) {
        return res.status(400).json({ error: 'mnemonic is required' });
    }

    if (!name) {
        return res.status(400).json({ error: 'Provide a name' });
    }

    try {
        const existing = await Sponsors.findOne({ mnemonic });

        if (existing) {
            return res.status(409).json({ message: 'Sponsor already exists' });
        }

        const saved = await Sponsors.create({ mnemonic, name });
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

// DELETE /api/passphrases/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Sponsors.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.json({ success: true, message: 'sponsor deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

export default router;
