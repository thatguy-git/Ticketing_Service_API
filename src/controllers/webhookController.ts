// src/controllers/webhookController.ts
import { NextFunction, Request, Response } from 'express';
import { bookingService } from '../services/bookingService';

export async function handlePaymentWebhook(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        // Extract data sent by the Banking Service
        const { event, reference, status, invoiceId } = req.body;

        console.log(`🔔 Webhook received: ${event} for Ref: ${reference}`);

        // We only care if the money was actually paid
        if (event === 'INVOICE_PAID' && status === 'PAID') {
            // ✅ FIX: Pass BOTH the reference (Reservation ID) AND invoiceId (Transaction ID)
            const booking = await bookingService.finalizeBooking(
                reference,
                invoiceId
            );

            console.log(`✅ Booking confirmed: ${booking.id}`);

            // Return 200 to tell the Bank "We got it"
            return res.status(200).json({ received: true });
        }

        // If it's expired or failed, we just acknowledge receipt
        res.status(200).json({ received: true, ignored: true });
    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        // Always return 200 OK to the bank so it doesn't keep retrying forever
        // (In a real app, you might return 500 only if you want the bank to retry)
        res.status(200).json({
            received: true,
            error: 'Internal processing failed',
        });
    }
}
