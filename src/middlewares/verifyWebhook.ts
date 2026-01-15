import { Request, Response, NextFunction } from 'express';

export const verifyBankSignature = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const signature = req.headers['x-webhook-signature'];
    const expectedSignature = process.env.WEBHOOK_SECRET;

    // 1. Check if signature is missing entirely
    if (!signature) {
        return res
            .status(401)
            .json({ message: 'Unauthorized: Missing Signature' });
    }

    // 2. Check if signature is wrong (Security Alert!)
    if (signature !== expectedSignature) {
        console.warn(
            `🚨 Security Alert: Invalid Webhook Signature received from IP ${req.ip}`
        );
        return res
            .status(403)
            .json({ message: 'Forbidden: Invalid Signature' });
    }

    next();
};
