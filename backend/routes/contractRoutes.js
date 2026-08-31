import express from 'express';
import { Contract } from '../models/Contract.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const contracts = await Contract.find({}, '-_id -__v').sort({ createdAt: 1 });
    res.json(contracts);
  } catch (err) {
    console.error('Contracts GET error:', err);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data.id) return res.status(400).json({ error: 'id is required' });
    const record = await Contract.findOneAndUpdate(
      { id: data.id },
      { $set: data },
      { returnDocument: 'after', upsert: true }
    );
    const ret = record.toObject();
    delete ret._id; delete ret.__v;
    res.json(ret);
  } catch (err) {
    console.error('Contracts POST error:', err);
    res.status(500).json({ error: 'Failed to save contract' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const record = await Contract.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { returnDocument: 'after', upsert: true }
    );
    const ret = record.toObject();
    delete ret._id; delete ret.__v;
    res.json(ret);
  } catch (err) {
    console.error('Contracts PUT error:', err);
    res.status(500).json({ error: 'Failed to update contract' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Contract.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error('Contracts DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete contract' });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { contracts = [] } = req.body;
    if (!contracts.length) return res.json({ success: true, count: 0 });
    const ops = contracts.map(c => ({
      updateOne: {
        filter: { id: c.id },
        update: { $set: c },
        upsert: true
      }
    }));
    await Contract.bulkWrite(ops, { ordered: false });
    res.json({ success: true, count: contracts.length });
  } catch (err) {
    console.error('Contracts batch error:', err);
    res.status(500).json({ error: 'Batch upsert failed' });
  }
});

export default router;
