import mongoose from 'mongoose';

const ContractSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true }, // client-side uid
  type: { type: String, enum: ['equipment', 'manpower'], required: true },
  status: { type: String, default: 'active' },
  name: String,
  firm: String,
  loaNo: String,
  loaDate: String,
  natureOfWork: String,
  unit: String,
  timeMode: String,
  sanctionedQty: Number,
  vehicles: [String],
  months: { type: mongoose.Schema.Types.Mixed, default: [] },
}, { timestamps: true });
export const Contract = mongoose.model('Contract', ContractSchema);
