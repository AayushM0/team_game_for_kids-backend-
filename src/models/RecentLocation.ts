import mongoose, { Schema, Document } from 'mongoose';

export interface IRecentLocation extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: 'home' | 'work' | 'other' | 'visited';
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RecentLocationSchema = new Schema<IRecentLocation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['home', 'work', 'other', 'visited'],
      default: 'other',
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast userId lookup
RecentLocationSchema.index({ userId: 1, lastUsed: -1 });

export default mongoose.model<IRecentLocation>('RecentLocation', RecentLocationSchema);
