import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  rideId: mongoose.Types.ObjectId;
  amount: number;
  paidStatus: 'unpaid' | 'paid';
  paymentMethod?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    rideId: {
      type: Schema.Types.ObjectId,
      ref: 'Ride',
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paidStatus: {
      type: String,
      enum: ['unpaid', 'paid'],
      default: 'unpaid',
    },
    paymentMethod: {
      type: String,
      default: 'cash',
    },
  },
  {
    timestamps: true,
  }
);

// Index for ride lookup
PaymentSchema.index({ rideId: 1 });

export default mongoose.model<IPayment>('Payment', PaymentSchema);
