const dotenv = require('dotenv');
dotenv.config();

const { emailService } = require('../src/services/emailService');

async function testEmailDirectly() {
    console.log('Testing email service directly...');

    const testBookingData = {
        userEmail: 'nnaemekadavid1400@gmail.com',
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
        console.log('📄 Generating PDF...');
        const pdfBuffer = await emailService.generateTicketPDF(testBookingData);
        console.log(`✅ PDF generated (${pdfBuffer.length} bytes)`);

        console.log('📧 Sending email...');
        await emailService.sendTicketEmail(
            testBookingData.userEmail,
            testBookingData.userName,
            testBookingData,
            pdfBuffer,
        );

        console.log('Email test completed successfully!');
    } catch (error) {
        console.error('Email test failed:', error.message);
    }
}

testEmailDirectly();
