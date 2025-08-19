// routes/sponsors.js
import express from 'express';
import Sponsors from '../models/Sponsors.js';
import { getAccount, getKeypairFromPassphrase } from '../utils/fn.js';

const router = express.Router();

// POST /api/sponsors - Add a new passphrase
router.post('/', async (req, res) => {
    const { mnemonic, name } = req.body;

    if (!mnemonic) {
        return res.status(400).json({success: false, error: 'mnemonic is required' });
    }

    if (!name) {
        return res.status(400).json({success: false, error: 'Provide a name' });
    }

    try {
        const existing = await Sponsors.findOne({ mnemonic, name });

        if (existing) {
            return res.status(409).json({ success: false,  error: 'Sponsor already exists' });
        }

        const kp = getKeypairFromPassphrase(mnemonic);
        const publicKey = kp.publicKey();
        const accountData = await getAccount(publicKey);
        if(!accountData) {
            return res.status(409).json({success: false, error: "Invalid passphrase uploaded as sponsor"})
        }

        await Sponsors.create({ mnemonic, name });
        res.status(201).json({success: true, feedback: 'Sponsor uploaded'});
    } catch (err) {
        console.error('Error saving passphrase:', err);
        res.status(500).json({success: false, error: `Failed to save passphrase: ${mnemonic.slice(0,15)}....${mnemonic.slice(-15)}` });
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


router.post('/list', async (req, res) => {
    const { name } = req.body;

    try {
        if(name === '*.') {
            const sponsors = await Sponsors.find();
            res.json(sponsors);
        } else {
            const sponsors = await Sponsors.find({ name });
            res.json(sponsors);
        }
    } catch (err) {
        console.error('Error fetching sponsors:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
