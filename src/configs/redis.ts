import Redis from 'ioredis';
if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is not defined in environment variables');
}
const redisUrl = process.env.REDIS_URL;

export const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});

export const connectRedis = () => {
    if (redis.status === 'ready') {
        console.log('Redis connected successfully');
        return;
    }
    redis.on('connect', () => {
        console.log('Redis connected successfully');
    });

    redis.on('error', (err) => {
        console.error('Redis connection error:', err);
    });
};
