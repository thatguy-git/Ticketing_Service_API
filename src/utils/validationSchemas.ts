import { z } from 'zod';

// Body Schemas
const registerBodySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
});

const verifyEmailBodySchema = z.object({
    email: z.email('Invalid email format'),
    otp: z.string().min(1, 'OTP is required'),
});

const loginBodySchema = z.object({
    email: z.email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

const createBookingBodySchema = z.object({
    seatId: z.string().min(1, 'Seat ID is required'),
});

const createEventBodySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    date: z.string().min(1, 'Date is required'),
    rows: z.number().int().positive('Rows must be a positive integer'),
    seatsPerRow: z
        .number()
        .int()
        .positive('Seats per row must be a positive integer'),
    price: z.number().positive('Price must be positive'),
});

// headers and param schema
const getEventSeats = z.object({
    eventId: z.uuid({ message: 'Invalid Seat ID' }),
});

export const registerValidationSchema = z.object({
    body: registerBodySchema,
});

export const verifyEmailValidationSchema = z.object({
    body: verifyEmailBodySchema,
});

export const loginValidationSchema = z.object({
    body: loginBodySchema,
});

export const createBookingValidationSchema = z.object({
    body: createBookingBodySchema,
});

export const createEventValidationSchema = z.object({
    body: createEventBodySchema,
});

export const getEventSeatsValidationSchema = z.object({
    params: getEventSeats,
});
