import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: String,
  bgColor: String,
  hasRedBand: Boolean
});
export const Category = mongoose.model('Category', CategorySchema);

const UnitSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: String
});
export const Unit = mongoose.model('Unit', UnitSchema);

const ItemSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: String,
  categoryId: Number,
  hsnCode: String
});
export const Item = mongoose.model('Item', ItemSchema);

const FirmMasterSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: String
});
export const FirmMaster = mongoose.model('FirmMaster', FirmMasterSchema);
