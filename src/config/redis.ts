import { createClient } from 'redis';
import env from './env';

let redisClient: any = null;

export const connectRedis = async (): Promise<any> => {
  if (redisClient) {
    return redisClient;
  }

  const client = createClient({
    socket: {
      host: env.redisHost,
      port: env.redisPort,
    },
    password: env.redisPassword || undefined,
  });

  client.on('error', (err: any) => {
    console.error('❌ Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });

  client.on('disconnect', () => {
    console.log('⚠️  Redis disconnected');
  });

  await client.connect();
  redisClient = client;
  return client;
};

export const getRedisClient = (): any => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('🔌 Redis disconnected');
  }
};

export type RedisClient = ReturnType<typeof createClient>;
