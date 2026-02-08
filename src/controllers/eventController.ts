import { Request, Response } from 'express';
import { eventService } from '../services/eventService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

export const createEvent = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
        const { name, date, rows, seatsPerRow, price } = req.validated!.body;
        const organizerId = req.user.id;

        if (req.user.role !== 'ORGANIZER' && req.user.role !== 'ADMIN') {
            throw new AppError(
                'Only organizers and admins can create events',
                403,
            );
        }

        const event = await eventService.createEvent(
            name,
            date,
            rows,
            seatsPerRow,
            price,
            organizerId,
        );

        res.status(201).json({
            status: 'success',
            data: { event },
            message: `Event created with ${rows * seatsPerRow} seats!`,
        });
    },
);

export const getEvents = asyncHandler(async (req: Request, res: Response) => {
    const events = await eventService.getEvents();
    res.status(200).json({
        status: 'success',
        data: { events },
    });
});

export const getEventSeats = asyncHandler(
    async (req: Request, res: Response) => {
        const id = req.validated!.params.eventId;
        const seats = await eventService.getEventSeats(id);
        res.status(200).json({
            status: 'success',
            results: seats.length,
            data: { seats },
        });
    },
);
