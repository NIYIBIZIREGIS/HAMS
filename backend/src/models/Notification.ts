import { Schema, model, Document, Types } from 'mongoose';

export type NotificationType =
  | 'appointment'
  | 'lab_result'
  | 'prescription'
  | 'billing'
  | 'message'
  | 'general';

export interface INotification extends Document {
  facilityId?: Types.ObjectId;
  patientId?: Types.ObjectId;
  userId?: Types.ObjectId;
  doctorId?: Types.ObjectId;
  recipientType?: 'patient' | 'doctor' | 'user' | 'staff';
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities' },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patients' },
    userId: { type: Schema.Types.ObjectId, ref: 'Users' },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctors' },
    recipientType: { type: String, enum: ['patient', 'doctor', 'user', 'staff'] },
    type: {
      type: String,
      enum: ['appointment', 'lab_result', 'prescription', 'billing', 'message', 'general'],
      default: 'general',
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    link: { type: String, trim: true },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ patientId: 1, createdAt: -1 });
notificationSchema.index({ facilityId: 1, createdAt: -1 });
notificationSchema.index({ patientId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ doctorId: 1, createdAt: -1 });

export const Notification = model<INotification>('Notifications', notificationSchema);