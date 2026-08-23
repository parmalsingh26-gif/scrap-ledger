import express from 'express';
import { AttendanceRegister } from '../models/Attendance.js';

const router = express.Router();

// GET — fetch attendance employees for a given year & month
router.get('/:year/:month', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const doc = await AttendanceRegister.findOne({ year, month });
    res.json(doc ? doc.employees : []);
  } catch (err) {
    console.error('Attendance GET error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance data' });
  }
});

// PUT — upsert (save/update) attendance employees for a given year & month
router.put('/:year/:month', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const { employees } = req.body;
    if (!Array.isArray(employees)) return res.status(400).json({ error: 'employees array required' });
    await AttendanceRegister.findOneAndUpdate(
      { year, month },
      { year, month, employees, updatedAt: new Date() },
      { upsert: true, returnDocument: 'after' }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Attendance PUT error:', err);
    res.status(500).json({ error: 'Failed to save attendance data' });
  }
});

export default router;
