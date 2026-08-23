import mongoose from 'mongoose';

const BvpScrapEntrySchema = new mongoose.Schema({
  id: { type: String, unique: true },
  session: String,
  date_from: String,
  date_to: String,
  type: String,
  desc: String,
  qty_nos: mongoose.Schema.Types.Mixed,
  qty_sets: mongoose.Schema.Types.Mixed,
  wt_wta: Number,
  wt_tb: Number,
  wt_ms: Number,
  wt_nf: Number,
  wt_other: Number,
  wt_total: Number,
  lot: String,
  party: String,
  rate: Number,
  amount: Number,
  remarks: String
});
export const BvpScrapEntry = mongoose.model('BvpScrapEntry', BvpScrapEntrySchema);

const BvpCoachEntrySchema = new mongoose.Schema({
  id: { type: String, unique: true },
  session: String,
  sr: mongoose.Schema.Types.Mixed,
  coach_no: String,
  code: String,
  cat: String,
  age: String,
  cond_by: String,
  tare: mongoose.Schema.Types.Mixed,
  seats: mongoose.Schema.Types.Mixed,
  berths: mongoose.Schema.Types.Mixed,
  cost: mongoose.Schema.Types.Mixed,
  rso: String,
  rso_date: String,
  offer_date: String,
  auc1: String,
  auc2: String,
  sale_order: String,
  sale_date: String,
  purchaser: String,
  del_from: String,
  del_to: String,
  sale_amt: mongoose.Schema.Types.Mixed,
  status: String,
  remarks: String
});
export const BvpCoachEntry = mongoose.model('BvpCoachEntry', BvpCoachEntrySchema);

const BvpSurveyEntrySchema = new mongoose.Schema({
  id: { type: String, unique: true },
  session: String,
  lot: String,
  location: String,
  desc: String,
  qty: Number,
  unit: String,
  wt: Number,
  offer_date: String,
  bid: Number,
  purchaser: String,
  status: String,
  category: String,
  remarks: String
});
export const BvpSurveyEntry = mongoose.model('BvpSurveyEntry', BvpSurveyEntrySchema);

const BvpMpEntrySchema = new mongoose.Schema({
  id: { type: String, unique: true },
  session: String,
  date: String,
  month: String,
  item: String,
  qty: Number,
  wt: Number,
  location: String,
  cond_by: String,
  lot: String,
  party: String,
  rate: Number,
  amount: Number,
  status: String,
  remarks: String
});
export const BvpMpEntry = mongoose.model('BvpMpEntry', BvpMpEntrySchema);

const BvpMonthlyManualEntrySchema = new mongoose.Schema({
  id: { type: String, unique: true },
  session: String,
  month: String,
  ferrous: Number,
  wta: Number,
  nf: Number,
  misc: Number,
  mp_mt: Number,
  rs_f: Number,
  rs_w: Number,
  rs_nf: Number,
  rs_m: Number,
  mp_rs: Number
}, { timestamps: true });
export const BvpMonthlyManualEntry = mongoose.model('BvpMonthlyManualEntry', BvpMonthlyManualEntrySchema);
