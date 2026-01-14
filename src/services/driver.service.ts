import User from '../models/User';
import DriverProfile from '../models/DriverProfile';
import { getRedisClient } from '../config/redis';
import { calculateDistance } from '../utils/googleMaps'; // Note: Haversine formula is map-agnostic

export interface NearbyDriver {
  _id: string;
  name: string;
  rating: number;
  vehicle: {
    type: string;
    brand: string;
    model: string;
    plate: string;
    color: string;
    batteryLevel: number;
    rangeKm: number;
  };
  location: {
    lat: number;
    lng: number;
  };
  distance: number;
}

export const setDriverOnlineStatus = async (
  userId: string,
  isOnline: boolean
): Promise<void> => {
  const redis = getRedisClient();
  const onlineKey = `driver:online:${userId}`;

  console.log(`🔧 Setting driver online status: ${onlineKey} = ${isOnline}`);

  try {
    if (isOnline) {
      // Use SET with EX option (redis v4 syntax)
      const result = await redis.set(onlineKey, '1', {
        EX: 3600 // 1 hour expiry
      });
      console.log(`✅ Redis SET result:`, result);
      
      // Verify it was actually set
      const verify = await redis.get(onlineKey);
      console.log(`🔍 Verification - Key ${onlineKey} value:`, verify);
      
      if (!verify) {
        console.error('❌ WARNING: Key was not set in Redis!');
      }
    } else {
      const delResult = await redis.del(onlineKey);
      console.log(`🗑️  Deleted online key: ${onlineKey} (deleted count: ${delResult})`);
    }

    await DriverProfile.findOneAndUpdate(
      { userId },
      { isOnline }
    );
    
    console.log(`✅ MongoDB DriverProfile.isOnline updated to: ${isOnline}`);
  } catch (error) {
    console.error(`❌ Error in setDriverOnlineStatus:`, error);
    throw error;
  }
};

export const findNearbyDrivers = async (
  location: { lat: number; lng: number },
  maxDistance: number = 5000, // 5km default
  rideType?: string // Optional - if not provided, return all vehicle types
): Promise<NearbyDriver[]> => {
  try {
    const redis = getRedisClient();
    
    console.log(`🔍 Searching for nearby drivers at (${location.lat}, ${location.lng}) within ${maxDistance}m, type: ${rideType || 'all'}`);
    
    // Get all online drivers from Redis
    const onlineKeys = await redis.keys('driver:online:*');
    const onlineDriverIds = onlineKeys.map((key: string) => key.replace('driver:online:', ''));

    console.log(`📊 Found ${onlineDriverIds.length} online drivers in Redis:`, onlineDriverIds);

    if (onlineDriverIds.length === 0) {
      console.log('⚠️  No online drivers found in Redis');
      return [];
    }

    // Build query - only filter by vehicle type if rideType is specified
    const query: any = {
      userId: { $in: onlineDriverIds },
      isOnline: true,
      'vehicle.batteryLevel': { $gte: 30 }, // Minimum 30% battery required
    };

    // Only filter by vehicle type if rideType is provided
    if (rideType) {
      query['vehicle.type'] = rideType;
    }

    // Fetch driver profiles with user data
    const driverProfiles = await DriverProfile.find(query).populate('userId');

    console.log(`📋 Found ${driverProfiles.length} driver profiles matching criteria (online${rideType ? ` + vehicle type: ${rideType}` : ''})`);

    const nearbyDrivers: NearbyDriver[] = [];

    for (const profile of driverProfiles) {
      const driverUserId = profile.userId.toString();
      
      // Get driver location from Redis first
      const locationKey = `driver:location:${driverUserId}`;
      let locationData = await redis.get(locationKey);

      // Fallback to MongoDB location if Redis doesn't have it
      if (!locationData && profile.currentLocation) {
        console.log(`📍 Using MongoDB location for driver ${driverUserId} (Redis location not found)`);
        locationData = JSON.stringify({
          lat: profile.currentLocation.lat,
          lng: profile.currentLocation.lng,
          timestamp: Date.now(),
        });
      }

      if (!locationData) {
        console.log(`⚠️  No location found for driver ${driverUserId} (checked Redis and MongoDB)`);
        continue;
      }

      const driverLocation = JSON.parse(locationData);
      const distance = calculateDistance(location, {
        lat: driverLocation.lat,
        lng: driverLocation.lng,
      });

      console.log(`📏 Driver ${driverUserId} distance: ${distance}m (threshold: ${maxDistance}m)`);

      if (distance <= maxDistance) {
        const user = profile.userId as any;
        nearbyDrivers.push({
          _id: user._id.toString(),
          name: user.name,
          rating: user.rating,
          vehicle: {
            type: profile.vehicle.type,
            brand: profile.vehicle.brand,
            model: profile.vehicle.model,
            plate: profile.vehicle.plate,
            color: profile.vehicle.color,
            batteryLevel: profile.vehicle.batteryLevel,
            rangeKm: profile.vehicle.rangeKm,
          },
          location: {
            lat: driverLocation.lat,
            lng: driverLocation.lng,
          },
          distance,
        });
        console.log(`✅ Driver ${user.name} added to nearby list (Battery: ${profile.vehicle.batteryLevel}%)`);
      }
    }

    console.log(`🎯 Returning ${nearbyDrivers.length} nearby drivers`);

    // Sort by distance
    return nearbyDrivers.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.error('❌ Find nearby drivers error:', error);
    return [];
  }
};

export const getDriverProfile = async (userId: string) => {
  return await DriverProfile.findOne({ userId }).populate('userId');
};
