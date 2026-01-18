import { Router } from 'express';
import { handlePaymentWebhook } from '../controllers/webhookController';

const router = Router();

// This is the "Ear" listening for the Bank's message
// POST /api/webhooks/bank
// This is for when the bank has sent us a webhook about payment status
router.post('/', handlePaymentWebhook);

export { router as webhookRoutes };
