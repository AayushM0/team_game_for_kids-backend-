import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  phone: string;
  role: 'rider' | 'driver';
  name: string;
  email?: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['rider', 'driver'],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 5,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast phone lookup
UserSchema.index({ phone: 1 });

export default mongoose.model<IUser>('User', UserSchema);
