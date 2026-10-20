import { Schema, model, Document, Types } from 'mongoose';

export interface IPrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
}

export interface IPrescription extends Document {
  medicalRecordId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  facilityId: Types.ObjectId;
  medicines: IPrescriptionMedicine[];
  instructions?: string;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const medicineSchema = new Schema<IPrescriptionMedicine>(
  {
    name: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    frequency: { type: String, required: true, trim: true },
    durationDays: { type: Number, required: true, min: 1 },
    instructions: { type: String, trim: true },
  },
  { _id: false }
);

const prescriptionSchema = new Schema<IPrescription>(
  {
    medicalRecordId: { type: Schema.Types.ObjectId, ref: 'MedicalRecords', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patients', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctors', required: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', required: true },
    medicines: { type: [medicineSchema], required: true },
    instructions: { type: String, trim: true },
    issuedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

prescriptionSchema.index({ medicalRecordId: 1 });
prescriptionSchema.index({ patientId: 1, issuedAt: -1 });
prescriptionSchema.index({ doctorId: 1, issuedAt: -1 });
prescriptionSchema.index({ facilityId: 1 });

export const Prescription = model<IPrescription>('Prescriptions', prescriptionSchema);
