import mongoose from 'mongoose';

// ========== MCR View — MongoDB Models ==========
// Stores extra (new) rows added by user
const McrExtraSchema = new mongoose.Schema({
  section: { type: String, required: true, enum: ['lot', 'coach', 'wta', 'mp'] },
  rowId:   { type: String, required: true }, // client-side generated uid
  data:    { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
McrExtraSchema.index({ section: 1, rowId: 1 }, { unique: true });
export const McrExtra = mongoose.model('McrExtra', McrExtraSchema);

// Stores edits made to base JSON rows
const McrEditSchema = new mongoose.Schema({
  section: { type: String, required: true, enum: ['lot', 'coach', 'wta', 'mp'] },
  rowId:   { type: String, required: true }, // original row id from JSON
  data:    { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
McrEditSchema.index({ section: 1, rowId: 1 }, { unique: true });
export const McrEdit = mongoose.model('McrEdit', McrEditSchema);
