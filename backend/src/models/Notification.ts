import { Schema, model, Document, Types } from 'mongoose';

export type NotificationType =
  | 'appointment'
  | 'lab_result'
  | 'prescription'
  | 'billing'
  | 'general';

export interface INotification extends Document {
  facilityId: Types.ObjectId;
  patientId: Types.ObjectId;
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
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patients', required: true },
    type: {
      type: String,
      enum: ['appointment', 'lab_result', 'prescription', 'billing', 'general'],
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

export const Notification = model<INotification>('Notifications', notificationSchema);