import http from 'http';
import app from './app';
import env from './config/env';
import { connectDB } from './config/db';
import { connectRedis } from './config/redis';
import { initializeSocket } from './config/socket';
import { setupSocketHandlers } from './sockets/socket.handlers';

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to Redis
    await connectRedis();

    // Create HTTP server
    const httpServer = http.createServer(app);

    // Initialize Socket.IO
    const io = initializeSocket(httpServer);
    setupSocketHandlers(io);

    // Start server
    httpServer.listen(env.port, () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🚀 Server running on http://localhost:${env.port}`);
      console.log(`📡 WebSocket server ready`);
      console.log(`🌍 Environment: ${env.nodeEnv}`);
      console.log(`🔗 Frontend URL: ${env.frontendUrl}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n📋 Available API endpoints:');
      console.log('  POST   /api/auth/send-otp');
      console.log('  POST   /api/auth/verify-otp');
      console.log('  GET    /api/rider/nearby-drivers');
      console.log('  POST   /api/rider/request-ride');
      console.log('  GET    /api/rider/trip/:id');
      console.log('  GET    /api/rider/history');
      console.log('  PUT    /api/driver/status');
      console.log('  GET    /api/driver/requests');
      console.log('  POST   /api/driver/accept/:rideId');
      console.log('  POST   /api/driver/start/:rideId');
      console.log('  POST   /api/driver/complete/:rideId');
      console.log('  GET    /api/admin/users');
      console.log('  GET    /api/admin/rides');
      console.log('  GET    /api/admin/stats');
      console.log('\n🔌 WebSocket namespaces:');
      console.log('  /driver - Driver real-time events');
      console.log('  /rider  - Rider real-time events');
      console.log('\n✅ Backend is ready!\n');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      httpServer.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('\nSIGINT signal received: closing HTTP server');
      httpServer.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
