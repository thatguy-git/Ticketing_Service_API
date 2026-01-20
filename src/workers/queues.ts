import { Queue } from 'bullmq';
import { redis } from '../configs/redis';

// Email Queue for sending ticket confirmations
export const emailQueue = new Queue('email-queue', {
    connection: redis,
    defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 100,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
    },
});

// Job types
export interface SendTicketEmailJob {
    userEmail: string;
    userName: string;
    bookingId: string;
    eventName: string;
    eventDate: string;
    seatRow: string;
    seatNumber: number;
    price: number;
    bookingReference: string;
}