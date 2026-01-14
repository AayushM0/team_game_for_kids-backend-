import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { findNearbyDrivers } from '../../services/driver.service';
import { createRide, notifyNearbyDrivers, cancelRide } from '../../services/ride.service';
import Ride from '../../models/Ride';
import Payment from '../../models/Payment';
import RecentLocation from '../../models/RecentLocation';
import User from '../../models/User';
import { rideSchemas } from '../../utils/validation';

export const getNearbyDrivers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lat, lng, rideType } = req.query;

    console.log(`🔍 Nearby drivers request from rider ${req.user?.userId}:`, { lat, lng, rideType: rideType || 'all' });

    if (!lat || !lng) {
      res.status(400).json({ error: 'Latitude and longitude are required' });
      return;
    }

    const location = {
      lat: parseFloat(lat as string),
      lng: parseFloat(lng as string),
    };

    // Pass rideType only if specified, otherwise get all nearby drivers
    const drivers = await findNearbyDrivers(location, 5000, rideType as string | undefined);

    console.log(`✅ Returning ${drivers.length} nearby drivers to rider`);

    res.status(200).json({
      success: true,
      drivers,
      count: drivers.length,
    });
  } catch (error) {
    console.error('❌ Get nearby drivers error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby drivers' });
  }
};

export const requestRide = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { error, value } = rideSchemas.createRide.validate(req.body);

    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    }

    const userId = req.user!.userId;

    // Check if user has any pending or active rides
    const existingRide = await Ride.findOne({
      riderId: userId,
      status: { $in: ['pending', 'accepted', 'ongoing'] },
    });

    if (existingRide) {
      res.status(409).json({
        error: 'You already have an active ride',
        rideId: existingRide._id,
      });
      return;
    }

    // Create the ride
    const ride = await createRide({
      riderId: userId,
      pickup: value.pickup,
      destination: value.destination,
      rideType: value.rideType,
    });

    // Notify nearby drivers
    await notifyNearbyDrivers(ride);

    res.status(201).json({
      success: true,
      ride: {
        _id: ride._id,
        pickup: ride.pickup,
        destination: ride.destination,
        fare: ride.fare,
        distance: ride.distance,
        duration: ride.duration,
        status: ride.status,
        rideType: ride.rideType,
      },
      message: 'Ride request created successfully',
    });
  } catch (error) {
    console.error('Request ride error:', error);
    res.status(500).json({ error: 'Failed to create ride request' });
  }
};

export const getRideDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const ride = await Ride.findOne({
      _id: id,
      riderId: userId,
    })
      .populate('riderId', 'name phone rating')
      .populate('driverId', 'name phone rating');

    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }

    // Get driver profile if driver is assigned
    let driverDetails = null;
    if (ride.driverId) {
      const DriverProfile = require('../../models/DriverProfile').default;
      const driverProfile = await DriverProfile.findOne({ userId: ride.driverId });
      if (driverProfile) {
        driverDetails = {
          vehicle: driverProfile.vehicle,
          currentLocation: driverProfile.currentLocation,
        };
      }
    }

    res.status(200).json({
      success: true,
      ride: {
        ...ride.toObject(),
        ...(driverDetails && { driverDetails }),
      },
    });
  } catch (error) {
    console.error('Get ride details error:', error);
    res.status(500).json({ error: 'Failed to fetch ride details' });
  }
};

export const getRideHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const rides = await Ride.find({
      riderId: userId,
      status: { $in: ['completed', 'cancelled'] },
    })
      .populate('driverId', 'name rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Ride.countDocuments({
      riderId: userId,
      status: { $in: ['completed', 'cancelled'] },
    });

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
    console.error('Get ride history error:', error);
    res.status(500).json({ error: 'Failed to fetch ride history' });
  }
};

export const cancelRideByRider = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.userId;

    const ride = await Ride.findOne({
      _id: id,
      riderId: userId,
    });

    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }

    if (!['pending', 'accepted'].includes(ride.status)) {
      res.status(400).json({ error: 'Cannot cancel ride in current status' });
      return;
    }

    const cancelledRide = await cancelRide(id, 'rider', reason);

    res.status(200).json({
      success: true,
      ride: cancelledRide,
      message: 'Ride cancelled successfully',
    });
  } catch (error) {
    console.error('Cancel ride error:', error);
    res.status(500).json({ error: 'Failed to cancel ride' });
  }
};

export const getRidePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const ride = await Ride.findOne({
      _id: id,
      riderId: userId,
      status: 'completed',
    });

    if (!ride) {
      res.status(404).json({ error: 'Completed ride not found' });
      return;
    }

    const payment = await Payment.findOne({ rideId: id });

    if (!payment) {
      res.status(404).json({ error: 'Payment record not found' });
      return;
    }

    res.status(200).json({
      success: true,
      payment: {
        rideId: payment.rideId,
        amount: payment.amount,
        paidStatus: payment.paidStatus,
        paymentMethod: payment.paymentMethod,
      },
    });
  } catch (error) {
    console.error('Get ride payment error:', error);
    res.status(500).json({ error: 'Failed to fetch payment details' });
  }
};

export const markPaymentPaid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const ride = await Ride.findOne({
      _id: id,
      riderId: userId,
      status: 'completed',
    });

    if (!ride) {
      res.status(404).json({ error: 'Completed ride not found' });
      return;
    }

    const payment = await Payment.findOneAndUpdate(
      { rideId: id },
      { paidStatus: 'paid' },
      { new: true }
    );

    if (!payment) {
      res.status(404).json({ error: 'Payment record not found' });
      return;
    }

    res.status(200).json({
      success: true,
      payment,
      message: 'Payment marked as paid',
    });
  } catch (error) {
    console.error('Mark payment paid error:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
};

export const getRecentLocations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { limit = 5 } = req.query;

    // Get saved recent locations
    const savedLocations = await RecentLocation.find({ userId })
      .sort({ lastUsed: -1 })
      .limit(parseInt(limit as string));

    // Get recent destinations from completed trips
    const recentTrips = await Ride.find({
      riderId: userId,
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string));

    // Extract unique destinations from completed trips
    const tripDestinations = recentTrips
      .filter(trip => trip.destination && trip.destination.address)
      .map(trip => ({
        _id: trip._id,
        name: trip.destination.address.split(',')[0], // Use first part of address as name
        address: trip.destination.address,
        lat: trip.destination.lat,
        lng: trip.destination.lng,
        type: 'visited', // Mark as visited location from trip
        lastUsed: trip.updatedAt || trip.createdAt,
      }));

    // Combine saved locations and trip destinations, prioritizing saved locations
    const allLocations = [...savedLocations, ...tripDestinations]
      .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
      .slice(0, parseInt(limit as string));

    res.status(200).json({
      success: true,
      locations: allLocations,
    });
  } catch (error) {
    console.error('Get recent locations error:', error);
    res.status(500).json({ error: 'Failed to fetch recent locations' });
  }
};

export const rateDriver = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rideId } = req.params;
    const { rating, feedback } = req.body;
    const userId = req.user!.userId;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Rating must be between 1 and 5' });
      return;
    }

    // Find the ride and verify it belongs to the rider and is completed
    const ride = await Ride.findOne({
      _id: rideId,
      riderId: userId,
      status: 'completed',
    });

    if (!ride) {
      res.status(404).json({ error: 'Completed ride not found' });
      return;
    }

    if (!ride.driverId) {
      res.status(400).json({ error: 'No driver assigned to this ride' });
      return;
    }

    // Get the driver's current rating and total rides
    const driver = await User.findById(ride.driverId);
    if (!driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    // Calculate new rating using weighted average
    const currentRating = driver.rating || 5.0;
    
    // Get total completed rides for this driver (including the current one)
    const totalCompletedRides = await Ride.countDocuments({
      driverId: ride.driverId,
      status: 'completed',
    });

    // Calculate new rating based on the actual number of ratings received
    // If this is the first rating, use the new rating directly
    // Otherwise, calculate weighted average
    let newRating;
    if (totalCompletedRides <= 1) {
      // This is the first rating for this driver
      newRating = rating;
    } else {
      // Calculate new average: ((previous_average * previous_count) + new_rating) / new_count
      // Since totalCompletedRides includes current ride, we use totalCompletedRides - 1 as previous count
      const previousCount = totalCompletedRides - 1;
      const previousTotalPoints = currentRating * previousCount;
      const newTotalPoints = previousTotalPoints + rating;
      newRating = newTotalPoints / totalCompletedRides;
    }

    // Update driver's rating
    await User.findByIdAndUpdate(ride.driverId, {
      rating: Math.round(newRating * 10) / 10, // Round to 1 decimal place
    });

    console.log(`✅ Driver ${driver.name} rating updated: ${currentRating.toFixed(1)} → ${newRating.toFixed(1)}`);

    res.status(200).json({
      success: true,
      message: 'Rating submitted successfully',
      newRating: Math.round(newRating * 10) / 10,
    });
  } catch (error) {
    console.error('Rate driver error:', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
};
