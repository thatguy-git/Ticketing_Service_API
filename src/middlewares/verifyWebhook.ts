import { Request, Response, NextFunction } from 'express';

export const verifyBankSignature = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const signature = req.headers['x-webhook-signature'];

    if (signature !== process.env.WEBHOOK_SECRET) {
        console.warn('Security Alert: Invalid Webhook Signature');
        return res.status(401).json({ message: 'Unauthorized' });
    }

    next();
};
