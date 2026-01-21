import { Worker } from 'bullmq';
import { redis } from '../configs/redis';
import { emailService } from '../services/emailService';
import { SendTicketEmailJob, emailQueue } from './queues';

// Email Worker
const emailWorker = new Worker(
    'email-queue',
    async (job) => {
        console.log(
            `📧 Email worker received job: ${job.id}, type: ${job.name}`,
        );
        const { name, data } = job;

        switch (name) {
            case 'SEND_TICKET_EMAIL':
                console.log(
                    `📧 Processing SEND_TICKET_EMAIL job for ${data.userEmail}`,
                );
                await emailService.processTicketEmail(
                    data as SendTicketEmailJob,
                );
                break;

            default:
                throw new Error(`Unknown job type: ${name}`);
        }
    },
    {
        connection: redis,
        concurrency: 5, // Process up to 5 emails simultaneously
        limiter: {
            max: 10, // Max 10 jobs per duration
            duration: 1000, // Per second
        },
    },
);

// Event handlers
emailWorker.on('completed', (job) => {
    console.log(`✅ Email job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
    console.error(`❌ Email job ${job?.id} failed:`, err.message);
});

emailWorker.on('stalled', (jobId) => {
    console.warn(`⚠️ Email job ${jobId} stalled`);
});

console.log('📧 Email worker started and listening for jobs...');

export { emailWorker };
