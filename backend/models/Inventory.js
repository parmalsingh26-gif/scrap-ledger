import mongoose from 'mongoose';

const InwardSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  itemId: Number,
  quantity: Number,
  unitId: Number,
  date: String,
  lotNumber: String,
  machineType: String,
  coverType: String,
  rcCount: Number,
  fcCount: Number,
  weightPerNos: Number,
  valueMode: String,    // 'weight' | 'nos' | 'volume' | 'manual'
  rate: Number,         // rate per unit (per MT/Kg/Nos/Litre)
  totalValue: Number    // calculated total value
});
export const Inward = mongoose.model('InwardEntry', InwardSchema);

const OutwardSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  itemId: Number,
  lotNumber: String,
  hsnCode: String,
  quantity: Number,
  unitId: Number,
  firmName: String,
  dateLotApplied: String,
  dateSold: String,
  dateDelivered: String,
  weightPerNos: Number,
  rcCount: Number,
  fcCount: Number,
  deliveries: [{
    date: String,
    quantity: Number,
    isFinal: Boolean,
  }],
  rate: Number,
});
export const Outward = mongoose.model('OutwardEntry', OutwardSchema);

const InventoryBalanceSchema = new mongoose.Schema({
  itemId: { type: Number, unique: true },
  approxBalance: Number,
  unitId: Number
});
export const InventoryBalance = mongoose.model('InventoryBalance', InventoryBalanceSchema);
