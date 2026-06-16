import express from 'express';
import { getConfig, updateConfig, updateBrokerConfig, fyersAuth, fyersAuthCallback } from '../controllers/dataController.js';
import { placePaperOrder, getOpenPositions, closePaperOrder } from '../controllers/tradeController.js';

const router = express.Router();

router.get('/config', getConfig);
router.post('/config', updateConfig);

// Dynamic Fyers Authentication Routes
router.post('/broker/config', updateBrokerConfig);
router.get('/auth/fyers', fyersAuth);
router.get('/auth/fyers/callback', fyersAuthCallback);

// Paper Trading Routes
router.post('/paper/order', placePaperOrder);
router.get('/paper/positions', getOpenPositions);
router.put('/paper/order/:id', closePaperOrder);
export default router;
