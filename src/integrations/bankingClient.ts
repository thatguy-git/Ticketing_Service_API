import axios from 'axios';
import { AppError } from '../utils/AppError';

if (!process.env.BANKING_SERVICE_URL) {
    throw new Error(
        'Banking service configuration is missing in environment variables'
    );
}
const BANKING_URL = process.env.BANKING_SERVICE_URL;

export const bankingClient = {
    async createInvoice(
        amount: number,
        reservationId: string,
        description: string,
        ticketReference: string,
        apiKey: string
    ) {
        try {
            const url = BANKING_URL.includes(':id')
                ? BANKING_URL.replace(':id', reservationId)
                : BANKING_URL;

            const response = await axios.post(
                url,
                {
                    amount,
                    reference: ticketReference,
                    description,
                },
                {
                    headers: {
                        // include multiple common header names in case the banking service
                        // expects a different header (some services use x-api-key, others api-key,
                        // and some expect an Authorization Bearer token)
                        'x-api-key': apiKey,
                        'api-key': apiKey,
                        Authorization: `Bearer ${apiKey}`,
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
    async refundPayment(transactionId: string, apiKey: string) {
        try {
            await axios.post(
                `${BANKING_URL}/api/refund`,
                { transactionId },
                {
                    headers: {
                        'x-api-key': apiKey, // Only the Merchant can refund their own transactions
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
