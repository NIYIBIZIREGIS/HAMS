import { Schema, model, Document, Types } from 'mongoose';

export interface IVitals {
  bloodPressure?: string;
  temperature?: number;
  weight?: number;
  height?: number;
  pulse?: number;
  oxygenSaturation?: number;
}

export interface IMedicalRecord extends Document {
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  appointmentId: Types.ObjectId;
  facilityId: Types.ObjectId;
  vitals?: IVitals;
  symptoms: string[];
  diagnosis: string;
  treatment?: string;
  notes?: string;
  followUpDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const vitalsSchema = new Schema<IVitals>(
  {
    bloodPressure: { type: String, trim: true },
    temperature: { type: Number, min: 30, max: 45 },
    weight: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    pulse: { type: Number, min: 0 },
    oxygenSaturation: { type: Number, min: 0, max: 100 },
  },
  { _id: false }
);

const medicalRecordSchema = new Schema<IMedicalRecord>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patients', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctors', required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointments', required: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', required: true },
    vitals: { type: vitalsSchema, default: {} },
    symptoms: { type: [String], default: [] },
    diagnosis: { type: String, required: true, trim: true },
    treatment: { type: String, trim: true },
    notes: { type: String, trim: true },
    followUpDate: { type: Date },
  },
  { timestamps: true }
);

// One record per appointment (a consultation creates at most one record)
medicalRecordSchema.index({ appointmentId: 1 }, { unique: true });
medicalRecordSchema.index({ patientId: 1, createdAt: -1 });
medicalRecordSchema.index({ doctorId: 1, createdAt: -1 });
medicalRecordSchema.index({ facilityId: 1, createdAt: -1 });

export const MedicalRecord = model<IMedicalRecord>('MedicalRecords', medicalRecordSchema);
