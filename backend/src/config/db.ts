import mongoose from 'mongoose';
import { config } from './env';

export async function connectDB(uri?: string): Promise<typeof mongoose> {
  const connectionString = uri || config.mongoUri;
  mongoose.set('strictQuery', true);
  await mongoose.connect(connectionString, { serverSelectionTimeoutMS: 5000 });
  return mongoose;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
