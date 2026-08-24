import mongoose from 'mongoose';
import { Contract } from './backend/models/Contract.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/scrapyard';

const sectionMapping = {
  "Supervisor": [
    { "sr_no": 1, "name": "MAKWANA NAYANA" }
  ],
  "Scrap Section": [
    { "sr_no": 2, "name": "KAMBAD DIVYESH" },
    { "sr_no": 4, "name": "MANGALSHIKA MAHESH ." },
    { "sr_no": 5, "name": "VAGHELA RAJESHBHAI ." },
    { "sr_no": 7, "name": "VAGHELA PARTH ." },
    { "sr_no": 15, "name": "MAKWANA HARDIKBHAI ." },
    { "sr_no": 33, "name": "PARMAR SANJAY" },
    { "sr_no": 34, "name": "KAMBAD PARTH" },
    { "sr_no": 37, "name": "PARMAR YUVRAJ" },
    { "sr_no": 41, "name": "BAVALIYA SANJAY" },
    { "sr_no": 44, "name": "PARMAR BHAVESH" },
    { "sr_no": 48, "name": "GOSWAMI NAREDRAGIRI" }
  ],
  "CUG": [
    { "sr_no": 8, "name": "PARMAR KAPIL ." },
    { "sr_no": 45, "name": "PARMAR PRAVIBHAI" }
  ],
  "Reliever": [
    { "sr_no": 38, "name": "KHOKHANI ASMITA BEN" },
    { "sr_no": 39, "name": "PARMAR SONI BEN" },
    { "sr_no": 40, "name": "DABHI SONAL BEN" },
    { "sr_no": 46, "name": "GHOYAL ASHOKBHAI" }
  ],
  "Flat Boggie": [
    { "sr_no": 3, "name": "BARAIYA NILESHBHAI ." },
    { "sr_no": 17, "name": "SOLANKI KIRITBHAI ." }
  ],
  "Bogie Comp.": [
    { "sr_no": 11, "name": "PARMAR PRADIPBHAI ." }
  ],
  "Rehab": [
    { "sr_no": 6, "name": "HITESH VAGHELA ." },
    { "sr_no": 28, "name": "KANCHAN BEN" },
    { "sr_no": 35, "name": "KAPADI ASHOK BHAI" },
    { "sr_no": 42, "name": "KOTAR RAJUBHAI" }
  ],
  "Store": [
    { "sr_no": 9, "name": "TIRTHRAJ GOHIL ." },
    { "sr_no": 10, "name": "GOHIL RUSHIRAJ ." }
  ],
  "Roller Bearing": [
    { "sr_no": 13, "name": "RATHOD JAYESH ." },
    { "sr_no": 14, "name": "SOLANKI PRAKASH ." }
  ],
  "Wheel Shop": [
    { "sr_no": 12, "name": "CHAUHAN BHARATBHAI ." },
    { "sr_no": 32, "name": "MAKWANA DEEPAK" }
  ],
  "Final Shop": [
    { "sr_no": 16, "name": "MAKWANA AKASH ." },
    { "sr_no": 19, "name": "KASHIBEN GOHIL ." },
    { "sr_no": 26, "name": "MER ASHA BEN" },
    { "sr_no": 36, "name": "CHANDRAKANT BHAI" }
  ],
  "Paint Shop": [
    { "sr_no": 18, "name": "PARMAR NITABEN" },
    { "sr_no": 30, "name": "CHAUHAN SHITALBEN" }
  ],
  "Smithy": [
    { "sr_no": 20, "name": "MAKWANA NIRUBEN" },
    { "sr_no": 47, "name": "MAKWANA VASANTBEN" }
  ],
  "I.O.H.": [
    { "sr_no": 21, "name": "RATHOD RAMESHBHAI ." },
    { "sr_no": 29, "name": "SOLANKI PARESH" }
  ],
  "Air Break": [
    { "sr_no": 22, "name": "BARAIYA ASHISHBHAI ." }
  ],
  "C.P.T.": [
    { "sr_no": 23, "name": "ANAND LATHIYA ." },
    { "sr_no": 24, "name": "MER RANJITBHAI" },
    { "sr_no": 31, "name": "VAJA MUKESH" }
  ],
  "Battery Shop": [
    { "sr_no": 25, "name": "PARMAR GEETABEN" },
    { "sr_no": 43, "name": "KOTAR HARSHA BEN" }
  ]
};

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create a reverse map: sr_no -> section (and name -> section as fallback)
    const srNoToSection = {};
    const nameToSection = {};
    
    for (const [section, workers] of Object.entries(sectionMapping)) {
      for (const w of workers) {
        srNoToSection[w.sr_no] = section;
        nameToSection[w.name.trim().toUpperCase()] = section;
      }
    }

    const contracts = await Contract.find({ type: 'manpower', status: 'active' });
    let updatedCount = 0;

    for (const contract of contracts) {
      if (!contract.months || contract.months.length === 0) continue;
      
      // Update the most recent month
      const lastMonthIdx = contract.months.length - 1;
      const lastMonth = contract.months[lastMonthIdx];
      
      let modified = false;
      
      lastMonth.workers = lastMonth.workers.map(w => {
        let section = null;
        if (w.srNo && srNoToSection[w.srNo]) {
          section = srNoToSection[w.srNo];
        } else if (w.name && nameToSection[w.name.trim().toUpperCase()]) {
          section = nameToSection[w.name.trim().toUpperCase()];
        }
        
        if (section && w.section !== section.toUpperCase()) {
          modified = true;
          return { ...w, section: section.toUpperCase() };
        }
        return w;
      });
      
      if (modified) {
        contract.markModified('months');
        await contract.save();
        updatedCount++;
        console.log(`Updated sections for contract: ${contract.name || contract.id}`);
      }
    }
    
    console.log(`Successfully updated sections in ${updatedCount} contracts.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    mongoose.disconnect();
  }
}

run();
