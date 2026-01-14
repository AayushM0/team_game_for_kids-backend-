import mongoose, { Schema, Document } from 'mongoose';

export interface IDailyEarning {
  date: Date;
  amount: number;
  trips: number;
}

export interface IDriverStats extends Document {
  userId: mongoose.Types.ObjectId;
  weeklyEarnings: IDailyEarning[];
  todayTrips: number;
  todayOnlineTime: number; // in minutes
  createdAt: Date;
  updatedAt: Date;
}

const DriverStatsSchema = new Schema<IDriverStats>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    weeklyEarnings: [
      {
        date: { type: Date, required: true },
        amount: { type: Number, default: 0 },
        trips: { type: Number, default: 0 },
      },
    ],
    todayTrips: {
      type: Number,
      default: 0,
    },
    todayOnlineTime: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for userId lookup
DriverStatsSchema.index({ userId: 1 });

export default mongoose.model<IDriverStats>('DriverStats', DriverStatsSchema);
