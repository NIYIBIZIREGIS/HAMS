import { Schema, model, Document } from 'mongoose';

export interface ICounter extends Document {
  name: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  {
    name: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Counter = model<ICounter>('Counters', counterSchema);

/**
 * Atomically increment a named counter and return the new value.
 * Uses findOneAndUpdate with upsert + $inc for race-safe sequential IDs.
 */
export async function nextSeq(name: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return doc.seq;
}
