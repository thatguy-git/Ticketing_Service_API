import express from 'express';
import cors from 'cors';
import { authRoutes } from './routes/authRoutes';
import { eventRoutes } from './routes/eventRoutes';
import { webhookRoutes } from './routes/webhookRoutes';

const app = express();

app.use(cors());
app.use(express.json());
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date() });
});
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/webhooks', webhookRoutes);

app.use(
    (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        console.error(err.stack);
        res.status(500).json({
            status: 'error',
            message: err.message || 'Internal Server Error',
        });
    }
);

export { app };
