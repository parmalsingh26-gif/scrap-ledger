import express from 'express';
import { Category, Unit, Item, FirmMaster } from '../models/BaseData.js';
import { makeApi } from '../utils/apiHelper.js';

const router = express.Router();

router.use('/categories', makeApi(Category));
router.use('/units', makeApi(Unit));
router.use('/items', makeApi(Item));
router.use('/firmMasters', makeApi(FirmMaster));

export default router;
