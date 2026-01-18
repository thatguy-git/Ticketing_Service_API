import { prisma } from '../configs/db';
import { reservationService } from './reservationService';
import { bankingClient } from '../integrations/bankingClient';
import { AppError } from '../utils/AppError';
import { v4 as uuidv4 } from 'uuid';

export class BookingService {
    async initiateBooking(userId: string, seatId: string) {
        const reservation = await reservationService.holdSeat(userId, seatId);
        const myReference = `TKT-${uuidv4()}`;
        const seat = await prisma.seat.findUnique({
            where: { id: seatId },
            include: { event: { include: { organizer: true } } },
        });
        if (!seat) throw new AppError('Seat data corrupted', 500);

        if (!seat.event.organizerId) {
            throw new AppError('Event has no organizer assigned', 400);
        }

        if (!seat.event.organizer?.paymentApiKey) {
            throw new AppError(
                'Event organizer has no payment API key configured',
                400
            );
        }

        // Build webhook URL for the banking service to call back to
        const webhookUrl =
            process.env.WEBHOOK_BASE_URL ||
            `http://localhost:${process.env.PORT || 4000}/api/webhooks/bank`;

        // Create the Invoice on Banking Service using organizer's API key
        const invoiceResponse = await bankingClient.createInvoice(
            Number(seat.price),
            String(seat.number), // banking service expects seat number as the id
            `Ticket for Seat ${seat.row}-${seat.number}`,
            myReference, // External ticket reference for banking service
            seat.event.organizer.paymentApiKey,
            webhookUrl
        );

        return {
            status: 'pending_payment',
            reservationId: reservation.id,
            invoiceId: invoiceResponse.invoiceId,
            expiresAt: reservation.expiresAt,
        };
    }

    async finalizeBooking(referenceString: string, transactionId: string) {
        return await prisma.$transaction(async (tx) => {
            const reservation = await tx.reservation.findUnique({
                where: { id: referenceString },
                include: { seat: true },
            });

            if (!reservation) {
                const existingBooking = await tx.booking.findFirst({
                    where: { seatId: transactionId },
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

            await tx.seat.update({
                where: { id: reservation.seatId },
                data: {
                    status: 'BOOKED',
                    version: { increment: 1 },
                },
            });

            await tx.reservation.delete({
                where: { id: referenceString }, //
            });

            return booking;
        });
    }

    async releaseReservation(reservationId: string) {
        return await prisma.$transaction(async (tx) => {
            const reservation = await tx.reservation.findUnique({
                where: { id: reservationId },
            });

            if (!reservation) {
                console.log(
                    `Reservation ${reservationId} not found or already released.`
                );
                return { released: false, message: 'Reservation not found' };
            }

            // Delete the reservation
            await tx.reservation.delete({
                where: { id: reservationId },
            });

            // Reset the seat to AVAILABLE
            await tx.seat.update({
                where: { id: reservation.seatId },
                data: {
                    status: 'AVAILABLE',
                    version: { increment: 1 },
                },
            });

            console.log(
                `Reservation ${reservationId} released, seat ${reservation.seatId} now available.`
            );
            return { released: true, seatId: reservation.seatId };
        });
    }
}

export const bookingService = new BookingService();
