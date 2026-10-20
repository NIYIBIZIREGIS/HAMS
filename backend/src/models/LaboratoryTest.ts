import { Schema, model, Document, Types } from 'mongoose';

export type LabTestStatus = 'Requested' | 'In Progress' | 'Completed';

export interface ILaboratoryTest extends Document {
  appointmentId: Types.ObjectId;
  medicalRecordId?: Types.ObjectId;
  facilityId: Types.ObjectId;
  patientId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  testName: string;
  fee?: number;
  result?: string;
  resultFileUrl?: string;
  referenceRange?: string;
  isAbnormal: boolean;
  status: LabTestStatus;
  requestedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const laboratoryTestSchema = new Schema<ILaboratoryTest>(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointments', required: true },
    medicalRecordId: { type: Schema.Types.ObjectId, ref: 'MedicalRecords', default: null },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patients', required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'Doctors', required: true },
    testName: { type: String, required: true, trim: true },
    fee: { type: Number, min: 0, default: 0 },
    result: { type: String, trim: true },
    resultFileUrl: { type: String, trim: true },
    referenceRange: { type: String, trim: true },
    isAbnormal: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['Requested', 'In Progress', 'Completed'],
      default: 'Requested',
    },
    requestedAt: { type: Date, default: () => new Date() },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

laboratoryTestSchema.index({ appointmentId: 1 });
laboratoryTestSchema.index({ patientId: 1, requestedAt: -1 });
laboratoryTestSchema.index({ facilityId: 1, status: 1 });
laboratoryTestSchema.index({ requestedBy: 1 });
laboratoryTestSchema.index({ status: 1 });

export const LaboratoryTest = model<ILaboratoryTest>('LaboratoryTests', laboratoryTestSchema);
