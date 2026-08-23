import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import bcrypt from 'bcryptjs';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_123';

// Seed initial admin user if none exists
router.post('/seed', async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count === 0) {
      const admin = new User({ username: 'admin', password: 'admin123' });
      await admin.save();
      return res.json({ success: true, message: 'Default admin user seeded' });
    }
    res.json({ success: false, message: 'Users already exist' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to seed user' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
