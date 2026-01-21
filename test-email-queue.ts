// Test script to check email queue functionality
import { emailQueue } from './src/workers/queues';
import { SendTicketEmailJob } from './src/workers/queues';

async function testEmailQueue() {
    console.log('🧪 Testing email queue...');

    const testJob: SendTicketEmailJob = {
        userEmail: 'test@example.com',
        userName: 'Test User',
        bookingId: 'test-booking-id',
        eventName: 'Test Event',
        eventDate: new Date().toISOString(),
        seatRow: 'A',
        seatNumber: 1,
        price: 25.0,
        bookingReference: 'TKT-TEST123',
    };

    try {
        const job = await emailQueue.add('SEND_TICKET_EMAIL', testJob);
        console.log(`✅ Test email job added to queue with ID: ${job.id}`);

        // Wait a bit to see if worker processes it
        setTimeout(() => {
            console.log(
                '🧪 Test completed. Check logs above for worker processing.',
            );
        }, 5000);
    } catch (error) {
        console.error('❌ Failed to add test job to queue:', error);
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    testEmailQueue();
}

export { testEmailQueue };
