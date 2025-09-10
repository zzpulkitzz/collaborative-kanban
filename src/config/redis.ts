import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new Redis(process.env.REDIS_URL as string, {
  enableReadyCheck: false,
  lazyConnect: true,
  maxRetriesPerRequest: 3
});
console.log(process.env.REDIS_URL);
redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('error', (err: any) => {
  console.error('❌ Redis connection error:', err);
});

export default redis;
