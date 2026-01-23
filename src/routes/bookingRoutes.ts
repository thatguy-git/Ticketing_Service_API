import { Router } from 'express';
import { BookingController } from '../controllers/bookingController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { verifyBankSignature } from '../middlewares/verifyWebhook';
import { handlePaymentWebhook } from '../controllers/webhookController';
import { validate } from '../middlewares/validate.input';
import { createBookingValidationSchema } from '../utils/validationSchemas';

const router = Router();

// 🔒 User Protected: Needs User Login (Bearer Token)
router.post(
    '/',
    authenticateToken,
    validate(createBookingValidationSchema),
    BookingController.createBooking,
);

// 🛡️ Service Protected: Needs Banking API Key (x-api-key)
// The Banking Service must send this key in the headers when calling this URL
router.post(
    '/webhook',
    verifyBankSignature, // 👈 Added here
    handlePaymentWebhook,
);

export { router as bookingRoutes };
