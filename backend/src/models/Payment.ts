import { Schema, model, Document, Types } from 'mongoose';

export type PaymentMethod = 'cash' | 'card' | 'online' | 'insurance' | 'government_scheme';
export type PaymentStatus = 'Pending' | 'Partially Paid' | 'Paid' | 'Refunded' | 'Failed';
/** How the payment row came to exist. */
export type PaymentSource = 'staff' | 'portal';

export interface IPaymentBreakdown {
  consultationFee: number;
  labCharges: number;
  pharmacyCharges: number;
  discount: number;
  tax: number;
  schemeSubsidy: number;
}

export interface IPayment extends Document {
  appointmentId: Types.ObjectId;
  patientId: Types.ObjectId;
  facilityId: Types.ObjectId;
  amount: number;
  breakdown: IPaymentBreakdown;
  method: PaymentMethod;
  status: PaymentStatus;
  source: PaymentSource;
  /** Human-facing handle for a portal request, e.g. `PAY-7F3K2Q`. */
  requestReference?: string;
  /** Portal user who asked to pay. Absent for staff-recorded payments. */
  requestedBy?: Types.ObjectId;
  /** Staff user who confirmed funds were actually received. */
  confirmedBy?: Types.ObjectId;
  confirmedAt?: Date;
  receiptNumber?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentBreakdownSchema = new Schema<IPaymentBreakdown>(
  {
    consultationFee: { type: Number, min: 0, default: 0 },
    labCharges: { type: Number, min: 0, default: 0 },
    pharmacyCharges: { type: Number, min: 0, default: 0 },
    discount: { type: Number, min: 0, default: 0 },
    tax: { type: Number, min: 0, default: 0 },
    schemeSubsidy: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const paymentSchema = new Schema<IPayment>(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointments', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patients', required: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', required: true },
    amount: { type: Number, required: true, min: 0 },
    breakdown: { type: paymentBreakdownSchema, required: true, default: () => ({}) },
    method: {
      type: String,
      enum: ['cash', 'card', 'online', 'insurance', 'government_scheme'],
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Partially Paid', 'Paid', 'Refunded', 'Failed'],
      default: 'Pending',
    },
    // Staff-recorded payments are settled on creation, so they default to `staff` and
    // stay `Pending` only when a portal request is waiting to be confirmed.
    source: { type: String, enum: ['staff', 'portal'], default: 'staff' },
    requestReference: { type: String, unique: true, sparse: true, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    confirmedBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    confirmedAt: { type: Date },
    receiptNumber: { type: String, unique: true, sparse: true, trim: true },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

paymentSchema.index({ appointmentId: 1 });
paymentSchema.index({ patientId: 1 });
paymentSchema.index({ facilityId: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });
// Supports the "is this visit already being paid?" check without a collection scan.
paymentSchema.index({ appointmentId: 1, status: 1 });

export const Payment = model<IPayment>('Payments', paymentSchema);