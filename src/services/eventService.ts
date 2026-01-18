import { prisma } from '../configs/db';
import { redis } from '../configs/redis';
import { AppError } from '../utils/AppError';
import { toMinorUnit, toMajorUnit } from '../utils/money';

export class EventService {
    async createEvent(
        name: string,
        date: string,
        rowCount: number,
        seatsPerRow: number,
        price: number,
        organizerId: string,
    ) {
        const event = await prisma.$transaction(async (tx) => {
            const newEvent = await tx.event.create({
                data: {
                    name,
                    date: new Date(date),
                    organizerId,
                },
            });

            const seatsData = [];
            const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

            for (let r = 0; r < rowCount; r++) {
                const rowLabel = rows[r] || `Row${r + 1}`;
                for (let s = 1; s <= seatsPerRow; s++) {
                    seatsData.push({
                        eventId: newEvent.id,
                        row: rowLabel,
                        number: s,
                        price: toMinorUnit(price),
                        status: 'AVAILABLE',
                        version: 0,
                    });
                }
            }

            await tx.seat.createMany({
                data: seatsData as any,
            });

            return newEvent;
        });

        return event;
    }

    async getEvents() {
        return await prisma.event.findMany({
            orderBy: { date: 'asc' },
        });
    }

    async getEventSeats(eventId: string) {
        const cacheKey = `event:${eventId}:seats`;

        const cachedSeats = await redis.get(cacheKey);
        if (cachedSeats) {
            console.log('⚡ Serving seats from Redis Cache');
            return JSON.parse(cachedSeats);
        }

        console.log('🐢 Fetching seats from Postgres');
        const seats = await prisma.seat.findMany({
            where: { eventId },
            orderBy: [{ row: 'asc' }, { number: 'asc' }],
        });

        if (!seats.length) {
            throw new AppError('Event not found or no seats available', 404);
        }

        // 👇 STEP 1: Convert BigInt (27000n) to Major Unit Number (270)
        const formattedSeats = seats.map((seat) => ({
            ...seat,
            price: toMajorUnit(seat.price),
        }));

        // 👇 STEP 2: Cache the FORMATTED data (Numbers, not BigInts)
        await redis.set(cacheKey, JSON.stringify(formattedSeats), 'EX', 10);

        return formattedSeats;
    }
}

export const eventService = new EventService();
