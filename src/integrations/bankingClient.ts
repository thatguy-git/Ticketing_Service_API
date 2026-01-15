import axios from 'axios';
import { AppError } from '../utils/AppError';

if (!process.env.BANKING_SERVICE_URL || !process.env.YOUR_BANK_API_KEY) {
    throw new Error(
        'Banking service configuration is missing in environment variables'
    );
}
const BANKING_URL = process.env.BANKING_SERVICE_URL;
const MERCHANT_API_KEY = process.env.YOUR_BANK_API_KEY;

export const bankingClient = {
    async createInvoice(
        amount: number,
        reference: string,
        description: string
    ) {
        try {
            const response = await axios.post(
                `${BANKING_URL}/invoices`,
                {
                    amount,
                    reference,
                    description,
                },
                {
                    headers: {
                        'api-key': MERCHANT_API_KEY,
                    },
                }
            );

            return {
                success: true,
                invoiceId: response.data.invoiceId,
                status: response.data.status,
            };
        } catch (error: any) {
            console.error(
                'Banking API Error:',
                error.response?.data || error.message
            );

            const msg =
                error.response?.data?.message || 'Banking service unavailable';
            throw new AppError(msg, 503);
        }
    },

    //not functional yet
    async refundPayment(transactionId: string) {
        try {
            await axios.post(
                `${BANKING_URL}/api/refund`,
                { transactionId },
                {
                    headers: {
                        'x-api-key': MERCHANT_API_KEY, // Only the Merchant can refund their own transactions
                    },
                }
            );
            console.log(`Refunded transaction: ${transactionId}`);
        } catch (error) {
            console.error(
                `CRITICAL: Refund failed for ${transactionId}`,
                error
            );
            throw new AppError('Refund failed', 500);
        }
    },
};
