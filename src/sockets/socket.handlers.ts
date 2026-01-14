import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { getRedisClient } from '../config/redis';
import User from '../models/User';
import DriverProfile from '../models/DriverProfile';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: 'rider' | 'driver';
}

export const setupSocketHandlers = (io: Server): void => {
  // Driver namespace
  const driverNamespace = io.of('/driver');
  
  driverNamespace.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const payload = verifyToken(token);
      
      if (payload.role !== 'driver') {
        return next(new Error('Only drivers can connect to this namespace'));
      }

      socket.userId = payload.userId;
      socket.userRole = payload.role;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  driverNamespace.on('connection', async (socket: AuthenticatedSocket) => {
    console.log(`✅ Driver connected: ${socket.userId}`);

    // Join driver's personal room
    socket.join(`driver:${socket.userId}`);

    // Handle location updates
    socket.on('update_location', async (data: { lat: number; lng: number }) => {
      try {
        console.log(`📍 Driver ${socket.userId} location update:`, data);
        
        const redis = getRedisClient();
        const locationKey = `driver:location:${socket.userId}`;
        
        await redis.set(
          locationKey,
          JSON.stringify({ lat: data.lat, lng: data.lng, timestamp: Date.now() }),
          { EX: 300 } // Expire after 5 minutes
        );
        
        console.log(`✅ Location saved to Redis: ${locationKey}`);

        // Update driver profile
        await DriverProfile.findOneAndUpdate(
          { userId: socket.userId },
          { currentLocation: { lat: data.lat, lng: data.lng } }
        );
        
        console.log(`✅ Location saved to MongoDB for driver ${socket.userId}`);

        // Broadcast location to rider if driver has an active ride
        const Ride = require('../models/Ride').default;
        const activeRide = await Ride.findOne({
          driverId: socket.userId,
          status: { $in: ['accepted', 'ongoing'] }
        });

        if (activeRide) {
          // Emit location update to the rider
          io.of('/rider').to(`rider:${activeRide.riderId}`).emit('driver_location_update', {
            location: { lat: data.lat, lng: data.lng },
            driverId: socket.userId,
            timestamp: Date.now()
          });
          console.log(`📍 Driver location sent to rider ${activeRide.riderId}`);
        }
      } catch (error) {
        console.error('❌ Location update error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`❌ Driver disconnected: ${socket.userId}`);
      
      try {
        const redis = getRedisClient();
        await redis.del(`driver:online:${socket.userId}`);
        
        await DriverProfile.findOneAndUpdate(
          { userId: socket.userId },
          { isOnline: false }
        );
      } catch (error) {
        console.error('Disconnect cleanup error:', error);
      }
    });
  });

  // Rider namespace
  const riderNamespace = io.of('/rider');
  
  riderNamespace.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const payload = verifyToken(token);
      
      if (payload.role !== 'rider') {
        return next(new Error('Only riders can connect to this namespace'));
      }

      socket.userId = payload.userId;
      socket.userRole = payload.role;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  riderNamespace.on('connection', async (socket: AuthenticatedSocket) => {
    console.log(`✅ Rider connected: ${socket.userId}`);

    // Join rider's personal room
    socket.join(`rider:${socket.userId}`);

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ Rider disconnected: ${socket.userId}`);
    });
  });

  console.log('✅ Socket namespaces configured: /driver, /rider');
};

// Helper function to emit events to specific users
export const emitToDriver = (io: Server, driverId: string, event: string, data: any): void => {
  io.of('/driver').to(`driver:${driverId}`).emit(event, data);
};

export const emitToRider = (io: Server, riderId: string, event: string, data: any): void => {
  io.of('/rider').to(`rider:${riderId}`).emit(event, data);
};
