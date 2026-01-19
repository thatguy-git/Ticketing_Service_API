import { prisma } from '../configs/db';
import { reservationService } from './reservationService';
import { bankingClient } from '../integrations/bankingClient';
import { AppError } from '../utils/AppError';
import { v4 as uuidv4 } from 'uuid';

export class BookingService {
    async initiateBooking(userId: string, seatId: string) {
        const myReference = `TKT-${uuidv4()}`;
        const reservation = await reservationService.holdSeat(
            userId,
            seatId,
            myReference,
        );
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
                400,
            );
        }

        // Build webhook URL for the banking service to call back to
        const webhookUrl =
            process.env.WEBHOOK_BASE_URL ||
            `http://localhost:${process.env.PORT || 4000}/api/webhooks/bank`;

        // Use the same expiration time as the reservation for consistency
        const invoiceExpiresAt = reservation.expiresAt;

        // Create the Invoice on Banking Service using organizer's API key
        const invoiceResponse = await bankingClient.createInvoice(
            Number(seat.price),
            String(seat.number), // banking service expects seat number as the id
            `Ticket for Seat ${seat.row}-${seat.number}`,
            myReference, // External ticket reference for banking service
            seat.event.organizer.paymentApiKey,
            webhookUrl,
            invoiceExpiresAt,
        );

        // Update the reservation with the invoice ID
        await prisma.reservation.update({
            where: { id: reservation.id },
            data: { invoiceId: invoiceResponse.invoiceId },
        });

        return {
            status: 'pending_payment',
            reservationId: reservation.id,
            invoiceId: invoiceResponse.invoiceId,
            expiresAt: reservation.expiresAt,
        };
    }

    async finalizeBooking(referenceString: string, transactionId: string) {
        return await prisma.$transaction(async (tx) => {
            console.log(
                `🔍 Looking for reservation with reference/id: ${referenceString}`,
            );

            // Try to find by reference first, then by id
            let reservation = await tx.reservation.findUnique({
                where: { reference: referenceString },
                include: { seat: true },
            });

            if (!reservation) {
                console.log(`❌ Not found by reference, trying by id`);
                reservation = await tx.reservation.findUnique({
                    where: { id: referenceString },
                    include: { seat: true },
                });
            }

            if (!reservation) {
                console.log(`❌ Reservation not found at all`);
                const existingBooking = await tx.booking.findFirst({
                    where: { transactionId: transactionId },
                });

                if (existingBooking) {
                    console.log('✅ Booking already exists, skipping...');
                    return existingBooking;
                }

                throw new AppError(
                    'Reservation expired or not found. Manual Refund needed.',
                    400,
                );
            }

            console.log(
                `✅ Found reservation: ${reservation.id}, expiresAt: ${reservation.expiresAt}, seat status: ${reservation.seat.status}`,
            );

            // Check if reservation has expired
            if (reservation.expiresAt < new Date()) {
                console.log(
                    `❌ Reservation expired at ${reservation.expiresAt}`,
                );
                throw new AppError(
                    'Reservation expired or not found. Manual Refund needed.',
                    400,
                );
            }

            // Check if seat is still held
            if (reservation.seat.status !== 'HELD') {
                console.log(
                    `❌ Seat is no longer held, status: ${reservation.seat.status}`,
                );

                // If seat is available and payment was successful, try to book it anyway
                if (reservation.seat.status === 'AVAILABLE') {
                    console.log(
                        `🔄 Seat became available, attempting to book it`,
                    );

                    // Check if seat can be booked (optimistic locking)
                    const updatedSeat = await tx.seat.updateMany({
                        where: {
                            id: reservation.seatId,
                            status: 'AVAILABLE',
                            version: reservation.seat.version,
                        },
                        data: {
                            status: 'BOOKED',
                            version: { increment: 1 },
                        },
                    });

                    if (updatedSeat.count === 0) {
                        console.log(`❌ Seat was taken by someone else`);
                        throw new AppError(
                            'Seat taken by another user. Manual Refund needed.',
                            400,
                        );
                    }

                    // Create booking even though reservation expired
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

                    // Clean up the expired reservation
                    await tx.reservation.delete({
                        where: { id: reservation.id },
                    });

                    console.log(
                        `✅ Created booking for expired reservation: ${booking.id}`,
                    );
                    return booking;
                } else {
                    // Seat is booked by someone else
                    throw new AppError(
                        'Seat is no longer available. Manual Refund needed.',
                        400,
                    );
                }
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
                where: { id: reservation.id }, //
            });

            return booking;
        });
    }

    async releaseReservation(referenceOrId: string) {
        return await prisma.$transaction(async (tx) => {
            // Try to find by reference first, then by id
            let reservation = await tx.reservation.findUnique({
                where: { reference: referenceOrId },
            });

            if (!reservation) {
                reservation = await tx.reservation.findUnique({
                    where: { id: referenceOrId },
                });
            }

            if (!reservation) {
                console.log(
                    `Reservation ${referenceOrId} not found or already released.`,
                );
                return { released: false, message: 'Reservation not found' };
            }

            // Delete the reservation
            await tx.reservation.delete({
                where: { id: reservation.id },
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
                `Reservation ${referenceOrId} released, seat ${reservation.seatId} now available.`,
            );
            return { released: true, seatId: reservation.seatId };
        });
    }
}

export const bookingService = new BookingService();
