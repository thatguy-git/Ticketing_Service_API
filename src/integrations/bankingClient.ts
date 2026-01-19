import axios from 'axios';
import { AppError } from '../utils/AppError';

if (!process.env.BANKING_SERVICE_URL) {
    throw new Error(
        'Banking service configuration is missing in environment variables',
    );
}
const BANKING_URL = process.env.BANKING_SERVICE_URL;

export const bankingClient = {
    async createInvoice(
        amount: number,
        reservationId: string,
        description: string,
        ticketReference: string,
        apiKey: string,
        webhookUrl?: string,
        expiresAt?: Date,
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
                    webhookUrl,
                    expiresAt: expiresAt?.toISOString(),
                },
                {
                    headers: {
                        'x-api-key': apiKey,
                    },
                },
            );

            return {
                success: true,
                invoiceId: response.data.invoiceId,
                status: response.data.status,
            };
        } catch (error: any) {
            console.error(
                'Banking API Error:',
                error.response?.data || error.message,
            );

            const respData = error.response?.data;
            const status = error.response?.status;

            const isAuthError =
                status === 401 ||
                status === 403 ||
                String(respData?.error || respData?.message || '')
                    .toLowerCase()
                    .includes('token') ||
                String(respData?.error || respData?.message || '')
                    .toLowerCase()
                    .includes('access denied');

            const msg =
                respData?.message ||
                respData?.error ||
                'Banking service unavailable';
            // If it's an auth error, surface a clearer message for the organizer key
            if (isAuthError) {
                throw new AppError(
                    'Organizer payment API key invalid or expired. Verify organizer settings.',
                    400,
                );
            }

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
                },
            );
            console.log(`Refunded transaction: ${transactionId}`);
        } catch (error) {
            console.error(
                `CRITICAL: Refund failed for ${transactionId}`,
                error,
            );
            throw new AppError('Refund failed', 500);
        }
    },
};
