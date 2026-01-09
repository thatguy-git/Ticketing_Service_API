import { Request, Response } from 'express';
import { eventService } from '../services/eventService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export const createEvent = asyncHandler(async (req: Request, res: Response) => {
    const { name, date, rows, seatsPerRow, price } = req.body;

    if (!name || !date || !rows || !seatsPerRow || !price) {
        throw new AppError(
            'Missing details (name, date, rows, seatsPerRow, price)',
            400
        );
    }

    const event = await eventService.createEvent(
        name,
        date,
        rows,
        seatsPerRow,
        price
    );

    res.status(201).json({
        status: 'success',
        data: { event },
        message: `Event created with ${rows * seatsPerRow} seats!`,
    });
});

export const getEvents = asyncHandler(async (req: Request, res: Response) => {
    const events = await eventService.getEvents();
    res.status(200).json({ status: 'success', data: { events } });
});

export const getEventSeats = asyncHandler(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const seats = await eventService.getEventSeats(id);
        res.status(200).json({
            status: 'success',
            results: seats.length,
            data: { seats },
        });
    }
);
