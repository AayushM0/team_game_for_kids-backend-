# Ride App Backend

A complete ride-hailing backend built with Node.js, Express, TypeScript, MongoDB, Redis, and WebSockets following the BMAD methodology.

## 🎯 Features

- **OTP-based Authentication** - Secure phone number authentication
- **Dual Role System** - Support for both riders and drivers
- **Real-time Matching** - WebSocket-based ride matching and notifications
- **Google Maps Integration** - Route calculation and ETA estimation
- **Driver Management** - Online/offline status, location tracking
- **Ride Lifecycle** - Complete flow from request to completion
- **Payment System** - Logical payment tracking (paid/unpaid flags)
- **Admin Dashboard APIs** - System monitoring and management
- **Redis Caching** - Fast driver location and status tracking

## 📋 Prerequisites

Before running the backend, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **MongoDB** (v6 or higher)
- **Redis** (v7 or higher)
- **Google Maps API Key**

## 🚀 Installation

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/ride-app
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   GOOGLE_MAPS_API_KEY=your-google-maps-api-key
   OTP_EXPIRY_MINUTES=5
   FRONTEND_URL=http://localhost:5173
   ```

4. **Start MongoDB**
   ```bash
   # On Windows
   net start MongoDB
   
   # On macOS/Linux
   sudo systemctl start mongodb
   # or
   brew services start mongodb-community
   ```

5. **Start Redis**
   ```bash
   # On Windows
   redis-server
   
   # On macOS/Linux
   redis-server
   # or
   brew services start redis
   ```

6. **Build TypeScript**
   ```bash
   npm run build
   ```

7. **Start the server**
   ```bash
   # Development mode (with hot reload)
   npm run dev
   
   # Production mode
   npm start
   ```

The server will start on `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── env.ts        # Environment variables
│   │   ├── db.ts         # MongoDB connection
│   │   ├── redis.ts      # Redis connection
│   │   └── socket.ts     # Socket.IO configuration
│   ├── models/           # MongoDB schemas
│   │   ├── User.ts
│   │   ├── DriverProfile.ts
│   │   ├── Ride.ts
│   │   └── Payment.ts
│   ├── modules/          # Feature modules
│   │   ├── auth/         # Authentication
│   │   ├── driver/       # Driver operations
│   │   ├── rider/        # Rider operations
│   │   └── admin/        # Admin operations
│   ├── services/         # Business logic
│   │   ├── driver.service.ts
│   │   └── ride.service.ts
│   ├── sockets/          # WebSocket handlers
│   │   └── socket.handlers.ts
│   ├── utils/            # Utilities
│   │   ├── jwt.ts
│   │   ├── otp.ts
│   │   ├── googleMaps.ts
│   │   └── validation.ts
│   ├── middleware/       # Express middleware
│   │   └── auth.ts
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── package.json
├── tsconfig.json
└── .env
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/send-otp` - Send OTP to phone number
- `POST /api/auth/verify-otp` - Verify OTP and login

### Rider Endpoints (Requires rider authentication)
- `GET /api/rider/nearby-drivers` - Get nearby available drivers
- `POST /api/rider/request-ride` - Create a new ride request
- `GET /api/rider/trip/:id` - Get ride details
- `GET /api/rider/history` - Get ride history
- `POST /api/rider/cancel/:id` - Cancel a ride
- `GET /api/rider/payment/:id` - Get payment details
- `POST /api/rider/payment/:id/pay` - Mark payment as paid

### Driver Endpoints (Requires driver authentication)
- `PUT /api/driver/status` - Update online/offline status
- `GET /api/driver/requests` - Get available ride requests
- `POST /api/driver/accept/:rideId` - Accept a ride request
- `POST /api/driver/start/:rideId` - Start the ride
- `POST /api/driver/complete/:rideId` - Complete the ride
- `GET /api/driver/earnings` - Get earnings summary

### Admin Endpoints
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user details
- `GET /api/admin/rides` - Get all rides
- `GET /api/admin/rides/:id` - Get ride details
- `GET /api/admin/stats` - Get system statistics

## 🔐 Authentication

All rider and driver endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

To get a token:
1. Call `/api/auth/send-otp` with phone number
2. Call `/api/auth/verify-otp` with OTP code
3. Use the returned token in subsequent requests

## 🌐 WebSocket Events

### Driver Namespace (`/driver`)
**Client → Server:**
- `update_location` - Update driver's current location
  ```json
  { "lat": 40.7128, "lng": -74.0060 }
  ```

**Server → Client:**
- `ride_request` - New ride request available
- `ride_cancelled` - Ride was cancelled by rider

### Rider Namespace (`/rider`)
**Server → Client:**
- `ride_matched` - Driver accepted the ride
- `trip_update` - Status update during the trip

### Connection Example
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000/driver', {
  auth: {
    token: 'your-jwt-token'
  }
});

socket.on('ride_request', (data) => {
  console.log('New ride request:', data);
});
```

## 🗄️ Database Schemas

### User
```typescript
{
  phone: string,
  role: 'rider' | 'driver',
  name: string,
  rating: number,
  createdAt: Date,
  updatedAt: Date
}
```

### DriverProfile
```typescript
{
  userId: ObjectId,
  isOnline: boolean,
  vehicle: {
    type: string,
    model: string,
    plate: string,
    color: string
  },
  city: string,
  earnings: number,
  totalRides: number,
  currentLocation: {
    lat: number,
    lng: number
  }
}
```

### Ride
```typescript
{
  riderId: ObjectId,
  driverId: ObjectId,
  pickup: { lat, lng, address },
  destination: { lat, lng, address },
  status: 'pending' | 'accepted' | 'ongoing' | 'completed' | 'cancelled',
  fare: number,
  distance: number,
  duration: number,
  rideType: 'economy' | 'premium' | 'luxury',
  city: string,
  polyline: string
}
```

### Payment
```typescript
{
  rideId: ObjectId,
  amount: number,
  paidStatus: 'unpaid' | 'paid',
  paymentMethod: string
}
```

## 🔑 Redis Keys

- `otp:{phone}` - OTP storage (5 min expiry)
- `driver:online:{driverId}` - Driver online status
- `driver:location:{driverId}` - Driver location (5 min expiry)
- `ride:lock:{rideId}` - Ride acceptance lock (10 sec expiry)

## 🧪 Testing the Backend

### 1. Health Check
```bash
curl http://localhost:5000/health
```

### 2. Send OTP
```bash
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "1234567890"}'
```

### 3. Verify OTP
```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "1234567890",
    "otp": "123456",
    "role": "rider",
    "name": "John Doe"
  }'
```

### 4. Test Authenticated Endpoint
```bash
curl -X GET http://localhost:5000/api/rider/nearby-drivers?lat=40.7128&lng=-74.0060&rideType=economy \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔧 Connecting to Frontend

The backend is designed to work seamlessly with the existing frontend without any modifications.

1. **Start the backend** on port 5000
2. **Update frontend** `.env` or config to point to `http://localhost:5000`
3. **Ensure CORS** is configured correctly in backend (already set to `http://localhost:5173`)

The backend matches all frontend expectations:
- ✅ Same API endpoints
- ✅ Same payload structures
- ✅ Same WebSocket events
- ✅ Compatible authentication flow

## 📊 Development Tips

### View Logs
The server logs all requests and important events:
- Authentication attempts
- Ride requests and matches
- WebSocket connections
- Database operations

### Monitor Redis
```bash
redis-cli monitor
```

### Monitor MongoDB
```bash
mongosh
use ride-app
db.rides.find().pretty()
db.users.find().pretty()
```

### Clear Redis Cache
```bash
redis-cli FLUSHALL
```

## 🐛 Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running: `mongosh`
- Check connection string in `.env`

### Redis Connection Error
- Ensure Redis is running: `redis-cli ping`
- Should return `PONG`

### Google Maps API Error
- Verify API key is valid
- Enable Directions API and Distance Matrix API
- Check billing is enabled

### WebSocket Connection Issues
- Check CORS settings
- Verify frontend URL in `.env`
- Ensure proper authentication token

## 🚀 Production Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure MongoDB Atlas or production database
4. Configure Redis Cloud or production Redis
5. Set up proper logging (Winston, Pino)
6. Enable rate limiting
7. Add admin authentication
8. Configure SSL/TLS
9. Set up monitoring (PM2, New Relic)
10. Implement proper SMS service for OTP

## 📝 License

MIT

## 🤝 Support

For issues or questions, please refer to the documentation or contact the development team.
