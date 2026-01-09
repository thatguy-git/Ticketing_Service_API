import { prisma } from '../configs/db';
import { reservationService } from './reservationService'; // Your existing service
import { bankingClient } from '../integrations/bankingClient'; // The client we wrote
import { AppError } from '../utils/AppError';

export class BookingService {
    // PHASE 1: START THE PROCESS
    // Called by: User (POST /api/bookings)
    async initiateBooking(userId: string, seatId: string) {
        // 1. Hold the Seat (Reusing your logic!)
        // This ensures no one else can grab it while we set up payment
        const reservation = await reservationService.holdSeat(userId, seatId);

        // 2. Fetch Seat details for the Invoice
        const seat = await prisma.seat.findUnique({ where: { id: seatId } });
        if (!seat) throw new AppError('Seat data corrupted', 500);

        // 3. Create the Invoice on Banking Service
        // We link the 'reference' to our Reservation ID so we can track it later
        const invoiceResponse = await bankingClient.createInvoice(
            Number(seat.price), // Ensure price is a number
            reservation.id, // REFERENCE: This connects Payment -> Reservation
            `Ticket for Seat ${seat.row}-${seat.number}`
        );

        // 4. Return info so User can pay
        return {
            status: 'pending_payment',
            reservationId: reservation.id,
            invoiceId: invoiceResponse.invoiceId, // User needs this to pay the bank
            expiresAt: reservation.expiresAt,
        };
    }

    // PHASE 2: FINISH THE PROCESS
    // Called by: Webhook Controller (when Bank says "PAID")
    async finalizeBooking(reservationId: string, transactionId: string) {
        return await prisma.$transaction(async (tx) => {
            // 1. Find the Reservation
            const reservation = await tx.reservation.findUnique({
                where: { id: reservationId },
                include: { seat: true }, // Need price/seat info
            });

            // ⚠️ Edge Case: Reservation expired or already processed?
            if (!reservation) {
                // Check if it was already booked (Idempotency)
                // This prevents crashing if the Bank sends the webhook twice
                const existingBooking = await tx.booking.findFirst({
                    where: { seatId: reservationId }, // Assuming logic to track by Ref
                });

                if (existingBooking) {
                    console.log('Booking already exists, skipping...');
                    return existingBooking;
                }

                throw new AppError(
                    'Reservation expired or not found. Manual Refund needed.',
                    400
                );
            }

            // 2. Create the Permanent Booking
            const booking = await tx.booking.create({
                data: {
                    userId: reservation.userId,
                    seatId: reservation.seatId,
                    amount: reservation.seat.price,
                    transactionId: transactionId,
                    status: 'CONFIRMED',
                    createdAt: new Date(),
                },
            });

            // 3. Update Seat to Final State 'BOOKED'
            await tx.seat.update({
                where: { id: reservation.seatId },
                data: {
                    status: 'BOOKED',
                    version: { increment: 1 }, // Keep versioning for safety
                },
            });

            // 4. Delete the Temporary Reservation
            // We don't need the "Hold" anymore because we have the "Booking"
            await tx.reservation.delete({
                where: { id: reservationId },
            });

            return booking;
        });
    }
}

export const bookingService = new BookingService();
