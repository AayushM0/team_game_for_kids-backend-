import { Request, Response } from 'express';
import User from '../../models/User';
import DriverProfile from '../../models/DriverProfile';
import { generateOTP, storeOTP, verifyOTP, sendOTP } from '../../utils/otp';
import { generateToken } from '../../utils/jwt';
import { authSchemas } from '../../utils/validation';

// Check if user exists by phone number
export const checkUserExists = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body;

    if (!phone) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    const user = await User.findOne({ phone });
    
    res.status(200).json({
      exists: !!user,
      role: user?.role || null,
    });
  } catch (error) {
    console.error('Check user exists error:', error);
    res.status(500).json({ error: 'Failed to check user existence' });
  }
};

export const sendOTPController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = authSchemas.sendOTP.validate(req.body);
    
    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    }

    const { phone } = value;
    const otp = generateOTP();

    await storeOTP(phone, otp);
    await sendOTP(phone, otp);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      // Only for development - remove in production
      ...(process.env.NODE_ENV === 'development' && { otp }),
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

// Signup with OTP verification (creates new user)
export const signupWithOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp, role, name, email, vehicle, city } = req.body;

    // Validate required fields
    if (!phone || !otp || !role || !name) {
      res.status(400).json({ error: 'Phone, OTP, role, and name are required' });
      return;
    }

    // Verify OTP
    const isValid = await verifyOTP(phone, otp);
    
    if (!isValid) {
      res.status(400).json({ error: 'Invalid or expired OTP' });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      res.status(400).json({ error: 'User already exists. Please login instead.' });
      return;
    }

    // Validate driver-specific fields
    if (role === 'driver') {
      if (!vehicle || !vehicle.type || !vehicle.model || !vehicle.plate || !vehicle.color) {
        res.status(400).json({ error: 'Vehicle details are required for drivers' });
        return;
      }
      if (!city) {
        res.status(400).json({ error: 'City is required for drivers' });
        return;
      }
    }

    // Create new user
    const user = await User.create({
      phone,
      role,
      name,
      email: email || undefined,
      rating: 5.0,
    });

    // If driver, create driver profile with provided details
    if (role === 'driver') {
      await DriverProfile.create({
        userId: user._id,
        isOnline: false,
        vehicle: {
          type: vehicle.type,
          model: vehicle.model,
          plate: vehicle.plate,
          color: vehicle.color,
        },
        city: city,
        earnings: 0,
        totalRides: 0,
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      phone: user.phone,
      role: user.role,
    });

    // Fetch driver profile if driver
    let driverProfile = null;
    if (user.role === 'driver') {
      driverProfile = await DriverProfile.findOne({ userId: user._id });
    }

    res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        rating: user.rating,
      },
      ...(driverProfile && {
        driverProfile: {
          isOnline: driverProfile.isOnline,
          vehicle: driverProfile.vehicle,
          city: driverProfile.city,
          earnings: driverProfile.earnings,
          totalRides: driverProfile.totalRides,
        },
      }),
    });
  } catch (error) {
    console.error('Signup with OTP error:', error);
    res.status(500).json({ error: 'Failed to complete signup' });
  }
};

// Login with OTP verification (existing user)
export const loginWithOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp } = req.body;

    // Validate required fields
    if (!phone || !otp) {
      res.status(400).json({ error: 'Phone and OTP are required' });
      return;
    }

    // Verify OTP
    const isValid = await verifyOTP(phone, otp);
    
    if (!isValid) {
      res.status(400).json({ error: 'Invalid or expired OTP' });
      return;
    }

    // Find existing user
    const user = await User.findOne({ phone });
    
    if (!user) {
      res.status(404).json({ error: 'User not found. Please sign up first.' });
      return;
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      phone: user.phone,
      role: user.role,
    });

    // Fetch driver profile if driver
    let driverProfile = null;
    if (user.role === 'driver') {
      driverProfile = await DriverProfile.findOne({ userId: user._id });
    }

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        rating: user.rating,
      },
      ...(driverProfile && {
        driverProfile: {
          isOnline: driverProfile.isOnline,
          vehicle: driverProfile.vehicle,
          city: driverProfile.city,
          earnings: driverProfile.earnings,
          totalRides: driverProfile.totalRides,
        },
      }),
    });
  } catch (error) {
    console.error('Login with OTP error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

// Legacy verifyOTP controller for backward compatibility
export const verifyOTPController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = authSchemas.verifyOTP.validate(req.body);
    
    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    }

    const { phone, otp, role, name } = value;

    const isValid = await verifyOTP(phone, otp);
    
    if (!isValid) {
      res.status(400).json({ error: 'Invalid or expired OTP' });
      return;
    }

    // Find or create user
    let user = await User.findOne({ phone });
    
    if (!user) {
      user = await User.create({
        phone,
        role,
        name,
        rating: 5.0,
      });

      // If driver, create driver profile with electric scooter defaults
      if (role === 'driver') {
        await DriverProfile.create({
          userId: user._id,
          isOnline: false,
          vehicle: {
            type: 'city',
            brand: 'Ather',
            model: 'Ather 450X',
            plate: 'KA01AB1234',
            color: 'Black',
            batteryLevel: 100,
            rangeKm: 80,
          },
          city: 'Bengaluru',
          earnings: 0,
          totalRides: 0,
        });
      }
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      phone: user.phone,
      role: user.role,
    });

    // Fetch driver profile if driver
    let driverProfile = null;
    if (user.role === 'driver') {
      driverProfile = await DriverProfile.findOne({ userId: user._id });
    }

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        rating: user.rating,
      },
      ...(driverProfile && {
        driverProfile: {
          isOnline: driverProfile.isOnline,
          vehicle: driverProfile.vehicle,
          city: driverProfile.city,
          earnings: driverProfile.earnings,
          totalRides: driverProfile.totalRides,
        },
      }),
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};
