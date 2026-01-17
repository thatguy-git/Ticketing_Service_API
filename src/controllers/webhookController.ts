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

        // Handle successful payment
        if (event === 'INVOICE_PAID' && status === 'PAID') {
            const booking = await bookingService.finalizeBooking(
                reference,
                invoiceId
            );

            console.log(`✅ Booking confirmed: ${booking.id}`);
            return res.status(200).json({ received: true });
        }

        // Handle expired or failed invoices by releasing the reservation
        if (event === 'INVOICE_EXPIRED' || event === 'INVOICE_FAILED') {
            const releaseResult = await bookingService.releaseReservation(
                reference
            );

            console.log(
                `🆓 Reservation released for expired/failed invoice: ${reference}`
            );
            return res
                .status(200)
                .json({ received: true, released: releaseResult.released });
        }

        // For other events, acknowledge but ignore
        res.status(200).json({ received: true, ignored: true });
    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        // Always return 200 to prevent retries
        res.status(200).json({
            received: true,
            error: 'Internal processing failed',
        });
    }
}
