import { Schema, model, Document, Types } from 'mongoose';

export interface IPatient extends Document {
  userId: Types.ObjectId;
  /**
   * Owning hospital. Set when a receptionist registers the patient at their facility.
   * Stays null for patients who self-registered through the public portal and have not
   * yet been linked to a hospital; those patients are reachable by hospital staff
   * through their appointments rather than through the patient directory.
   */
  facilityId?: Types.ObjectId | null;
  patientNumber: string;
  nationalHealthId?: string;
  dob?: Date;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: string;
  allergies: string[];
  chronicConditions: string[];
  insurance?: {
    provider?: string;
    policyNumber?: string;
    coverageType?: string;
    validTill?: Date;
  };
  governmentScheme?: {
    schemeName?: string;
    beneficiaryNumber?: string;
    indigentStatus?: boolean;
  };
  emergencyContact?: { name?: string; relation?: string; phone?: string };
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'Users', required: true, unique: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', default: null },
    patientNumber: { type: String, required: true, unique: true, trim: true },
    nationalHealthId: { type: String, unique: true, sparse: true, trim: true },
    dob: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    bloodGroup: { type: String, trim: true },
    allergies: { type: [String], default: [] },
    chronicConditions: { type: [String], default: [] },
    insurance: {
      provider: { type: String },
      policyNumber: { type: String },
      coverageType: { type: String },
      validTill: { type: Date },
    },
    governmentScheme: {
      schemeName: { type: String },
      beneficiaryNumber: { type: String },
      indigentStatus: { type: Boolean, default: false },
    },
    emergencyContact: {
      name: { type: String },
      relation: { type: String },
      phone: { type: String },
    },
  },
  { timestamps: true }
);

patientSchema.index({ facilityId: 1, patientNumber: 1 });
patientSchema.index({ facilityId: 1, userId: 1 });

export const Patient = model<IPatient>('Patients', patientSchema);
