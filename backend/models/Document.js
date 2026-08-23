import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  folder: { type: String, default: 'root' }, // folder path e.g. "Lots/2026/July"
  cloudinaryPublicId: { type: String, required: true },
  url: { type: String, required: true },
  thumbnailUrl: { type: String },
  resourceType: { type: String, default: 'raw' }, // 'image' or 'raw' — for signed URL generation
  type: { type: String, enum: ['pdf', 'image', 'excel', 'word', 'text', 'other'], default: 'other' },
  size: { type: Number, default: 0 }, // bytes
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: String, default: 'User' },
  tags: [String]
});
export const Document = mongoose.model('Document', DocumentSchema);

const FolderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  path: { type: String, required: true, unique: true }, // full path e.g. "Lots/2026/July"
  parent: { type: String, default: 'root' }, // parent folder path
  createdAt: { type: Date, default: Date.now }
});
export const Folder = mongoose.model('Folder', FolderSchema);
