import express from 'express';
import { BvpScrapEntry, BvpCoachEntry, BvpSurveyEntry, BvpMpEntry, BvpMonthlyManualEntry } from '../models/BvpScrap.js';
import { makeBvpApi } from '../utils/apiHelper.js';

const router = express.Router();

router.use('/bvpScrapEntries', makeBvpApi(BvpScrapEntry));
router.use('/bvpCoachEntries', makeBvpApi(BvpCoachEntry));
router.use('/bvpSurveyEntries', makeBvpApi(BvpSurveyEntry));
router.use('/bvpMpEntries', makeBvpApi(BvpMpEntry));
router.use('/bvpMonthlyManualEntries', makeBvpApi(BvpMonthlyManualEntry));

router.put('/bvpMonthlyManualEntries/:id', async (req, res) => {
  try {
    const record = await BvpMonthlyManualEntry.findOneAndUpdate(
      { id: req.params.id },
      { $set: { ...req.body, updatedAt: Date.now() } },
      { new: true, upsert: true }
    );
    const ret = record.toObject();
    delete ret._id; delete ret.__v;
    res.json(ret);
  } catch (err) {
    console.error('BvpMonthlyManual PUT error:', err);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

router.put('/bvpCoachEntries/:id', async (req, res) => {
  try {
    const record = await BvpCoachEntry.findOneAndUpdate(
      { id: req.params.id },
      { $set: { ...req.body, updatedAt: Date.now() } },
      { new: true, upsert: true }
    );
    if (!record) return res.status(404).json({ error: 'Entry not found' });
    const ret = record.toObject();
    delete ret._id; delete ret.__v;
    res.json(ret);
  } catch (err) {
    console.error('BvpCoach PUT error:', err);
    res.status(500).json({ error: 'Failed to update coach entry' });
  }
});

router.put('/bvpScrapEntries/:id', async (req, res) => {
  try {
    const record = await BvpScrapEntry.findOneAndUpdate(
      { id: req.params.id },
      { $set: { ...req.body, updatedAt: Date.now() } },
      { new: true }
    );
    if (!record) return res.status(404).json({ error: 'Entry not found' });
    const ret = record.toObject();
    delete ret._id; delete ret.__v;
    res.json(ret);
  } catch (err) {
    console.error('Scrap entry update error:', err);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

router.post('/bvp/batch-import', async (req, res) => {
  try {
    const {
      lot_wise_entries = [],
      monthly_summary_entries = [],
      replace_sessions = []
    } = req.body;

    let lotCount = 0, monthCount = 0;

    if (replace_sessions.length > 0) {
      for (const sess of replace_sessions) {
        await BvpScrapEntry.deleteMany({ session: sess, id: { $not: /^s_/ } });
        await BvpMonthlyManualEntry.deleteMany({ session: sess });
      }
    }

    if (lot_wise_entries.length > 0) {
      const ops = lot_wise_entries.map(entry => ({
        updateOne: {
          filter: { id: entry.id },
          update: { $set: { ...entry, updatedAt: Date.now() } },
          upsert: true
        }
      }));
      await BvpScrapEntry.bulkWrite(ops, { ordered: false });
      lotCount = lot_wise_entries.length;
    }

    if (monthly_summary_entries.length > 0) {
      const ops2 = monthly_summary_entries.map(entry => ({
        updateOne: {
          filter: { id: entry.id },
          update: { $set: { ...entry, updatedAt: Date.now() } },
          upsert: true
        }
      }));
      await BvpMonthlyManualEntry.bulkWrite(ops2, { ordered: false });
      monthCount = monthly_summary_entries.length;
    }

    res.json({ success: true, lotCount, monthCount });
  } catch (err) {
    console.error('Batch import error:', err);
    res.status(500).json({ error: 'Batch import failed', details: String(err) });
  }
});

router.delete('/bvp/session/:session', async (req, res) => {
  try {
    const sess = req.params.session;
    const scrapResult = await BvpScrapEntry.deleteMany({ session: sess, id: { $not: /^s_/ } });
    const monthResult = await BvpMonthlyManualEntry.deleteMany({ session: sess });
    res.json({ success: true, scrapDeleted: scrapResult.deletedCount, monthDeleted: monthResult.deletedCount });
  } catch (err) {
    console.error('Session delete error:', err);
    res.status(500).json({ error: 'Failed to delete session data', details: String(err) });
  }
});

router.get('/bvp/batches', async (req, res) => {
  try {
    const pipeline = [
      { $match: { id: { $not: /^s_/ } } },
      {
        $group: {
          _id: { session: '$session', batch_tag: { $ifNull: ['$batch_tag', '$session'] } },
          count: { $sum: 1 },
          totalWt: { $sum: { $ifNull: ['$wt_total', 0] } },
          totalAmt: { $sum: { $ifNull: ['$amount', 0] } },
          uploadedAt: { $max: '$updatedAt' }
        }
      },
      { $sort: { '_id.session': -1, 'uploadedAt': -1 } }
    ];
    const batches = await BvpScrapEntry.aggregate(pipeline);

    const monthPipeline = [
      { $group: { _id: '$session', count: { $sum: 1 }, uploadedAt: { $max: '$updatedAt' } } },
      { $sort: { '_id': -1 } }
    ];
    const monthBatches = await BvpMonthlyManualEntry.aggregate(monthPipeline);

    res.json({ scrapBatches: batches, monthBatches });
  } catch (err) {
    console.error('Batches fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

export default router;
