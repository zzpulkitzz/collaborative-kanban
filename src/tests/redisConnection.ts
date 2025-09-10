import redis from '../config/redis';
// Test Redis connection
redis.ping().then(() => {
  console.log('✅ Redis connection successful');
}).catch((err) => {
  console.error('❌ Redis connection failed:', err);
});