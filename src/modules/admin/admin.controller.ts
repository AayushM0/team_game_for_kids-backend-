import { Request, Response } from 'express';
import User from '../../models/User';
import Ride from '../../models/Ride';
import DriverProfile from '../../models/DriverProfile';
import Payment from '../../models/Payment';

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const getAllRides = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};
    if (status) {
      query.status = status;
    }

    const rides = await Ride.find(query)
      .populate('riderId', 'name phone')
      .populate('driverId', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Ride.countDocuments(query);

    res.status(200).json({
      success: true,
      rides,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get all rides error:', error);
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
};

export const getSystemStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments();
    const totalRiders = await User.countDocuments({ role: 'rider' });
    const totalDrivers = await User.countDocuments({ role: 'driver' });
    const onlineDrivers = await DriverProfile.countDocuments({ isOnline: true });

    const totalRides = await Ride.countDocuments();
    const pendingRides = await Ride.countDocuments({ status: 'pending' });
    const activeRides = await Ride.countDocuments({ status: { $in: ['accepted', 'ongoing'] } });
    const completedRides = await Ride.countDocuments({ status: 'completed' });
    const cancelledRides = await Ride.countDocuments({ status: 'cancelled' });

    const totalRevenue = await Ride.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$fare' } } },
    ]);

    const unpaidPayments = await Payment.countDocuments({ paidStatus: 'unpaid' });

    res.status(200).json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          riders: totalRiders,
          drivers: totalDrivers,
          onlineDrivers,
        },
        rides: {
          total: totalRides,
          pending: pendingRides,
          active: activeRides,
          completed: completedRides,
          cancelled: cancelledRides,
        },
        revenue: {
          total: totalRevenue[0]?.total || 0,
          unpaidPayments,
        },
      },
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
};

export const getRideById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const ride = await Ride.findById(id)
      .populate('riderId', 'name phone rating')
      .populate('driverId', 'name phone rating');

    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }

    const payment = await Payment.findOne({ rideId: id });

    res.status(200).json({
      success: true,
      ride,
      payment,
    });
  } catch (error) {
    console.error('Get ride by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch ride details' });
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let driverProfile = null;
    if (user.role === 'driver') {
      driverProfile = await DriverProfile.findOne({ userId: id });
    }

    const ridesCount = await Ride.countDocuments({
      [user.role === 'rider' ? 'riderId' : 'driverId']: id,
    });

    res.status(200).json({
      success: true,
      user,
      ...(driverProfile && { driverProfile }),
      ridesCount,
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
};
