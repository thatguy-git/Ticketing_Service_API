import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

declare global {
    namespace Express {
        interface Request {
            validated?: {
                body?: any;
                query?: any;
                params?: any;
                headers?: any;
            };
        }
    }
}

export const validate =
    (schema: z.ZodObject<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
        try {
            const validatedData = schema.parse({
                body: req.body,
                query: req.query,
                params: req.params,
                headers: req.headers,
            });
            req.validated = validatedData;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const cleanErrors = error.issues.map((issue: z.ZodIssue) => {
                    const field = issue.path[1] || issue.path[0];
                    return {
                        field: String(field),
                        message: issue.message,
                    };
                });

                return res.status(400).json({
                    status: 'fail',
                    message: 'Validation failed',
                    errors: cleanErrors,
                });
            }
            next(error);
        }
    };
