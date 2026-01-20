import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { AppError } from '../utils/AppError';
import { SendTicketEmailJob } from '../workers/queues';

// Email configuration
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export class EmailService {
    /**
     * Generate a PDF ticket with QR code
     */
    async generateTicketPDF(bookingData: SendTicketEmailJob): Promise<Buffer> {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A6',
                    margin: 30,
                });

                const buffers: Buffer[] = [];

                doc.on('data', (chunk) => buffers.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(buffers)));
                doc.on('error', reject);

                // Generate QR code data
                const qrData = JSON.stringify({
                    bookingId: bookingData.bookingId,
                    reference: bookingData.bookingReference,
                    seat: `${bookingData.seatRow}${bookingData.seatNumber}`,
                    timestamp: Date.now(),
                });

                const qrCodeDataURL = await QRCode.toDataURL(qrData, {
                    width: 150,
                    margin: 1,
                });

                // PDF Layout
                const pageWidth = doc.page.width;
                const pageHeight = doc.page.height;

                // Header
                doc.fontSize(16).font('Helvetica-Bold').text('EVENT TICKET', {
                    align: 'center',
                });

                doc.moveDown(0.5);

                // Border
                doc.rect(20, 20, pageWidth - 40, pageHeight - 40).stroke();

                // Event Details
                doc.fontSize(12).font('Helvetica-Bold');
                doc.text('Event:', 40, 80);
                doc.font('Helvetica').text(bookingData.eventName, 100, 80);

                doc.font('Helvetica-Bold').text('Date:', 40, 100);
                doc.font('Helvetica').text(
                    new Date(bookingData.eventDate).toLocaleDateString(),
                    100,
                    100,
                );

                doc.font('Helvetica-Bold').text('Seat:', 40, 120);
                doc.font('Helvetica').text(
                    `${bookingData.seatRow}-${bookingData.seatNumber}`,
                    100,
                    120,
                );

                doc.font('Helvetica-Bold').text('Price:', 40, 140);
                doc.font('Helvetica').text(`$${bookingData.price}`, 100, 140);

                doc.font('Helvetica-Bold').text('Reference:', 40, 160);
                doc.font('Helvetica').text(
                    bookingData.bookingReference,
                    100,
                    160,
                );

                // QR Code
                if (qrCodeDataURL) {
                    // Convert data URL to buffer and add to PDF
                    const qrImage = qrCodeDataURL.split(',')[1];
                    const qrBuffer = Buffer.from(qrImage, 'base64');

                    doc.image(qrBuffer, pageWidth / 2 - 75, 200, {
                        width: 150,
                        height: 150,
                    });
                }

                // Footer
                doc.fontSize(8)
                    .font('Helvetica')
                    .text(
                        'Valid for entry on event date only. Please present this ticket at the venue.',
                        40,
                        pageHeight - 60,
                        {
                            width: pageWidth - 80,
                            align: 'center',
                        },
                    );

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Send ticket email with PDF attachment
     */
    async sendTicketEmail(
        userEmail: string,
        userName: string,
        bookingData: SendTicketEmailJob,
        pdfBuffer: Buffer,
    ): Promise<void> {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: userEmail,
                subject: `Your Ticket for ${bookingData.eventName}`,
                html: this.generateTicketEmailHTML(userName, bookingData),
                attachments: [
                    {
                        filename: `ticket-${bookingData.bookingReference}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                    },
                ],
            };

            const info = await transporter.sendMail(mailOptions);
            console.log(
                `✅ Ticket email sent to ${userEmail}: ${info.messageId}`,
            );
        } catch (error) {
            console.error(
                `❌ Failed to send ticket email to ${userEmail}:`,
                error,
            );
            throw new AppError('Failed to send ticket email', 500);
        }
    }

    /**
     * Generate HTML email content
     */
    private generateTicketEmailHTML(
        userName: string,
        bookingData: SendTicketEmailJob,
    ): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Your Event Ticket</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f9f9f9; }
                    .ticket-details { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎫 Your Ticket is Confirmed!</h1>
                    </div>

                    <div class="content">
                        <p>Hi ${userName},</p>

                        <p>Thank you for your purchase! Your ticket for <strong>${
                            bookingData.eventName
                        }</strong> has been confirmed.</p>

                        <div class="ticket-details">
                            <h3>Ticket Details:</h3>
                            <ul>
                                <li><strong>Event:</strong> ${bookingData.eventName}</li>
                                <li><strong>Date:</strong> ${new Date(
                                    bookingData.eventDate,
                                ).toLocaleDateString()}</li>
                                <li><strong>Seat:</strong> ${
                                    bookingData.seatRow
                                }-${bookingData.seatNumber}</li>
                                <li><strong>Price:</strong> $${bookingData.price}</li>
                                <li><strong>Booking Reference:</strong> ${
                                    bookingData.bookingReference
                                }</li>
                            </ul>
                        </div>

                        <p>Your ticket is attached as a PDF file. Please bring it with you to the event. The QR code on the ticket will be scanned for entry.</p>

                        <p>If you have any questions, please contact our support team.</p>

                        <p>Enjoy the event!</p>
                    </div>

                    <div class="footer">
                        <p>This is an automated message. Please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Process email job (called by worker)
     */
    async processTicketEmail(jobData: SendTicketEmailJob): Promise<void> {
        try {
            console.log(
                `📧 Processing ticket email for booking ${jobData.bookingId}`,
            );

            // Generate PDF
            const pdfBuffer = await this.generateTicketPDF(jobData);

            // Send email
            await this.sendTicketEmail(
                jobData.userEmail,
                jobData.userName,
                jobData,
                pdfBuffer,
            );

            console.log(
                `✅ Ticket email processed successfully for ${jobData.userEmail}`,
            );
        } catch (error) {
            console.error(`❌ Failed to process ticket email:`, error);
            throw error;
        }
    }
}

export const emailService = new EmailService();
