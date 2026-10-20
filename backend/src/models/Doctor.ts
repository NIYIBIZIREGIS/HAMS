import { Schema, model, Document, Types } from 'mongoose';

export interface IDoctor extends Document {
  userId: Types.ObjectId;
  facilityId: Types.ObjectId;
  departmentId: Types.ObjectId[];
  licenseNumber?: string;
  specialization: string[];
  qualification: string[];
  experienceYears?: number;
  consultationFee?: { newVisit?: number; followUp?: number };
  bio?: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

const doctorSchema = new Schema<IDoctor>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'Users', required: true, unique: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', required: true },
    departmentId: { type: [Schema.Types.ObjectId], ref: 'Departments', default: [] },
    licenseNumber: { type: String, trim: true },
    specialization: { type: [String], default: [] },
    qualification: { type: [String], default: [] },
    experienceYears: { type: Number, min: 0 },
    consultationFee: {
      newVisit: { type: Number, min: 0 },
      followUp: { type: Number, min: 0 },
    },
    bio: { type: String, trim: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
  },
  { timestamps: true }
);

doctorSchema.index({ facilityId: 1 });
doctorSchema.index({ departmentId: 1 });

export const Doctor = model<IDoctor>('Doctors', doctorSchema);
