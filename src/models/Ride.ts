import mongoose, { Schema, Document } from 'mongoose';

export interface ILocation {
  lat: number;
  lng: number;
  address: string;
}

export type RideStatus = 
  | 'pending'      // Rider created, waiting for driver
  | 'accepted'     // Driver accepted
  | 'arriving'     // Driver on the way to pickup
  | 'ongoing'      // Trip in progress
  | 'completed'    // Trip completed
  | 'cancelled';   // Cancelled by rider or driver

export interface IRide extends Document {
  riderId: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  pickup: ILocation;
  destination: ILocation;
  status: RideStatus;
  fare: number;
  distance: number; // in meters
  duration: number; // in seconds
  rideType: 'lite' | 'city' | 'plus'; // Electric scooter types only
  city: string;
  polyline?: string;
  cancelledBy?: 'rider' | 'driver';
  cancelReason?: string;
  startTime?: Date;
  endTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RideSchema = new Schema<IRide>(
  {
    riderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    pickup: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, required: true },
    },
    destination: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'arriving', 'ongoing', 'completed', 'cancelled'],
      default: 'pending',
    },
    fare: {
      type: Number,
      required: true,
    },
    distance: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    rideType: {
      type: String,
      enum: ['lite', 'city', 'plus'],
      required: true,
    },
    city: {
      type: String,
      required: true,
      default: 'Default City',
    },
    polyline: String,
    cancelledBy: {
      type: String,
      enum: ['rider', 'driver'],
    },
    cancelReason: String,
    startTime: Date,
    endTime: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
RideSchema.index({ riderId: 1, createdAt: -1 });
RideSchema.index({ driverId: 1, createdAt: -1 });
RideSchema.index({ status: 1 });

export default mongoose.model<IRide>('Ride', RideSchema);
