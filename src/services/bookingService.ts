import { prisma } from '../configs/db';
import { reservationService } from './reservationService';
import { bankingClient } from '../integrations/bankingClient';
import { AppError } from '../utils/AppError';

export class BookingService {
    async initiateBooking(userId: string, seatId: string) {
        const reservation = await reservationService.holdSeat(userId, seatId);
        const seat = await prisma.seat.findUnique({ where: { id: seatId } });
        if (!seat) throw new AppError('Seat data corrupted', 500);

        // Create the Invoice on Banking Service
        // We link the 'reference' to our Reservation ID so we can track it later
        const invoiceResponse = await bankingClient.createInvoice(
            Number(seat.price),
            reservation.id, // REFERENCE: This connects Payment -> Reservation
            `Ticket for Seat ${seat.row}-${seat.number}`
        );

        return {
            status: 'pending_payment',
            reservationId: reservation.id,
            invoiceId: invoiceResponse.invoiceId,
            expiresAt: reservation.expiresAt,
        };
    }

    async finalizeBooking(reservationId: string, transactionId: string) {
        return await prisma.$transaction(async (tx) => {
            const reservation = await tx.reservation.findUnique({
                where: { id: reservationId },
                include: { seat: true },
            });

            if (!reservation) {
                const existingBooking = await tx.booking.findFirst({
                    where: { seatId: reservationId },
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
                where: { id: reservationId },
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
