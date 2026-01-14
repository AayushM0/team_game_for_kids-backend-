import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User';
import DriverProfile from '../models/DriverProfile';
import Ride from '../models/Ride';
import RecentLocation from '../models/RecentLocation';
import DriverStats from '../models/DriverStats';
import Payment from '../models/Payment';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ride-app';

// Sample data - Indian locations
const sampleLocations = [
  { name: 'Home', address: 'Koramangala 5th Block, Bengaluru', lat: 12.9352, lng: 77.6245, type: 'home' as const },
  { name: 'Office', address: 'MG Road Metro Station, Bengaluru', lat: 12.9759, lng: 77.6074, type: 'work' as const },
  { name: 'Shopping Mall', address: 'Indiranagar 100 Feet Road, Bengaluru', lat: 12.9716, lng: 77.6412, type: 'other' as const },
  { name: 'Gym', address: 'HSR Layout Sector 1, Bengaluru', lat: 12.9121, lng: 77.6446, type: 'other' as const },
  { name: 'Restaurant', address: 'Church Street, Bengaluru', lat: 12.9760, lng: 77.6040, type: 'other' as const },
];

// Electric scooter types only
const scooterTypes = ['lite', 'city', 'plus'];
const scooterBrands = ['Ather', 'Ola', 'TVS', 'Bounce', 'Hero'];
const scooterModels = {
  lite: ['Ola S1 Air', 'Ather 450S', 'TVS iQube', 'Hero Vida V1'],
  city: ['Ather 450X', 'TVS iQube ST', 'Ola S1', 'Bounce Infinity E1'],
  plus: ['Ola S1 Pro', 'Ather 450X Pro', 'TVS iQube S', 'Hero Vida V1 Pro'],
};
const vehicleColors = ['Black', 'White', 'Red', 'Blue', 'Silver', 'Grey'];

// Indian cities
const cities = ['Bengaluru', 'Delhi', 'Gurugram', 'Noida', 'Mumbai', 'Pune', 'Hyderabad', 'Chennai', 'Kota'];

// Indian names
const riderNames = ['Rahul', 'Aman', 'Priya', 'Ananya', 'Rohan', 'Sneha', 'Arjun', 'Pooja'];
const driverNames = ['Suresh', 'Mohit', 'Ravi', 'Kunal', 'Deepak', 'Vijay', 'Ajay', 'Sandeep'];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

async function clearExistingData() {
  console.log('🗑️  Clearing existing dummy data...');
  
  // Only clear data for test users (those with phone starting with +91555)
  const testUsers = await User.find({ phone: /^\+91555/ });
  const testUserIds = testUsers.map(u => u._id);
  
  if (testUserIds.length > 0) {
    await DriverProfile.deleteMany({ userId: { $in: testUserIds } });
    await DriverStats.deleteMany({ userId: { $in: testUserIds } });
    await RecentLocation.deleteMany({ userId: { $in: testUserIds } });
    await Payment.deleteMany({ 
      rideId: { $in: await Ride.find({ 
        $or: [
          { riderId: { $in: testUserIds } },
          { driverId: { $in: testUserIds } }
        ]
      }).distinct('_id') }
    });
    await Ride.deleteMany({ 
      $or: [
        { riderId: { $in: testUserIds } },
        { driverId: { $in: testUserIds } }
      ]
    });
    await User.deleteMany({ _id: { $in: testUserIds } });
  }
  
  console.log('✅ Cleared existing test data');
}

async function seedUsers() {
  console.log('👥 Creating users...');
  
  const users = [];
  
  // Create 5 riders with Indian names
  for (let i = 0; i < 5; i++) {
    const rider = await User.create({
      phone: `+91555100000${i}`,
      role: 'rider',
      name: riderNames[i],
      email: `${riderNames[i].toLowerCase()}@swiftgo.in`,
      rating: getRandomFloat(4.5, 5.0, 1),
    });
    users.push(rider);
    console.log(`   ✓ Created rider: ${rider.name} (${rider.phone})`);
  }
  
  // Create 8 drivers with Indian names
  for (let i = 0; i < 8; i++) {
    const driver = await User.create({
      phone: `+91555200000${i}`,
      role: 'driver',
      name: driverNames[i],
      email: `${driverNames[i].toLowerCase()}@swiftgo.in`,
      rating: getRandomFloat(4.3, 5.0, 1),
    });
    users.push(driver);
    console.log(`   ✓ Created driver: ${driver.name} (${driver.phone})`);
  }
  
  return users;
}

async function seedDriverProfiles(drivers: any[]) {
  console.log('🛵 Creating driver profiles (Electric Scooters)...');
  
  const profiles = [];
  
  for (const driver of drivers) {
    const sType = getRandomElement(scooterTypes);
    const brand = getRandomElement(scooterBrands);
    const profile = await DriverProfile.create({
      userId: driver._id,
      isOnline: false,
      vehicle: {
        type: sType,
        brand: brand,
        model: getRandomElement(scooterModels[sType as keyof typeof scooterModels]),
        plate: `KA${getRandomInt(10, 99)}${String.fromCharCode(65 + getRandomInt(0, 25))}${String.fromCharCode(65 + getRandomInt(0, 25))}${getRandomInt(1000, 9999)}`,
        color: getRandomElement(vehicleColors),
        batteryLevel: getRandomInt(60, 100),
        rangeKm: getRandomInt(40, 100),
      },
      city: getRandomElement(cities),
      earnings: getRandomFloat(5000, 50000, 2), // INR
      totalRides: getRandomInt(10, 100),
      currentLocation: {
        lat: getRandomFloat(12.9000, 12.9800, 4), // Bengaluru coords
        lng: getRandomFloat(77.5800, 77.6500, 4),
      },
    });
    profiles.push(profile);
    console.log(`   ✓ Created profile for ${driver.name}: ${profile.vehicle.model} (${profile.vehicle.plate}) - Battery: ${profile.vehicle.batteryLevel}%`);
  }
  
  return profiles;
}

async function seedDriverStats(drivers: any[]) {
  console.log('📊 Creating driver stats...');
  
  const stats = [];
  
  for (const driver of drivers) {
    // Generate weekly earnings (last 7 days) in INR
    const weeklyEarnings = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      weeklyEarnings.push({
        date,
        amount: getRandomFloat(200, 1500, 2), // INR (₹200-1500 per day)
        trips: getRandomInt(2, 15),
      });
    }
    
    const driverStats = await DriverStats.create({
      userId: driver._id,
      weeklyEarnings,
      todayTrips: getRandomInt(0, 12),
      todayOnlineTime: getRandomInt(60, 480), // 1-8 hours in minutes
    });
    stats.push(driverStats);
    console.log(`   ✓ Created stats for ${driver.name}`);
  }
  
  return stats;
}

async function seedRecentLocations(riders: any[]) {
  console.log('📍 Creating recent locations for riders...');
  
  const locations = [];
  
  for (const rider of riders) {
    // Create 2-4 recent locations per rider
    const numLocations = getRandomInt(2, 4);
    const selectedLocations = sampleLocations
      .sort(() => Math.random() - 0.5)
      .slice(0, numLocations);
    
    for (let i = 0; i < selectedLocations.length; i++) {
      const loc = selectedLocations[i];
      const lastUsed = new Date();
      lastUsed.setDate(lastUsed.getDate() - i * 2); // Spread usage over time
      
      const recentLoc = await RecentLocation.create({
        userId: rider._id,
        name: loc.name,
        address: loc.address,
        lat: loc.lat + getRandomFloat(-0.01, 0.01, 4),
        lng: loc.lng + getRandomFloat(-0.01, 0.01, 4),
        type: loc.type,
        lastUsed,
      });
      locations.push(recentLoc);
    }
    console.log(`   ✓ Created ${numLocations} locations for ${rider.name}`);
  }
  
  return locations;
}

async function seedRides(riders: any[], drivers: any[]) {
  console.log('🛵 Creating ride history (Electric Scooter Rides)...');
  
  const rides = [];
  
  // Create 15-20 completed rides
  const numRides = getRandomInt(15, 20);
  
  for (let i = 0; i < numRides; i++) {
    const rider = getRandomElement(riders);
    const driver = getRandomElement(drivers);
    const pickup = getRandomElement(sampleLocations);
    const destination = getRandomElement(sampleLocations.filter(l => l !== pickup));
    const distance = getRandomInt(2000, 12000); // 2-12 km in meters (scooter range)
    const duration = getRandomInt(600, 2400); // 10-40 minutes in seconds
    
    // Calculate fare based on scooter type
    const scooterType = getRandomElement(scooterTypes);
    let fare = 0;
    if (scooterType === 'lite') {
      fare = 20 + (distance / 1000) * 8; // Base ₹20 + ₹8/km
    } else if (scooterType === 'city') {
      fare = 30 + (distance / 1000) * 10; // Base ₹30 + ₹10/km
    } else {
      fare = 40 + (distance / 1000) * 12; // Base ₹40 + ₹12/km
    }
    fare = Math.round(fare);
    
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - getRandomInt(1, 30)); // Random date in last 30 days
    
    const startTime = new Date(createdAt);
    startTime.setMinutes(startTime.getMinutes() + getRandomInt(5, 15));
    
    const endTime = new Date(startTime);
    endTime.setSeconds(endTime.getSeconds() + duration);
    
    const ride = await Ride.create({
      riderId: rider._id,
      driverId: driver._id,
      pickup: {
        lat: pickup.lat + getRandomFloat(-0.01, 0.01, 4),
        lng: pickup.lng + getRandomFloat(-0.01, 0.01, 4),
        address: pickup.address,
      },
      destination: {
        lat: destination.lat + getRandomFloat(-0.01, 0.01, 4),
        lng: destination.lng + getRandomFloat(-0.01, 0.01, 4),
        address: destination.address,
      },
      status: 'completed',
      fare,
      distance,
      duration,
      rideType: scooterType as any,
      city: getRandomElement(cities),
      startTime,
      endTime,
      createdAt,
      updatedAt: endTime,
    });
    rides.push(ride);
    
    // Create payment record for completed ride
    await Payment.create({
      rideId: ride._id,
      amount: fare,
      paidStatus: Math.random() > 0.3 ? 'paid' : 'unpaid',
      paymentMethod: getRandomElement(['cash', 'upi', 'paytm', 'wallet']), // Indian payment methods
    });
  }
  
  console.log(`   ✓ Created ${numRides} completed electric scooter rides with payments`);
  return rides;
}

async function main() {
  try {
    console.log('🚀 Starting dummy data seeding...\n');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Clear existing test data
    await clearExistingData();
    console.log('');
    
    // Seed users
    const users = await seedUsers();
    const riders = users.filter(u => u.role === 'rider');
    const drivers = users.filter(u => u.role === 'driver');
    console.log('');
    
    // Seed driver-specific data
    await seedDriverProfiles(drivers);
    console.log('');
    
    await seedDriverStats(drivers);
    console.log('');
    
    // Seed rider-specific data
    await seedRecentLocations(riders);
    console.log('');
    
    // Seed rides
    await seedRides(riders, drivers);
    console.log('');
    
    console.log('✅ Dummy data seeding completed successfully!\n');
    console.log('📋 Summary:');
    console.log(`   - ${riders.length} riders created (Indian names)`);
    console.log(`   - ${drivers.length} drivers created with electric scooters`);
    console.log(`   - All with appropriate history, stats, and Indian locations`);
    console.log(`   - Pricing in INR (₹)`);
    console.log('\n🔑 Test Credentials:');
    console.log('   Riders: +915551000000 to +915551000004');
    console.log('   Drivers: +915552000000 to +915552000007');
    console.log('\n🛵 Vehicle Types: Swift Lite, Swift City, Swift Plus');
    console.log('🏙️  Cities: Bengaluru, Delhi, Mumbai, Pune, etc.');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
    process.exit(0);
  }
}

main();
