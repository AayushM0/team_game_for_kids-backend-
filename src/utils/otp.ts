import { getRedisClient } from '../config/redis';
import env from '../config/env';

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const storeOTP = async (phone: string, otp: string): Promise<void> => {
  const redis = getRedisClient();
  const key = `otp:${phone}`;
  const expirySeconds = env.otpExpiryMinutes * 60;
  
  await redis.setEx(key, expirySeconds, otp);
};

export const verifyOTP = async (phone: string, otp: string): Promise<boolean> => {
  const redis = getRedisClient();
  const key = `otp:${phone}`;
  
  const storedOTP = await redis.get(key);
  
  if (!storedOTP || storedOTP !== otp) {
    return false;
  }
  
  // Delete OTP after successful verification
  await redis.del(key);
  return true;
};

// For development/testing - log OTP to console instead of sending SMS
export const sendOTP = async (phone: string, otp: string): Promise<void> => {
  console.log(`📱 OTP for ${phone}: ${otp}`);
  // In production, integrate with SMS service (Twilio, AWS SNS, etc.)
};
