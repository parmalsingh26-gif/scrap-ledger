import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Document, Folder } from '../models/Document.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
});

function detectFileType(mimetype) {
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'excel';
  if (mimetype.includes('word')) return 'word';
  if (mimetype.startsWith('text/')) return 'text';
  return 'other';
}

router.get('/folders', async (req, res) => {
  try {
    const folders = await Folder.find({}).sort({ name: 1 });
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

router.post('/folders', async (req, res) => {
  try {
    const { name, parent } = req.body;
    if (!name) return res.status(400).json({ error: 'Folder name is required' });

    const parentPath = parent || 'root';
    const path = parentPath === 'root' ? name : `${parentPath}/${name}`;

    const existing = await Folder.findOne({ path });
    if (existing) return res.status(400).json({ error: 'Folder already exists' });

    const folder = new Folder({ name, parent: parentPath, path });
    await folder.save();
    res.json(folder);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

router.delete('/folders/:path(*)', async (req, res) => {
  try {
    const folderPath = req.params.path;
    const docs = await Document.find({ folder: folderPath });
    for (const doc of docs) {
      await cloudinary.uploader.destroy(doc.cloudinaryPublicId, { resource_type: doc.resourceType });
    }
    await Document.deleteMany({ folder: folderPath });
    await Folder.deleteMany({ path: new RegExp(`^${folderPath}`) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

router.get('/documents', async (req, res) => {
  try {
    const { folder = 'root', search } = req.query;
    let query = { folder };
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    const docs = await Document.find(query).sort({ uploadedAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.post('/documents/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const { folder = 'root', tags = '' } = req.body;

    const fileType = detectFileType(req.file.mimetype);
    const isRaw = fileType !== 'image';

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    let dataURI = 'data:' + req.file.mimetype + ';base64,' + b64;

    const uploadResult = await cloudinary.uploader.upload(dataURI, {
      folder: 'scrapyard/' + (folder === 'root' ? 'root' : folder),
      resource_type: isRaw ? 'raw' : 'image',
      use_filename: true,
      unique_filename: true
    });

    const doc = new Document({
      name: req.file.originalname,
      folder,
      cloudinaryPublicId: uploadResult.public_id,
      url: uploadResult.secure_url,
      thumbnailUrl: !isRaw ? uploadResult.secure_url : null,
      type: fileType,
      resourceType: isRaw ? 'raw' : 'image',
      size: req.file.size,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean)
    });

    await doc.save();
    res.json(doc);
  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({ error: 'File upload failed' });
  }
});

router.delete('/documents/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    await cloudinary.uploader.destroy(doc.cloudinaryPublicId, { resource_type: doc.resourceType });
    await Document.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

router.post('/documents/download-url', async (req, res) => {
  try {
    const { publicId, resourceType } = req.body;
    if (!publicId) return res.status(400).json({ error: 'publicId is required' });

    const timestamp = Math.round((new Date).getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request({
      timestamp: timestamp,
    }, process.env.CLOUDINARY_API_SECRET);

    const downloadUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType || 'raw'}/download?public_id=${encodeURIComponent(publicId)}&timestamp=${timestamp}&signature=${signature}&api_key=${process.env.CLOUDINARY_API_KEY}`;

    res.json({ url: downloadUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

export default router;
