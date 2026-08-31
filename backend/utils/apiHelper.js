import express from 'express';

export async function getNextId(model) {
  const last = await model.findOne().sort('-id');
  return last && last.id ? last.id + 1 : 1;
}

export function makeApi(model) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    try {
      res.json(await model.find({}, '-_id -__v').sort('id'));
    } catch (err) {
      console.error('GET error:', err);
      res.status(500).json({ error: 'Failed to fetch records' });
    }
  });
  
  router.post('/', async (req, res) => {
    try {
      const data = req.body;
      if (model.modelName !== 'InventoryBalance' && !data.id) {
        data.id = await getNextId(model);
      }
      const doc = new model(data);
      await doc.save();
      
      const ret = doc.toObject();
      delete ret._id;
      delete ret.__v;
      
      res.json(ret);
    } catch (err) {
      console.error('POST error:', err);
      res.status(500).json({ error: 'Failed to create record' });
    }
  });
  
  router.put('/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const filter = model.modelName === 'InventoryBalance' ? { itemId: id } : { id };
      await model.findOneAndUpdate(filter, req.body, { upsert: true });
      res.json({ success: true });
    } catch (err) {
      console.error('PUT error:', err);
      res.status(500).json({ error: 'Failed to update record' });
    }
  });
  
  router.delete('/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const filter = model.modelName === 'InventoryBalance' ? { itemId: id } : { id };
      await model.findOneAndDelete(filter);
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE error:', err);
      res.status(500).json({ error: 'Failed to delete record' });
    }
  });
  
  return router;
}

export function makeBvpApi(model) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    try {
      res.json(await model.find({}, '-_id -__v'));
    } catch (err) {
      console.error('BVP GET error:', err);
      res.status(500).json({ error: 'Failed to fetch records' });
    }
  });
  
  router.post('/', async (req, res) => {
    try {
      const data = req.body;
      if (!data.id) {
        return res.status(400).json({ error: 'id is required' });
      }
      const record = await model.findOneAndUpdate(
        { id: data.id },
        data,
        { returnDocument: 'after', upsert: true }
      );
      const ret = record.toObject();
      delete ret._id;
      delete ret.__v;
      res.json(ret);
    } catch (err) {
      console.error('BVP POST error:', err);
      res.status(500).json({ error: 'Failed to create/update record' });
    }
  });
  
  router.delete('/:id', async (req, res) => {
    try {
      await model.findOneAndDelete({ id: req.params.id });
      res.json({ success: true });
    } catch (err) {
      console.error('BVP DELETE error:', err);
      res.status(500).json({ error: 'Failed to delete record' });
    }
  });
  
  return router;
}
