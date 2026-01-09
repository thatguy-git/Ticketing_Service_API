import { prisma } from '../configs/db';
import { redis } from '../configs/redis';
import { AppError } from '../utils/AppError';

export class EventService {
    // 1. CREATE EVENT & SEED SEATS
    // We simulate a venue with 'rowCount' rows and 'seatsPerRow' columns
    async createEvent(
        name: string,
        date: string,
        rowCount: number,
        seatsPerRow: number,
        price: number
    ) {
        // Transaction: Create Event AND Seats together (or fail together)
        const event = await prisma.$transaction(async (tx) => {
            // A. Create the Event
            const newEvent = await tx.event.create({
                data: {
                    name,
                    date: new Date(date),
                },
            });

            // B. Generate Seats (e.g., Row A1..A10, B1..B10)
            const seatsData = [];
            const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // Row labels

            for (let r = 0; r < rowCount; r++) {
                const rowLabel = rows[r] || `Row${r + 1}`; // Handle >26 rows gracefully
                for (let s = 1; s <= seatsPerRow; s++) {
                    seatsData.push({
                        eventId: newEvent.id,
                        row: rowLabel,
                        number: s,
                        price: price, // Flat price for simplicity
                        status: 'AVAILABLE',
                        version: 0,
                    });
                }
            }

            // Bulk Insert Seats
            // Note: createMany is supported in Postgres
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
        await redis.set(cacheKey, JSON.stringify(seats), 'EX', 10);
        return seats;
    }
}

export const eventService = new EventService();
