import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export const register = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        throw new AppError('Name, email, and password are required', 400);
    }
    const result = await authService.register(name, email, password);
    res.status(201).json({
        status: 'success',
        message: result.message,
    });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        throw new AppError('Email and OTP are required', 400);
    }
    const { user, token } = await authService.verifyEmail(email, otp);
    res.status(200).json({
        status: 'success',
        token,
        data: {
            user: {
                id: user.id,
                email: user.email,
                isVerified: user.isVerified,
            },
        },
    });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new AppError('Email and password are required', 400);
    }
    const { user, token } = await authService.login(email, password);
    res.status(200).json({
        status: 'success',
        token,
        data: {
            user: {
                id: user.id,
                email: user.email,
            },
        },
    });
});
