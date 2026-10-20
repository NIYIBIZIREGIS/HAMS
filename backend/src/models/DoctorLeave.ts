import { Schema, model, Document, Types } from 'mongoose';

export interface IDoctorLeave extends Document {
  doctorId: Types.ObjectId;
  date: Date;
  reason?: string;
}

const doctorLeaveSchema = new Schema<IDoctorLeave>(
  {
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctors', required: true },
    date: { type: Date, required: true },
    reason: { type: String, trim: true },
  },
  { timestamps: true }
);

doctorLeaveSchema.index({ doctorId: 1, date: 1 }, { unique: true });

export const DoctorLeave = model<IDoctorLeave>('DoctorLeaves', doctorLeaveSchema);
