// routes/Log.js
import express from 'express';
import Log from '../models/Log.js';

const router = express.Router();

// DELETE /api/passphrases/:id
router.delete('/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const deleted = await Log.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.json({ success: true, message: 'log deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Delete failed' });
    }
});


export default router;
