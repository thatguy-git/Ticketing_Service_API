import { prisma } from '../configs/db';
import { reservationService } from './reservationService';
import { bankingClient } from '../integrations/bankingClient';
import { AppError } from '../utils/AppError';
import { v4 as uuidv4 } from 'uuid';
import { emailQueue } from '../workers/queues';
import { toMajorUnit } from '../utils/money';

export class BookingService {
    async initiateBooking(userId: string, seatId: string) {
        const myReference = `TKT-${uuidv4()}`;

        // 1. Hold the seat first
        const reservation = await reservationService.holdSeat(
            userId,
            seatId,
            myReference,
        );

        // 2. Fetch seat details including Organizer Key
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

        // Build webhook URL
        const webhookUrl =
            process.env.WEBHOOK_BASE_URL ||
            `http://localhost:${process.env.PORT || 4000}/api/webhooks/bank`;

        const invoiceExpiresAt = reservation.expiresAt;

        // 3. Create Invoice
        const invoiceResponse = await bankingClient.createInvoice(
            Number(seat.price),
            String(seat.number),
            `Ticket for Seat ${seat.row}-${seat.number}`,
            myReference,
            seat.event.organizer.paymentApiKey,
            webhookUrl, // Pass webhook URL so Bank can call us back
            invoiceExpiresAt,
        );

        // 4. Update Reservation with Invoice ID
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
        // 👇 FIX 1: Capture the return value of the transaction in a variable
        const createdBooking = await prisma.$transaction(async (tx) => {
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

            // Handle "Ghost" Reservations (Already Booked or Expired/Deleted)
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
                `✅ Found reservation: ${reservation.id}, expiresAt: ${reservation.expiresAt}`,
            );

            // PATH A: Seat is no longer HELD (Expired logic)
            if (reservation.seat.status !== 'HELD') {
                console.log(
                    `❌ Seat is no longer held, status: ${reservation.seat.status}`,
                );

                // If seat is AVAILABLE, we can try to save the booking (Race Condition Recovery)
                if (reservation.seat.status === 'AVAILABLE') {
                    console.log(
                        `🔄 Seat became available, attempting to book it`,
                    );

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
                        throw new AppError(
                            'Seat taken by another user. Manual Refund needed.',
                            400,
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

                    await tx.reservation.delete({
                        where: { id: reservation.id },
                    });

                    return booking; // Early return for this path
                } else {
                    throw new AppError(
                        'Seat is no longer available. Manual Refund needed.',
                        400,
                    );
                }
            }

            // PATH B: Standard Booking (Seat is HELD and Valid)
            if (reservation.expiresAt < new Date()) {
                throw new AppError(
                    'Reservation expired. Manual Refund needed.',
                    400,
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
                where: { id: reservation.id },
            });

            return booking;
        });

        // 👇 FIX 2: Email Logic is now OUTSIDE transaction, using 'createdBooking'
        try {
            const user = await prisma.user.findUnique({
                where: { id: createdBooking.userId },
                select: { name: true, email: true },
            });

            const seatWithEvent = await prisma.seat.findUnique({
                where: { id: createdBooking.seatId },
                include: { event: true },
            });

            if (user && seatWithEvent) {
                await emailQueue.add('SEND_TICKET_EMAIL', {
                    userEmail: user.email,
                    userName: user.name,
                    bookingId: createdBooking.id,
                    eventName: seatWithEvent.event.name,
                    eventDate: seatWithEvent.event.date.toISOString(),
                    seatRow: seatWithEvent.row,
                    seatNumber: seatWithEvent.number,
                    price: toMajorUnit(createdBooking.amount),
                    // 👇 FIX 3: Use the argument 'referenceString' since reservation is deleted
                    bookingReference: referenceString,
                });

                console.log(`📧 Ticket email queued for ${user.email}`);
            }
        } catch (emailError) {
            console.error('Failed to queue ticket email:', emailError);
            // We do NOT throw here, because the booking is already confirmed.
        }

        return createdBooking;
    }

    async releaseReservation(referenceOrId: string) {
        return await prisma.$transaction(async (tx) => {
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

            await tx.reservation.delete({
                where: { id: reservation.id },
            });

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
