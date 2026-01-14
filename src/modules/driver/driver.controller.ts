import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { setDriverOnlineStatus, getDriverProfile } from '../../services/driver.service';
import Ride from '../../models/Ride';
import DriverProfile from '../../models/DriverProfile';
import DriverStats from '../../models/DriverStats';
import Payment from '../../models/Payment';
import User from '../../models/User';
import RecentLocation from '../../models/RecentLocation';
import { getRedisClient } from '../../config/redis';
import { getIO } from '../../config/socket';
import { emitToRider } from '../../sockets/socket.handlers';

export const updateDriverStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isOnline, location } = req.body;
    const userId = req.user!.userId;

    if (typeof isOnline !== 'boolean') {
      res.status(400).json({ error: 'isOnline must be a boolean' });
      return;
    }

    console.log(`🔄 Driver ${userId} changing status to ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    
    await setDriverOnlineStatus(userId, isOnline);

    // If going online and location is provided, set it in Redis immediately
    if (isOnline && location && location.lat && location.lng) {
      const redis = getRedisClient();
      const locationKey = `driver:location:${userId}`;
      await redis.set(
        locationKey,
        JSON.stringify({ lat: location.lat, lng: location.lng, timestamp: Date.now() }),
        { EX: 300 } // Expire after 5 minutes
      );
      
      // Also update driver profile
      await DriverProfile.findOneAndUpdate(
        { userId },
        { currentLocation: { lat: location.lat, lng: location.lng } }
      );
      
      console.log(`📍 Initial location set for driver ${userId}:`, location);
    }

    console.log(`✅ Driver ${userId} status updated successfully`);

    res.status(200).json({
      success: true,
      isOnline,
      message: `Driver status updated to ${isOnline ? 'online' : 'offline'}`,
    });
  } catch (error) {
    console.error('Update driver status error:', error);
    res.status(500).json({ error: 'Failed to update driver status' });
  }
};

export const getDriverRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    // Get pending rides assigned to this driver or nearby pending rides
    const rides = await Ride.find({
      status: 'pending',
    })
      .populate('riderId', 'name phone rating')
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      requests: rides,
    });
  } catch (error) {
    console.error('Get driver requests error:', error);
    res.status(500).json({ error: 'Failed to fetch ride requests' });
  }
};

export const acceptRide = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rideId } = req.params;
    const userId = req.user!.userId;

    const redis = getRedisClient();
    const lockKey = `ride:lock:${rideId}`;

    // Try to acquire lock
    const locked = await redis.set(lockKey, userId, { NX: true, EX: 10 });

    if (!locked) {
      res.status(409).json({ error: 'Ride already accepted by another driver' });
      return;
    }

    const ride = await Ride.findOne({ _id: rideId, status: 'pending' });

    if (!ride) {
      await redis.del(lockKey);
      res.status(404).json({ error: 'Ride not found or already accepted' });
      return;
    }

    // Update ride status
    ride.driverId = userId as any;
    ride.status = 'accepted';
    await ride.save();

    // Populate both driver and rider data
    await ride.populate('driverId', 'name phone rating');
    await ride.populate('riderId', 'name phone rating');
    
    const driverProfile = await DriverProfile.findOne({ userId });

    // Notify rider via WebSocket
    const io = getIO();
    emitToRider(io, ride.riderId.toString(), 'ride_matched', {
      rideId: ride._id,
      driver: {
        _id: userId,
        name: (ride.driverId as any).name,
        phone: (ride.driverId as any).phone,
        rating: (ride.driverId as any).rating,
        vehicle: driverProfile?.vehicle,
        currentLocation: driverProfile?.currentLocation,
      },
      status: 'accepted',
    });

    res.status(200).json({
      success: true,
      ride,
      message: 'Ride accepted successfully',
    });
  } catch (error) {
    console.error('Accept ride error:', error);
    res.status(500).json({ error: 'Failed to accept ride' });
  }
};

export const startRide = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rideId } = req.params;
    const userId = req.user!.userId;

    const ride = await Ride.findOne({
      _id: rideId,
      driverId: userId,
      status: 'accepted',
    });

    if (!ride) {
      res.status(404).json({ error: 'Ride not found or not in accepted state' });
      return;
    }

    ride.status = 'ongoing';
    ride.startTime = new Date();
    await ride.save();

    // Populate rider and driver details before sending response
    await ride.populate('riderId', 'name phone rating');
    await ride.populate('driverId', 'name phone rating');

    // Notify rider
    const io = getIO();
    emitToRider(io, ride.riderId.toString(), 'trip_update', {
      rideId: ride._id,
      status: 'ongoing',
      startTime: ride.startTime,
    });

    res.status(200).json({
      success: true,
      ride,
      message: 'Ride started successfully',
    });
  } catch (error) {
    console.error('Start ride error:', error);
    res.status(500).json({ error: 'Failed to start ride' });
  }
};

export const completeRide = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rideId } = req.params;
    const userId = req.user!.userId;

    const ride = await Ride.findOne({
      _id: rideId,
      driverId: userId,
      status: 'ongoing',
    });

    if (!ride) {
      // Log for debugging purposes
      console.log(`Ride not found or not in ongoing state for driver ${userId}`);
      
      // Check if ride exists with different criteria for debugging
      const debugRide = await Ride.findById(rideId);
      if (debugRide) {
        console.log(`Debug - Ride found with ID ${rideId}, status: ${debugRide.status}, driverId: ${debugRide.driverId}, userId: ${userId}`);
      } else {
        console.log(`Debug - No ride found with ID ${rideId}`);
      }
      
      res.status(404).json({ error: 'Ride not found or not in ongoing state' });
      return;
    }

    ride.status = 'completed';
    ride.endTime = new Date();
    await ride.save();

    // Create payment record
    await Payment.create({
      rideId: ride._id,
      amount: ride.fare,
      paidStatus: 'unpaid',
      paymentMethod: 'cash',
    });

    // Update driver earnings and ride count
    await DriverProfile.findOneAndUpdate(
      { userId },
      {
        $inc: {
          earnings: ride.fare,
          totalRides: 1,
        },
      }
    );

    // Calculate trip duration for online time tracking
    let tripDurationMinutes = 0;
    
    // Use actual trip time if available, otherwise use estimated duration
    if (ride.startTime && ride.endTime) {
      // Calculate actual trip duration
      const actualDurationMs = ride.endTime.getTime() - ride.startTime.getTime();
      tripDurationMinutes = Math.ceil(actualDurationMs / (1000 * 60)); // Convert to minutes and round up
    } else if (ride.duration) {
      // Use estimated duration (stored in seconds)
      tripDurationMinutes = Math.ceil(ride.duration / 60); // Convert seconds to minutes and round up
    }
    
    // Update driver stats with today's trips and earnings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get or create driver stats
    let driverStats = await DriverStats.findOne({ userId });
    if (!driverStats) {
      driverStats = await DriverStats.create({
        userId,
        weeklyEarnings: [],
        todayTrips: 0,
        todayOnlineTime: 0,
      });
    }
    
    // Check if we need to update today's stats
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    // Find if there's already an entry for today
    const todayEarningIndex = driverStats.weeklyEarnings.findIndex(
      (earning) => earning.date.toDateString() === todayDate.toDateString()
    );
    
    if (todayEarningIndex >= 0) {
      // Update existing today's entry
      driverStats.weeklyEarnings[todayEarningIndex].amount += ride.fare;
      driverStats.weeklyEarnings[todayEarningIndex].trips += 1;
    } else {
      // Add new entry for today
      driverStats.weeklyEarnings.push({
        date: todayDate,
        amount: ride.fare,
        trips: 1,
      });
    }
    
    // Update today's trip count
    driverStats.todayTrips += 1;
    
    // Add trip duration to today's online time
    driverStats.todayOnlineTime += tripDurationMinutes;
    
    // Limit weeklyEarnings to last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Keep 7 days including today
    sevenDaysAgo.setHours(0, 0, 0, 0);
    
    driverStats.weeklyEarnings = driverStats.weeklyEarnings.filter(
      (earning) => earning.date >= sevenDaysAgo
    );
    
    await driverStats.save();
    
    console.log(`Driver ${userId} trip completed. Duration: ${tripDurationMinutes} minutes. Total online time today: ${driverStats.todayOnlineTime + tripDurationMinutes} minutes`);

    // Add destination to rider's recent locations
    if (ride.destination && ride.destination.address) {
      try {
        const recentLocationName = ride.destination.address.split(',')[0];
        
        // Check if this location already exists in recent locations
        const existingLocation = await RecentLocation.findOne({
          userId: ride.riderId,
          address: ride.destination.address,
        });
        
        if (existingLocation) {
          // Update the last used time
          await RecentLocation.findOneAndUpdate(
            { _id: existingLocation._id },
            { lastUsed: new Date() }
          );
        } else {
          // Create a new recent location
          await RecentLocation.create({
            userId: ride.riderId,
            name: recentLocationName,
            address: ride.destination.address,
            lat: ride.destination.lat,
            lng: ride.destination.lng,
            type: 'visited',
            lastUsed: new Date(),
          });
        }
      } catch (locationError) {
        console.error('Error adding destination to recent locations:', locationError);
        // Continue with the rest of the completion process even if saving recent location fails
      }
    }
    
    // Notify rider
    const io = getIO();
    
    // Get driver details to include phone number in the notification
    const driverUser = await User.findById(ride.driverId);
    
    emitToRider(io, ride.riderId.toString(), 'trip_update', {
      rideId: ride._id,
      status: 'completed',
      endTime: ride.endTime,
      fare: ride.fare,
      driverPhone: driverUser?.phone || 'N/A',
    });
    
    // Also notify driver about stats update
    io.of('/driver').to(`driver:${userId}`).emit('driver_stats_updated', {
      message: 'Your stats have been updated',
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      ride,
      message: 'Ride completed successfully',
    });
  } catch (error) {
    console.error('Complete ride error:', error);
    res.status(500).json({ error: 'Failed to complete ride' });
  }
};

export const getDriverRideDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rideId } = req.params;
    const userId = req.user!.userId;

    const ride = await Ride.findOne({
      _id: rideId,
      driverId: userId,
    })
      .populate('riderId', 'name phone rating')
      .populate('driverId', 'name phone rating');

    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }

    res.status(200).json({
      success: true,
      ride,
    });
  } catch (error) {
    console.error('Get driver ride details error:', error);
    res.status(500).json({ error: 'Failed to fetch ride details' });
  }
};

export const getDriverEarnings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const profile = await getDriverProfile(userId);

    if (!profile) {
      res.status(404).json({ error: 'Driver profile not found' });
      return;
    }

    res.status(200).json({
      success: true,
      earnings: profile.earnings,
      totalRides: profile.totalRides,
    });
  } catch (error) {
    console.error('Get driver earnings error:', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
};

export const getDriverStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    
    // Get driver profile for basic info
    const profile = await DriverProfile.findOne({ userId });
    const user = await User.findById(userId);
    
    if (!profile || !user) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    // Get or create driver stats
    let stats = await DriverStats.findOne({ userId });
    
    if (!stats) {
      // Create empty stats for new driver
      stats = await DriverStats.create({
        userId,
        weeklyEarnings: [],
        todayTrips: 0,
        todayOnlineTime: 0,
      });
    }

    // Get recent rides for additional info
    const recentRides = await Ride.find({
      driverId: userId,
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('riderId', 'name');

    // Prepare weekly earnings array ensuring it's sorted by date and contains last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    
    // Filter earnings to only include last 7 days
    const filteredWeeklyEarnings = stats.weeklyEarnings.filter(earning => 
      earning.date >= sevenDaysAgo
    ).sort((a, b) => a.date.getTime() - b.date.getTime());

    // Ensure we have entries for all 7 days (fill missing days with 0)
    const today = new Date();
    const lastSevenDays = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const existingEarning = filteredWeeklyEarnings.find(earning => 
        earning.date.toDateString() === date.toDateString()
      );
      
      if (existingEarning) {
        lastSevenDays.push(existingEarning);
      } else {
        lastSevenDays.push({
          date,
          amount: 0,
          trips: 0
        });
      }
    }

    res.status(200).json({
      success: true,
      stats: {
        rating: user.rating,
        totalEarnings: profile.earnings,
        totalRides: profile.totalRides,
        weeklyEarnings: lastSevenDays, // Return last 7 days of data
        todayTrips: stats.todayTrips,
        todayOnlineTime: stats.todayOnlineTime,
      },
      recentRides: recentRides.map(ride => ({
        _id: ride._id,
        pickup: ride.pickup,
        destination: ride.destination,
        fare: ride.fare,
        createdAt: ride.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get driver stats error:', error);
    res.status(500).json({ error: 'Failed to fetch driver stats' });
  }
};
