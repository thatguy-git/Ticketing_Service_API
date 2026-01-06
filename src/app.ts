import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date() });
});

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
