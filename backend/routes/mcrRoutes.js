import express from 'express';
import { McrExtra, McrEdit } from '../models/Mcr.js';

const router = express.Router();

// GET all extras for a section
router.get('/:section/extras', async (req, res) => {
  try {
    const docs = await McrExtra.find({ section: req.params.section }, '-_id -__v').sort('createdAt');
    res.json(docs.map(d => ({ ...d.data, id: d.rowId, _isNew: true })));
  } catch (err) {
    console.error('MCR extras GET error:', err);
    res.status(500).json({ error: 'Failed to fetch MCR extras' });
  }
});

// POST — add or update an extra row
router.post('/:section/extras', async (req, res) => {
  try {
    const { rowId, data } = req.body;
    if (!rowId) return res.status(400).json({ error: 'rowId required' });
    await McrExtra.findOneAndUpdate(
      { section: req.params.section, rowId },
      { section: req.params.section, rowId, data, updatedAt: new Date() },
      { upsert: true, returnDocument: 'after' }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('MCR extras POST error:', err);
    res.status(500).json({ error: 'Failed to save MCR extra' });
  }
});

// DELETE an extra row
router.delete('/:section/extras/:rowId', async (req, res) => {
  try {
    await McrExtra.findOneAndDelete({ section: req.params.section, rowId: req.params.rowId });
    res.json({ success: true });
  } catch (err) {
    console.error('MCR extras DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete MCR extra' });
  }
});

// GET all edits for a section
router.get('/:section/edits', async (req, res) => {
  try {
    const docs = await McrEdit.find({ section: req.params.section }, '-_id -__v');
    // Return as { rowId: editData } map
    const result = {};
    docs.forEach(d => { result[d.rowId] = d.data; });
    res.json(result);
  } catch (err) {
    console.error('MCR edits GET error:', err);
    res.status(500).json({ error: 'Failed to fetch MCR edits' });
  }
});

// POST — save an edit for a base row
router.post('/:section/edits', async (req, res) => {
  try {
    const { rowId, data } = req.body;
    if (!rowId) return res.status(400).json({ error: 'rowId required' });
    await McrEdit.findOneAndUpdate(
      { section: req.params.section, rowId },
      { section: req.params.section, rowId, data, updatedAt: new Date() },
      { upsert: true, returnDocument: 'after' }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('MCR edits POST error:', err);
    res.status(500).json({ error: 'Failed to save MCR edit' });
  }
});

// DELETE an edit (revert to original)
router.delete('/:section/edits/:rowId', async (req, res) => {
  try {
    await McrEdit.findOneAndDelete({ section: req.params.section, rowId: req.params.rowId });
    res.json({ success: true });
  } catch (err) {
    console.error('MCR edits DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete MCR edit' });
  }
});

// POST — Bulk migrate localStorage data to MongoDB
router.post('/migrate', async (req, res) => {
  try {
    const { sections } = req.body;
    let totalExtras = 0, totalEdits = 0;
    
    for (const [section, sectionData] of Object.entries(sections || {})) {
      const { extras = [], edits = {} } = sectionData;
      
      if (extras.length > 0) {
        const extraOps = extras.map(row => ({
          updateOne: {
            filter: { section, rowId: row.id },
            update: { $set: { section, rowId: row.id, data: row, updatedAt: new Date() } },
            upsert: true
          }
        }));
        await McrExtra.bulkWrite(extraOps, { ordered: false });
        totalExtras += extras.length;
      }
      
      const editEntries = Object.entries(edits);
      if (editEntries.length > 0) {
        const editOps = editEntries.map(([rowId, data]) => ({
          updateOne: {
            filter: { section, rowId },
            update: { $set: { section, rowId, data, updatedAt: new Date() } },
            upsert: true
          }
        }));
        await McrEdit.bulkWrite(editOps, { ordered: false });
        totalEdits += editEntries.length;
      }
    }
    
    res.json({ success: true, totalExtras, totalEdits });
  } catch (err) {
    console.error('MCR migrate error:', err);
    res.status(500).json({ error: 'Migration failed', details: String(err) });
  }
});

export default router;
