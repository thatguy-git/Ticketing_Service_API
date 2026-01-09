import { prisma } from '../configs/db';
import { AppError } from '../utils/AppError';

const HOLD_DURATION_MINUTES = 10;

export class ReservationService {
    async holdSeat(userId: string, seatId: string) {
        const seat = await prisma.seat.findUnique({ where: { id: seatId } });

        if (!seat) throw new AppError('Seat not found', 404);
        if (seat.status !== 'AVAILABLE')
            throw new AppError('Seat is not available', 409);

        const result = await prisma.$transaction(async (tx) => {
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
                expiresAt.getMinutes() + HOLD_DURATION_MINUTES
            );

            const reservation = await tx.reservation.create({
                data: {
                    userId,
                    seatId,
                    expiresAt,
                },
            });

            return reservation;
        });

        return result;
    }
}

export const reservationService = new ReservationService();
