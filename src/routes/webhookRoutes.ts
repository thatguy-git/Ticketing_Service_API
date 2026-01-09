import { Router } from 'express';
import { handleBankWebhook } from '../controllers/webhookController';

const router = Router();

// This is the "Ear" listening for the Bank's message
// POST /api/webhooks/bank
router.post('/bank', handleBankWebhook);

export { router as webhookRoutes };
