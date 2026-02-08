import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';
import { connectDB } from './configs/db';
import { connectRedis } from './configs/redis';
import './workers/emailWorker';

const PORT = process.env.PORT;

const startServer = async () => {
    try {
        await connectDB();
        connectRedis();
        app.listen(PORT, () => {
            console.log(`
                Server running on port ${PORT}
                http://localhost:${PORT}
            `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
