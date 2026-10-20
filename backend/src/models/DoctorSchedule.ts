import { Schema, model, Document, Types } from 'mongoose';

export interface IDoctorSchedule extends Document {
  doctorId: Types.ObjectId;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
  slotDurationMinutes: number;
  maxPatientsPerSlot: number;
  isActive: boolean;
}

const doctorScheduleSchema = new Schema<IDoctorSchedule>(
  {
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctors', required: true },
    dayOfWeek: { type: Number, enum: [0, 1, 2, 3, 4, 5, 6], required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    breakStart: { type: String, default: '' },
    breakEnd: { type: String, default: '' },
    slotDurationMinutes: { type: Number, default: 15, min: 5, max: 120 },
    maxPatientsPerSlot: { type: Number, default: 1, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

doctorScheduleSchema.index({ doctorId: 1, dayOfWeek: 1 }, { unique: true });

export const DoctorSchedule = model<IDoctorSchedule>('DoctorSchedules', doctorScheduleSchema);
