import jwt from 'jsonwebtoken';
import env from '../config/env';

export interface JWTPayload {
  userId: string;
  phone: string;
  role: 'rider' | 'driver';
}

export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '30d' });
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, env.jwtSecret) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};
