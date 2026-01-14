import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
  port: number;
  nodeEnv: string;
  mongodbUri: string;
  redisHost: string;
  redisPort: number;
  redisPassword: string;
  jwtSecret: string;
  otpExpiryMinutes: number;
  frontendUrl: string;
}

const env: EnvConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ride-app',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisPassword: process.env.REDIS_PASSWORD || '',
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  // NO API KEYS NEEDED - Using free open-source services (OSRM + OpenStreetMap)
  otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};

export default env;
