import { Schema, model, Document, Types } from 'mongoose';

export type DocumentCategory =
  | 'prescription'
  | 'lab_result'
  | 'medical_report'
  | 'billing_receipt'
  | 'general';

export interface IPatientDocument extends Document {
  facilityId: Types.ObjectId;
  patientId: Types.ObjectId;
  category: DocumentCategory;
  title: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const patientDocumentSchema = new Schema<IPatientDocument>(
  {
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patients', required: true },
    category: {
      type: String,
      enum: ['prescription', 'lab_result', 'medical_report', 'billing_receipt', 'general'],
      default: 'general',
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    fileName: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true, trim: true },
    mimeType: { type: String, trim: true, maxlength: 100 },
    sizeBytes: { type: Number, min: 0 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
  },
  { timestamps: true }
);

patientDocumentSchema.index({ patientId: 1, createdAt: -1 });
patientDocumentSchema.index({ facilityId: 1, category: 1 });
patientDocumentSchema.index({ patientId: 1, category: 1 });

export const PatientDocument = model<IPatientDocument>('PatientDocuments', patientDocumentSchema);