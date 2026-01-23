import { Request, Response, NextFunction } from 'express';
import { bookingService } from '../services/bookingService';
import { AppError } from '../utils/AppError';
// Import your custom Request interface if you have one, or rely on global types
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

export class BookingController {
    // 1️⃣ USER ACTION: Start the Booking
    // Route: POST /api/bookings
    // Body: { "seatId": "..." }
    static async createBooking(
        req: Request,
        res: Response,
        next: NextFunction,
    ) {
        try {
            // Cast to your custom interface to access user.id
            const userId = (req as AuthenticatedRequest).user?.id;
            const { seatId } = req.validated!.body;

            if (!userId) {
                throw new AppError('User not authenticated', 401);
            }

            // Call the service to Hold the Seat & Create Invoice
            const result = await bookingService.initiateBooking(userId, seatId);

            res.status(201).json({
                status: 'success',
                message: 'Seat reserved. Please complete payment.',
                data: {
                    reservationId: result.reservationId,
                    invoiceId: result.invoiceId, // 👈 Frontend sends this to the Bank
                    expiresAt: result.expiresAt,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    // 2️⃣ SYSTEM ACTION: Handle Payment Success
    // Route: POST /api/bookings/webhook
    // This is called by the BANKING SERVICE, not the user
}
