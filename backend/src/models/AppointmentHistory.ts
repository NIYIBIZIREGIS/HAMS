import { Schema, model, Document, Types } from 'mongoose';
import type { AppointmentStatus } from './Appointment';

export interface IAppointmentHistory extends Document {
  appointmentId: Types.ObjectId;
  facilityId: Types.ObjectId;
  fromStatus: AppointmentStatus;
  toStatus: AppointmentStatus;
  changedBy: Types.ObjectId;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentHistorySchema = new Schema<IAppointmentHistory>(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointments', required: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', required: true },
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

appointmentHistorySchema.index({ appointmentId: 1, createdAt: -1 });
appointmentHistorySchema.index({ facilityId: 1, createdAt: -1 });

export const AppointmentHistory = model<IAppointmentHistory>(
  'AppointmentHistories',
  appointmentHistorySchema
);
