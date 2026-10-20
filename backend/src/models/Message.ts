import { Schema, model, Document, Types } from 'mongoose';

export interface IMessage extends Document {
  facilityId: Types.ObjectId;
  patientId: Types.ObjectId;
  /**
   * Conversation key. The first message in a thread points at its own id; every reply points
   * back at the first. Stored on every row so a thread can be listed without a self-join.
   *
   * Messages written before threading existed have no value here and are treated as
   * single-message threads keyed on their own id, so no backfill is required to read them.
   */
  threadId?: Types.ObjectId;
  /** Which side of the conversation this message was sent from. */
  direction: 'to_patient' | 'to_staff';
  /** The account that sent it, so a patient reply is distinguishable from hospital mail. */
  senderUserId?: Types.ObjectId;
  senderName: string;
  subject: string;
  body: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patients', required: true },
    threadId: { type: Schema.Types.ObjectId, ref: 'Messages' },
    direction: { type: String, enum: ['to_patient', 'to_staff'], default: 'to_patient' },
    senderUserId: { type: Schema.Types.ObjectId, ref: 'Users' },
    senderName: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

messageSchema.index({ patientId: 1, createdAt: -1 });
messageSchema.index({ facilityId: 1, createdAt: -1 });
messageSchema.index({ patientId: 1, isRead: 1 });
messageSchema.index({ threadId: 1, createdAt: 1 });
messageSchema.index({ threadId: 1, isRead: 1 });

export const Message = model<IMessage>('Messages', messageSchema);
