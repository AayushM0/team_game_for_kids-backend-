import mongoose, { Schema, Document } from 'mongoose';

export interface IVehicle {
  type: string; // Electric scooter type: 'lite' | 'city' | 'plus'
  brand: 'Ather' | 'Ola' | 'TVS' | 'Bounce' | 'Hero'; // Indian EV brands
  model: string; // e.g., 'Ather 450X', 'Ola S1 Pro'
  plate: string; // Indian format: KA01AB1234
  color: string;
  batteryLevel: number; // percentage (0-100)
  rangeKm: number; // remaining range in kilometers
}

export interface IDriverProfile extends Document {
  userId: mongoose.Types.ObjectId;
  isOnline: boolean;
  vehicle: IVehicle;
  city: string;
  earnings: number;
  totalRides: number;
  currentLocation?: {
    lat: number;
    lng: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DriverProfileSchema = new Schema<IDriverProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    vehicle: {
      type: {
        type: String,
        required: true,
        enum: ['lite', 'city', 'plus'],
        default: 'city',
      },
      brand: {
        type: String,
        required: true,
        enum: ['Ather', 'Ola', 'TVS', 'Bounce', 'Hero'],
        default: 'Ather',
      },
      model: {
        type: String,
        required: true,
        default: 'Ather 450X',
      },
      plate: {
        type: String,
        required: true,
        default: 'KA01AB1234',
      },
      color: {
        type: String,
        required: true,
        default: 'Black',
      },
      batteryLevel: {
        type: Number,
        required: true,
        default: 100,
        min: 0,
        max: 100,
      },
      rangeKm: {
        type: Number,
        required: true,
        default: 80,
        min: 0,
      },
    },
    city: {
      type: String,
      required: true,
      enum: ['Bengaluru', 'Delhi', 'Gurugram', 'Noida', 'Mumbai', 'Pune', 'Hyderabad', 'Chennai', 'Kota'],
      default: 'Bengaluru',
    },
    earnings: {
      type: Number,
      default: 0,
    },
    totalRides: {
      type: Number,
      default: 0,
    },
    currentLocation: {
      lat: Number,
      lng: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Index for userId lookup
DriverProfileSchema.index({ userId: 1 });

export default mongoose.model<IDriverProfile>('DriverProfile', DriverProfileSchema);
