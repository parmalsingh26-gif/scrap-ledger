import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

// Import Routes
import authRoutes from './backend/routes/authRoutes.js';
import baseDataRoutes from './backend/routes/baseDataRoutes.js';
import inventoryRoutes from './backend/routes/inventoryRoutes.js';
import bvpScrapRoutes from './backend/routes/bvpScrapRoutes.js';
import contractRoutes from './backend/routes/contractRoutes.js';
import documentRoutes from './backend/routes/documentRoutes.js';
import systemRoutes from './backend/routes/systemRoutes.js';
import mcrRoutes from './backend/routes/mcrRoutes.js';
import attendanceRoutes from './backend/routes/attendanceRoutes.js';
import { User } from './backend/models/User.js';

import { authMiddleware } from './backend/middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env: .env.local for local dev, system env vars for Render/production
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' }); // fallback for production if needed

// ========== Cloudinary Config ==========
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const app = express();
app.use(cors());
// Increase payload limit for backups
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ========== Database Connection ==========
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/scrapyard';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    // Auto-seed admin user if none exist
    const count = await User.countDocuments();
    if (count === 0) {
      const admin = new User({ username: 'admin', password: 'admin123' });
      await admin.save();
      console.log('Seeded default admin user');
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// ========== Register Routes ==========
app.use('/api/auth', authRoutes);

// Apply auth middleware to all subsequent /api routes
app.use('/api', authMiddleware);

app.use('/api', baseDataRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', bvpScrapRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api', documentRoutes);
app.use('/api', systemRoutes);
app.use('/api/mcr', mcrRoutes);
app.use('/api/attendance', attendanceRoutes);

// ========== Serve Static Frontend (Production) ==========
// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ========== Server Listen ==========
const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
