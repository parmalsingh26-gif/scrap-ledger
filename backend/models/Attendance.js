import mongoose from 'mongoose';

// ========== Attendance Register Schema ==========
const AttendanceEmployeeSchema = new mongoose.Schema({
  id: String,
  sr: Number,
  name: String,
  pf: String,
  tno: String,
  category: String,
  workOrder: String,
  status: [String],
  tsOverride: mongoose.Schema.Types.Mixed // to allow manual TS overrides
}, { _id: false });

const AttendanceRegisterSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  month: { type: Number, required: true }, // 0-indexed (0=Jan, 6=Jul)
  employees: [AttendanceEmployeeSchema],
  updatedAt: { type: Date, default: Date.now },
});
AttendanceRegisterSchema.index({ year: 1, month: 1 }, { unique: true });
export const AttendanceRegister = mongoose.model('AttendanceRegister', AttendanceRegisterSchema);
