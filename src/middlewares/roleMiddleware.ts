import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from './authMiddleware';

export const checkRole = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const authReq = req as AuthenticatedRequest;

        if (!authReq.user) {
            return next(new AppError('User not authenticated', 401));
        }

        const userRole = authReq.user.role;

        if (!userRole || !allowedRoles.includes(userRole)) {
            return next(
                new AppError(
                    `Access denied. You need one of these roles: ${allowedRoles.join(
                        ', '
                    )}`,
                    403
                )
            );
        }

        next();
    };
};
