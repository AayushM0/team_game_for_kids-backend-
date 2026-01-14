import { Router } from 'express';
import { 
  sendOTPController, 
  verifyOTPController, 
  checkUserExists,
  signupWithOTP,
  loginWithOTP
} from './auth.controller';

const router = Router();

// Send OTP (for both signup and login)
router.post('/send-otp', sendOTPController);

// Check if user exists
router.post('/check-user', checkUserExists);

// Signup with OTP verification
router.post('/signup', signupWithOTP);

// Login with OTP verification
router.post('/login', loginWithOTP);

// Legacy endpoint for backward compatibility
router.post('/verify-otp', verifyOTPController);

export default router;
