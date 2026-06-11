import express from 'express';
import { getConfig, updateConfig } from '../controllers/dataController.js';

const router = express.Router();

router.get('/config', getConfig);
router.post('/config', updateConfig);

export default router;
