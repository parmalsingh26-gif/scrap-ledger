import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  categoryId: Number,
  hsnCode: String
});
const Item = mongoose.model('Item', ItemSchema);

const FirmMasterSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: String
});
const FirmMaster = mongoose.model('FirmMaster', FirmMasterSchema);

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
  weightPerNos: Number
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
  dateDelivered: String,
  weightPerNos: Number
});
const Outward = mongoose.model('OutwardEntry', OutwardSchema);

const InventoryBalanceSchema = new mongoose.Schema({
  itemId: { type: Number, unique: true },
  approxBalance: Number,
  unitId: Number
});
const InventoryBalance = mongoose.model('InventoryBalance', InventoryBalanceSchema);

// ========== BVP Scrap Position Models ==========
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
const BvpScrapEntry = mongoose.model('BvpScrapEntry', BvpScrapEntrySchema);

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
const BvpCoachEntry = mongoose.model('BvpCoachEntry', BvpCoachEntrySchema);

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
const BvpSurveyEntry = mongoose.model('BvpSurveyEntry', BvpSurveyEntrySchema);

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
app.use('/api/firmMasters', makeApi(FirmMaster));
app.use('/api/inwardEntries', makeApi(Inward));
app.use('/api/outwardEntries', makeApi(Outward));
app.use('/api/inventoryBalances', makeApi(InventoryBalance));

// ========== BVP Scrap Position API Routes ==========
function makeBvpApi(model) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    res.json(await model.find({}, '-_id -__v'));
  });
  router.post('/', async (req, res) => {
    const data = req.body;
    const doc = new model(data);
    await doc.save();
    const ret = doc.toObject();
    delete ret._id;
    delete ret.__v;
    res.json(ret);
  });
  router.delete('/:id', async (req, res) => {
    await model.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  });
  return router;
}

app.use('/api/bvpScrapEntries', makeBvpApi(BvpScrapEntry));
app.use('/api/bvpCoachEntries', makeBvpApi(BvpCoachEntry));
app.use('/api/bvpSurveyEntries', makeBvpApi(BvpSurveyEntry));

// BVP Seed Data Endpoint
app.post('/api/bvp/init', async (req, res) => {
  const scrapCount = await BvpScrapEntry.countDocuments();
  if (scrapCount === 0) {
    const SEED_SCRAP = [
      {id:'s_2526_apr',session:'2025-26',date_from:'2025-04-01',date_to:'2025-04-30',type:'MS Ferrous',desc:'April 2025 MS Ferrous consolidated',qty_nos:'',qty_sets:'',wt_wta:41.75,wt_tb:0,wt_ms:261,wt_nf:0,wt_other:10,wt_total:312.75,lot:'APR2526-F',party:'Various',rate:0,amount:16680327,remarks:'Historical seed'},
      {id:'s_2526_may',session:'2025-26',date_from:'2025-05-01',date_to:'2025-05-31',type:'WTA',desc:'May 2025 consolidated',qty_nos:'',qty_sets:'',wt_wta:207.96,wt_tb:0,wt_ms:6,wt_nf:0,wt_other:20,wt_total:233.96,lot:'MAY2526',party:'Various',rate:0,amount:6293332,remarks:'Historical seed'},
      {id:'s_2526_jun',session:'2025-26',date_from:'2025-06-01',date_to:'2025-06-30',type:'MS Ferrous',desc:'June 2025 consolidated',qty_nos:'',qty_sets:'',wt_wta:166.22,wt_tb:0,wt_ms:233.315,wt_nf:3.52,wt_other:0,wt_total:403.055,lot:'JUN2526',party:'Various',rate:0,amount:13570297,remarks:'Historical seed'},
      {id:'s_2526_jul',session:'2025-26',date_from:'2025-07-01',date_to:'2025-07-31',type:'MS Ferrous',desc:'July 2025 consolidated',qty_nos:'',qty_sets:'',wt_wta:122.17,wt_tb:0,wt_ms:235,wt_nf:91.811,wt_other:0,wt_total:448.981,lot:'JUL2526',party:'Various',rate:0,amount:24350168,remarks:'Historical seed'},
      {id:'s_2526_aug',session:'2025-26',date_from:'2025-08-01',date_to:'2025-08-31',type:'MS Ferrous',desc:'August 2025 consolidated',qty_nos:'',qty_sets:'',wt_wta:164.45,wt_tb:0,wt_ms:117.6,wt_nf:0,wt_other:5,wt_total:287.05,lot:'AUG2526',party:'Various',rate:0,amount:9253761,remarks:'Historical seed'},
      {id:'s_2526_sep',session:'2025-26',date_from:'2025-09-01',date_to:'2025-09-30',type:'MS Ferrous',desc:'September 2025 consolidated',qty_nos:'',qty_sets:'',wt_wta:84.36,wt_tb:0,wt_ms:398.2,wt_nf:83.862,wt_other:114.7,wt_total:681.122,lot:'SEP2526',party:'Various',rate:0,amount:25554044,remarks:'Historical seed'},
      {id:'s_2526_oct',session:'2025-26',date_from:'2025-10-01',date_to:'2025-10-31',type:'MS Ferrous',desc:'October 2025 consolidated',qty_nos:'',qty_sets:'',wt_wta:84.17,wt_tb:0,wt_ms:182.818,wt_nf:0,wt_other:0,wt_total:266.988,lot:'OCT2526',party:'Various',rate:0,amount:11606358,remarks:'Historical seed'},
      {id:'s_2526_nov',session:'2025-26',date_from:'2025-11-01',date_to:'2025-11-30',type:'MS Ferrous',desc:'November 2025 consolidated',qty_nos:'',qty_sets:'',wt_wta:81.13,wt_tb:0,wt_ms:472,wt_nf:0,wt_other:195,wt_total:748.13,lot:'NOV2526',party:'Various',rate:0,amount:15120715,remarks:'Historical seed'},
      {id:'s_2526_dec',session:'2025-26',date_from:'2025-12-01',date_to:'2025-12-31',type:'MS Ferrous',desc:'December 2025 consolidated',qty_nos:'',qty_sets:'',wt_wta:208.11,wt_tb:0,wt_ms:333,wt_nf:13.238,wt_other:0,wt_total:554.348,lot:'DEC2526',party:'Various',rate:0,amount:17990253,remarks:'Historical seed'},
      {id:'s_2526_jan',session:'2025-26',date_from:'2026-01-01',date_to:'2026-01-31',type:'MS Ferrous',desc:'January 2026 consolidated',qty_nos:'',qty_sets:'',wt_wta:162.95,wt_tb:0,wt_ms:43.673,wt_nf:8.482,wt_other:37.16,wt_total:252.265,lot:'JAN2526',party:'Various',rate:0,amount:9259573,remarks:'Historical seed'},
      {id:'s_2526_feb',session:'2025-26',date_from:'2026-02-01',date_to:'2026-02-28',type:'MS Ferrous',desc:'February 2026 consolidated',qty_nos:'',qty_sets:'',wt_wta:166.285,wt_tb:0,wt_ms:441,wt_nf:120,wt_other:20,wt_total:747.285,lot:'FEB2526',party:'Various',rate:0,amount:33015856,remarks:'Historical seed'},
      {id:'s_2526_mar',session:'2025-26',date_from:'2026-03-01',date_to:'2026-03-31',type:'MS Ferrous',desc:'March 2026 consolidated',qty_nos:'',qty_sets:'',wt_wta:118.79,wt_tb:0,wt_ms:14.2,wt_nf:0,wt_other:5,wt_total:137.99,lot:'MAR2526',party:'Various',rate:0,amount:3886850,remarks:'Historical seed'},
      {id:'s_2425_apr',session:'2024-25',date_from:'2024-04-01',date_to:'2024-04-30',type:'MS Ferrous',desc:'April 2024 consolidated',qty_nos:'',qty_sets:'',wt_wta:80.44,wt_tb:0,wt_ms:249,wt_nf:5.74,wt_other:19,wt_total:354.18,lot:'APR2425',party:'Various',rate:0,amount:11379101,remarks:'Historical seed'},
      {id:'s_2425_may',session:'2024-25',date_from:'2024-05-01',date_to:'2024-05-31',type:'MS Ferrous',desc:'May 2024',qty_nos:'',qty_sets:'',wt_wta:123.15,wt_tb:0,wt_ms:94.625,wt_nf:0,wt_other:0,wt_total:217.775,lot:'MAY2425',party:'Various',rate:0,amount:7128027,remarks:'Historical seed'},
      {id:'s_2425_jun',session:'2024-25',date_from:'2024-06-01',date_to:'2024-06-30',type:'MS Ferrous',desc:'June 2024',qty_nos:'',qty_sets:'',wt_wta:82.285,wt_tb:0,wt_ms:238.345,wt_nf:60.786,wt_other:0,wt_total:381.416,lot:'JUN2425',party:'Various',rate:0,amount:18281418,remarks:'Historical seed'},
      {id:'s_2425_rest',session:'2024-25',date_from:'2024-07-01',date_to:'2025-03-31',type:'MS Ferrous',desc:'Jul-Mar 2024-25 consolidated',qty_nos:'',qty_sets:'',wt_wta:1005.675,wt_tb:0,wt_ms:895.965,wt_nf:259.399,wt_other:268.3,wt_total:2429.816,lot:'REST2425',party:'Various',rate:0,amount:91572745,remarks:'Historical seed'},
      {id:'s_2324_all',session:'2023-24',date_from:'2023-04-01',date_to:'2024-03-31',type:'MS Ferrous',desc:'2023-24 full year consolidated',qty_nos:'',qty_sets:'',wt_wta:996.725,wt_tb:0,wt_ms:1978.697,wt_nf:393.487,wt_other:653.463,wt_total:4022.372,lot:'FY2324',party:'Various',rate:0,amount:152450443,remarks:'Historical seed'},
    ];
    const SEED_COACH = [
      {id:'c_2526_1',session:'2025-26',sr:1,coach_no:'942370',code:'WGSCN',cat:'PCV',age:'OVERAGED',cond_by:'CWM-BVP',rso:'M.100/2/RSO/2025-26',rso_date:'2025-04-01',offer_date:'',auc1:'',auc2:'',sale_order:'',sale_date:'',purchaser:'',del_from:'',del_to:'',sale_amt:'',status:'SOLD',remarks:''},
      {id:'c_2526_tot',session:'2025-26',sr:'AGG',coach_no:'(63 total)',code:'Various',cat:'PCV',age:'Mixed',cond_by:'Various',rso:'Multiple',rso_date:'',offer_date:'',auc1:'',auc2:'',sale_order:'',sale_date:'',purchaser:'Various',del_from:'',del_to:'',sale_amt:'',status:'SOLD',remarks:'2025-26: 40 PCV + 23 OCV = 63 total. Seed data.'},
      {id:'c_2425_tot',session:'2024-25',sr:'AGG',coach_no:'(91 total)',code:'Various',cat:'PCV',age:'Mixed',cond_by:'Various',rso:'Multiple',rso_date:'',offer_date:'',auc1:'',auc2:'',sale_order:'',sale_date:'',purchaser:'Various',del_from:'',del_to:'',sale_amt:'',status:'SOLD',remarks:'2024-25: 80 PCV + 11 OCV = 91 total. Seed data.'},
      {id:'c_2324_tot',session:'2023-24',sr:'AGG',coach_no:'(40 total)',code:'Various',cat:'PCV',age:'Mixed',cond_by:'Various',rso:'Multiple',rso_date:'',offer_date:'',auc1:'',auc2:'',sale_order:'',sale_date:'',purchaser:'Various',del_from:'',del_to:'',sale_amt:'',status:'SOLD',remarks:'2023-24: 27 PCV + 13 OCV = 40 total. Seed data.'},
    ];
    const SEED_SURVEY = [
      {id:'sv_1',session:'2024-25',lot:'25.24.12.66',location:'BVP MG Workshop',desc:'Cond. Wooden Scrap',qty:25,unit:'MT',wt:25,offer_date:'2024-12-02',bid:0,purchaser:'',status:'SOLD OUT',category:'Wooden',remarks:'SOLD OUT, RE AUCTION'},
      {id:'sv_2',session:'2024-25',lot:'25.24.12.77',location:'MG W/S Open Area',desc:'Mix Hetro Scrap Junk Kachara',qty:150,unit:'MT',wt:150,offer_date:'2024-12-02',bid:0,purchaser:'',status:'SOLD OUT',category:'Mix/Junk',remarks:'SOLD OUT'},
      {id:'sv_3',session:'2024-25',lot:'25.24.12.78',location:'MG W/S Open Area Near Coach lowering shed',desc:'Mix Hetro Scrap Junk Kachara',qty:100,unit:'MT',wt:100,offer_date:'2024-12-02',bid:0,purchaser:'',status:'SOLD OUT',category:'Mix/Junk',remarks:'SOLD OUT'},
      {id:'sv_4',session:'2025-26',lot:'25.25.04.07',location:'BVP BG W/S Near Incinerator',desc:'Scrap Melting - MS items nut bolt pin',qty:50,unit:'MT',wt:50,offer_date:'2025-04-16',bid:0,purchaser:'',status:'SOLD OUT',category:'MS Ferrous',remarks:'SOLD OUT'},
      {id:'sv_5',session:'2025-26',lot:'25.25.04.12',location:'BG Workshop Near new rehab shop',desc:'Condemn LHB Parts - control arm, coupler, brake disc',qty:18,unit:'MT',wt:18,offer_date:'2025-04-16',bid:0,purchaser:'',status:'SOLD OUT',category:'MS Ferrous',remarks:'SOLD OUT'},
      {id:'sv_6',session:'2025-26',lot:'25.25.05.25',location:'MG Workshop Near Coach Lowering Shed',desc:'Condemn unserviceable seat berth ICF/LHB AC/Non-AC',qty:10,unit:'MT',wt:10,offer_date:'2025-05-08',bid:0,purchaser:'',status:'UNDER AUCTION',category:'Mix/Junk',remarks:'UNDER AUCTION'},
      {id:'sv_7',session:'2025-26',lot:'25.25.05.26',location:'BVP MG Workshop/RB Section',desc:'Cond. Sunmica lavatory door',qty:7,unit:'MT',wt:7,offer_date:'2025-05-08',bid:0,purchaser:'',status:'UNDER AUCTION',category:'Mix/Junk',remarks:'UNDER AUCTION'},
      {id:'sv_8',session:'2025-26',lot:'25.25.07.28',location:'CUG Section Store BG W/S',desc:'Wearing Piece of ICF coach - Bronze',qty:900,unit:'Kg',wt:0.9,offer_date:'2025-07-12',bid:0,purchaser:'',status:'SOLD OUT',category:'Non-Ferrous',remarks:'SOLD OUT'},
      {id:'sv_9',session:'2025-26',lot:'25.25.07.29',location:'BG W/S Near TL fitting section',desc:'Condemn Brushless Alternator 4.5 kW',qty:10.5,unit:'MT',wt:10.5,offer_date:'2025-07-12',bid:0,purchaser:'',status:'SOLD OUT',category:'Non-Ferrous',remarks:'SOLD OUT'},
      {id:'sv_10',session:'2025-26',lot:'25.25.07.33',location:'Near MS JUNK LOT area',desc:'Condemn unserviceable MS items - Bogie Frame, Head Stock',qty:100,unit:'MT',wt:100,offer_date:'2025-07-12',bid:0,purchaser:'',status:'SOLD OUT',category:'MS Ferrous',remarks:'SOLD OUT'},
      {id:'sv_11',session:'2025-26',lot:'25.25.07.35',location:'BVP BG Workshop near Big Water Tank',desc:'MS Mix Scrap - Protective Tube, Dash Pot, Sole Bar',qty:150,unit:'MT',wt:150,offer_date:'2025-07-12',bid:0,purchaser:'',status:'UNDER AUCTION',category:'MS Ferrous',remarks:'UNDER AUCTION'},
      {id:'sv_12',session:'2025-26',lot:'25.25.08.41',location:'BVP BG Workshop Near New Battery Section',desc:'Condemn VRLA Battery 6V/120AH - 2700 No.',qty:66.15,unit:'MT',wt:66.15,offer_date:'2025-08-19',bid:0,purchaser:'',status:'UNDER AUCTION',category:'Battery',remarks:'UNDER AUCTION'},
      {id:'sv_13',session:'2025-26',lot:'25.25.08.53',location:'BG Workshop',desc:'Cond. Mix MS scrap',qty:120,unit:'MT',wt:120,offer_date:'2025-08-28',bid:0,purchaser:'',status:'UNDER AUCTION',category:'MS Ferrous',remarks:'UNDER AUCTION'},
    ];
    await BvpScrapEntry.insertMany(SEED_SCRAP);
    await BvpCoachEntry.insertMany(SEED_COACH);
    await BvpSurveyEntry.insertMany(SEED_SURVEY);
  }
  res.json({ success: true });
});

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

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
