import Ride, { IRide } from '../models/Ride';
import { calculateRoute, Coordinates } from '../utils/googleMaps';
import { calculateScooterFare, isDistanceValid } from '../utils/scooterFare';
import { findNearbyDrivers } from './driver.service';
import { getIO } from '../config/socket';
import { emitToDriver } from '../sockets/socket.handlers';

export interface CreateRideData {
  riderId: string;
  pickup: {
    lat: number;
    lng: number;
    address: string;
  };
  destination: {
    lat: number;
    lng: number;
    address: string;
  };
  rideType: 'lite' | 'city' | 'plus'; // Electric scooter types only
}

export const createRide = async (data: CreateRideData): Promise<IRide> => {
  // Calculate route using OSRM (100% FREE - no API key required)
  const routeData = await calculateRoute(
    { lat: data.pickup.lat, lng: data.pickup.lng },
    { lat: data.destination.lat, lng: data.destination.lng }
  );

  // Validate distance for electric scooter (max 15 km)
  // DISABLED FOR TESTING - Remove comment in production
  // if (!isDistanceValid(routeData.distance, data.rideType)) {
  //   throw new Error('Distance exceeds maximum limit for electric scooter (15 km)');
  // }

  // Calculate fare based on distance and scooter type (in INR)
  const fare = calculateScooterFare(routeData.distance, data.rideType);

  // Create ride with OSRM route data (polyline is array of [lat, lng] coordinates)
  const ride = await Ride.create({
    riderId: data.riderId,
    pickup: data.pickup,
    destination: data.destination,
    rideType: data.rideType,
    status: 'pending',
    fare,
    distance: routeData.distance,
    duration: routeData.duration,
    polyline: routeData.polyline, // Array of [lat, lng] coordinates for Leaflet
    city: 'Bengaluru', // Default to Bengaluru
  });

  return ride;
};

export const notifyNearbyDrivers = async (ride: IRide): Promise<void> => {
  try {
    const nearbyDrivers = await findNearbyDrivers(
      { lat: ride.pickup.lat, lng: ride.pickup.lng },
      5000, // 5km radius
      ride.rideType
    );

    if (nearbyDrivers.length === 0) {
      console.log('No nearby drivers found for ride:', ride._id);
      return;
    }

    const io = getIO();
    const rideData = {
      rideId: ride._id,
      pickup: ride.pickup,
      destination: ride.destination,
      fare: ride.fare,
      distance: ride.distance,
      duration: ride.duration,
      rideType: ride.rideType,
    };

    // Emit to all nearby drivers
    for (const driver of nearbyDrivers) {
      emitToDriver(io, driver._id, 'ride_request', rideData);
    }

    console.log(`📢 Notified ${nearbyDrivers.length} drivers for ride ${ride._id}`);
  } catch (error) {
    console.error('Notify nearby drivers error:', error);
  }
};

export const cancelRide = async (
  rideId: string,
  cancelledBy: 'rider' | 'driver',
  reason?: string
): Promise<IRide | null> => {
  const ride = await Ride.findOne({
    _id: rideId,
    status: { $in: ['pending', 'accepted'] },
  });

  if (!ride) {
    return null;
  }

  ride.status = 'cancelled';
  ride.cancelledBy = cancelledBy;
  ride.cancelReason = reason;
  await ride.save();

  // Notify the other party
  const io = getIO();
  if (cancelledBy === 'rider' && ride.driverId) {
    emitToDriver(io, ride.driverId.toString(), 'ride_cancelled', {
      rideId: ride._id,
      reason,
    });
  } else if (cancelledBy === 'driver') {
    emitToDriver(io, ride.riderId.toString(), 'ride_cancelled', {
      rideId: ride._id,
      reason,
    });
  }

  return ride;
};
