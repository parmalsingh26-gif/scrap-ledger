import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(cors());
// Increase payload limit for backups
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/scrapyard';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const CategorySchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: String,
  bgColor: String,
  hasRedBand: Boolean
});
const Category = mongoose.model('Category', CategorySchema);

const UnitSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: String
});
const Unit = mongoose.model('Unit', UnitSchema);

const ItemSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: String,
  categoryId: Number
});
const Item = mongoose.model('Item', ItemSchema);

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
  fcCount: Number
});
const Inward = mongoose.model('InwardEntry', InwardSchema);

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
  dateDelivered: String
});
const Outward = mongoose.model('OutwardEntry', OutwardSchema);

const InventoryBalanceSchema = new mongoose.Schema({
  itemId: { type: Number, unique: true },
  approxBalance: Number,
  unitId: Number
});
const InventoryBalance = mongoose.model('InventoryBalance', InventoryBalanceSchema);

async function getNextId(model) {
  const last = await model.findOne().sort('-id');
  return last && last.id ? last.id + 1 : 1;
}

function makeApi(model) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    res.json(await model.find({}, '-_id -__v').sort('id'));
  });
  router.post('/', async (req, res) => {
    const data = req.body;
    if (model !== InventoryBalance && !data.id) {
      data.id = await getNextId(model);
    }
    const doc = new model(data);
    await doc.save();
    
    // remove _id and __v before returning
    const ret = doc.toObject();
    delete ret._id;
    delete ret.__v;
    
    res.json(ret);
  });
  router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const filter = model === InventoryBalance ? { itemId: id } : { id };
    await model.findOneAndUpdate(filter, req.body, { upsert: true });
    res.json({ success: true });
  });
  router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const filter = model === InventoryBalance ? { itemId: id } : { id };
    await model.findOneAndDelete(filter);
    res.json({ success: true });
  });
  return router;
}

app.use('/api/categories', makeApi(Category));
app.use('/api/units', makeApi(Unit));
app.use('/api/items', makeApi(Item));
app.use('/api/inwardEntries', makeApi(Inward));
app.use('/api/outwardEntries', makeApi(Outward));
app.use('/api/inventoryBalances', makeApi(InventoryBalance));

app.delete('/api/custom/inventoryBalancesByItem/:itemId', async (req, res) => {
  await InventoryBalance.deleteMany({ itemId: Number(req.params.itemId) });
  res.json({ success: true });
});

app.post('/api/init', async (req, res) => {
  const cats = await Category.countDocuments();
  if (cats === 0) {
    const baseCats = [
      { id: 1, name: 'Metallic ferrous scrap', bgColor: 'bg-blue-900', hasRedBand: true },
      { id: 2, name: 'Metallic Non-ferrous scrap', bgColor: 'bg-orange-500', hasRedBand: true },
      { id: 3, name: 'Hazardous Waste scrap', bgColor: 'bg-zinc-900', hasRedBand: true },
      { id: 4, name: 'Low value Non-Biodegradable scrap', bgColor: 'bg-yellow-400', hasRedBand: true },
      { id: 5, name: 'Low value Biodegradable scrap', bgColor: 'bg-green-600', hasRedBand: true },
      { id: 6, name: 'Glass scrap', bgColor: 'bg-gray-500', hasRedBand: true },
      { id: 7, name: 'Zero value scrap', bgColor: 'bg-amber-800', hasRedBand: true }
    ];
    await Category.insertMany(baseCats);

    const baseUnits = [
      { id: 1, name: 'MT' }, { id: 2, name: 'Kg' }, { id: 3, name: 'Nos' }, { id: 4, name: 'Trolley' }
    ];
    await Unit.insertMany(baseUnits);

    const initialItems = [
      { id: 1, name: 'Alternator', categoryId: 1 },
      { id: 2, name: 'Bogie Frame', categoryId: 1 },
      { id: 3, name: 'Brake Beam', categoryId: 1 },
      { id: 4, name: 'Wheel Axle', categoryId: 1 },
      { id: 5, name: 'MS Cutting', categoryId: 1 },
      { id: 6, name: 'MS Heavy', categoryId: 1 },
      { id: 7, name: 'Transformer', categoryId: 1 },
      { id: 8, name: 'Buffer Plunger Assembly', categoryId: 1 },
      { id: 9, name: 'CTRB', categoryId: 1 },
      { id: 10, name: 'Bearing', categoryId: 1 },
      { id: 11, name: 'Bio Toilet Tank', categoryId: 1 },
      { id: 12, name: 'Aluminium', categoryId: 2 },
      { id: 13, name: 'Aluminium Covers', categoryId: 2 },
      { id: 14, name: 'Aluminium Water Tank', categoryId: 2 },
      { id: 15, name: 'Wearing Piece (Bronze)', categoryId: 2 },
      { id: 16, name: 'Copper', categoryId: 2 },
      { id: 17, name: '2V / 120AH Battery', categoryId: 2 },
      { id: 18, name: '2V / 1100AH Battery', categoryId: 2 },
      { id: 19, name: '6V / 120AH LMLA Battery', categoryId: 2 },
      { id: 20, name: '6V / 120AH VRLA Battery', categoryId: 2 },
      { id: 21, name: 'Emergency Light Battery', categoryId: 2 },
      { id: 22, name: 'Oil', categoryId: 3 },
      { id: 23, name: 'Grease', categoryId: 3 },
      { id: 24, name: 'Fibre Window', categoryId: 4 },
      { id: 25, name: 'PVC-Rexine', categoryId: 4 },
      { id: 26, name: 'Rubber', categoryId: 4 },
      { id: 27, name: 'V-Belt', categoryId: 4 },
      { id: 28, name: 'Teflon & Plastic', categoryId: 4 },
      { id: 29, name: 'Plastic Drum (Blue)', categoryId: 4 },
      { id: 30, name: 'Wooden', categoryId: 5 },
      { id: 31, name: 'Carton', categoryId: 5 },
      { id: 32, name: 'Plywood', categoryId: 5 },
      { id: 33, name: 'Glass', categoryId: 6 },
      { id: 34, name: 'Mirror', categoryId: 6 },
      { id: 35, name: 'Dust', categoryId: 7 },
      { id: 36, name: 'Paper', categoryId: 7 },
      { id: 37, name: 'Sweeping junk', categoryId: 7 },
    ];
    await Item.insertMany(initialItems);
  }
  res.json({ success: true });
});

app.post('/api/backup', async (req, res) => {
    const { categories, items, units, inwardEntries, outwardEntries, inventoryBalances } = req.body;
    await Category.deleteMany({});
    if(categories?.length) await Category.insertMany(categories);
    
    await Item.deleteMany({});
    if(items?.length) await Item.insertMany(items);
    
    await Unit.deleteMany({});
    if(units?.length) await Unit.insertMany(units);
    
    await Inward.deleteMany({});
    if(inwardEntries?.length) await Inward.insertMany(inwardEntries);
    
    await Outward.deleteMany({});
    if(outwardEntries?.length) await Outward.insertMany(outwardEntries);
    
    await InventoryBalance.deleteMany({});
    if(inventoryBalances?.length) await InventoryBalance.insertMany(inventoryBalances);
    
    res.json({ success: true });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
