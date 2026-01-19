import { prisma } from '../configs/db';
import { AppError } from '../utils/AppError';

const HOLD_DURATION_MINUTES = 15;

import { v4 as uuidv4 } from 'uuid'; // 👈 Make sure to import this at the top
// ... other imports

export class ReservationService {
    async holdSeat(userId: string, seatId: string, reference?: string) {
        const seat = await prisma.seat.findUnique({ where: { id: seatId } });

        if (!seat) throw new AppError('Seat not found', 404);

        const result = await prisma.$transaction(async (tx) => {
            // 1. Check if held but expired (Cleanup logic)
            if (seat.status === 'HELD') {
                const reservation = await tx.reservation.findFirst({
                    where: { seatId },
                });

                if (!reservation) {
                    throw new AppError(
                        'Data inconsistency: Seat is HELD but no reservation found',
                        500,
                    );
                }

                if (reservation && reservation.expiresAt < new Date()) {
                    await tx.reservation.delete({
                        where: { id: reservation.id },
                    });
                    await tx.seat.update({
                        where: { id: seatId },
                        data: {
                            status: 'AVAILABLE',
                            version: { increment: 1 },
                        },
                    });

                    // Update local object so the next check passes
                    seat.status = 'AVAILABLE';
                    seat.version += 1;
                }
            }

            if (seat.status !== 'AVAILABLE') {
                let message = 'Seat is not available';
                if (seat.status === 'BOOKED') {
                    message = 'seat is already booked';
                } else if (seat.status === 'HELD') {
                    message = 'seat is held';
                }
                throw new AppError(message, 409);
            }

            // 2. Optimistic Concurrency Lock
            const updatedBatch = await tx.seat.updateMany({
                where: {
                    id: seatId,
                    version: seat.version,
                    status: 'AVAILABLE',
                },
                data: {
                    status: 'HELD',
                    version: { increment: 1 },
                },
            });

            if (updatedBatch.count === 0) {
                throw new AppError('Seat was just taken by someone else', 409);
            }

            const expiresAt = new Date();
            expiresAt.setMinutes(
                expiresAt.getMinutes() + HOLD_DURATION_MINUTES,
            ); // Hardcoded or use constant

            // 3. 👇 GENERATE REFERENCE HERE
            const myReference = reference || `TKT-${uuidv4()}`;

            const reservation = await tx.reservation.create({
                data: {
                    userId,
                    seatId,
                    expiresAt,
                    reference: myReference, // 👈 ADDED THIS
                },
            });

            return reservation;
        });

        return result;
    }
}

export const reservationService = new ReservationService();
