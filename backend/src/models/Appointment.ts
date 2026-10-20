import { Schema, model, Document, Types } from 'mongoose';

export type AppointmentStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Checked In'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled'
  | 'Missed'
  | 'Rejected';

/** Single source of truth for the schema enum and for status query filters. */
export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'Pending',
  'Confirmed',
  'Checked In',
  'In Progress',
  'Completed',
  'Cancelled',
  'Missed',
  'Rejected',
];

export interface IAppointment extends Document {
  facilityId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  departmentId: Types.ObjectId;
  appointmentDate: Date;
  timeSlot: string;
  reason?: string;
  visitType: 'new' | 'follow-up' | 'referral';
  bookingChannel: 'web' | 'mobile' | 'sms' | 'ussd' | 'walk_in' | 'referral';
  status: AppointmentStatus;
  queueNumber?: number;
  checkInTime?: Date;
  completedAt?: Date;
  cancellationReason?: string;
  referralId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patients', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctors', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Departments', required: true },
    appointmentDate: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    reason: { type: String, trim: true },
    visitType: {
      type: String,
      enum: ['new', 'follow-up', 'referral'],
      default: 'new',
    },
    bookingChannel: {
      type: String,
      enum: ['web', 'mobile', 'sms', 'ussd', 'walk_in', 'referral'],
      default: 'web',
    },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: 'Pending',
    },
    queueNumber: { type: Number },
    checkInTime: { type: Date },
    completedAt: { type: Date },
    cancellationReason: { type: String, trim: true },
    referralId: { type: Schema.Types.ObjectId, ref: 'Referrals', default: null },
  },
  { timestamps: true }
);

// Speeds up slot-conflict lookups (uniqueness is enforced in bookingService,
// since a slot may allow more than one patient when maxPatientsPerSlot > 1).
appointmentSchema.index({ doctorId: 1, appointmentDate: 1, timeSlot: 1 });
// Frequently queried fields
appointmentSchema.index({ patientId: 1 });
appointmentSchema.index({ facilityId: 1, appointmentDate: 1 });
appointmentSchema.index({ doctorId: 1, appointmentDate: 1 });
appointmentSchema.index({ status: 1 });

export const Appointment = model<IAppointment>('Appointments', appointmentSchema);
