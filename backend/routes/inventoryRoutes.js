import express from 'express';
import { Inward, Outward, InventoryBalance } from '../models/Inventory.js';
import { makeApi } from '../utils/apiHelper.js';

const router = express.Router();

router.use('/inwardEntries', makeApi(Inward));
router.use('/outwardEntries', makeApi(Outward));
router.use('/inventoryBalances', makeApi(InventoryBalance));

router.delete('/custom/inventoryBalancesByItem/:itemId', async (req, res) => {
  await InventoryBalance.deleteMany({ itemId: Number(req.params.itemId) });
  res.json({ success: true });
});

export default router;
