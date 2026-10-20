import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db';

let mongo: MongoMemoryServer;

export async function connectTestDB(): Promise<void> {
  mongo = await MongoMemoryServer.create({
    instance: {
      storageEngine: 'wiredTiger',
      // The library's default is a 10s ceiling on mongod startup, which is fine on an idle
      // machine and reliably too short on a loaded one. Suites reporting
      // "Instance failed to start within 10000ms" were a timing artefact of the host, not a
      // defect in the code under test, so the ceiling is raised rather than papered over.
      launchTimeout: 120000,
    },
    // Without an explicit version, each worker can try to resolve a different default
    // binary and fail intermittently when several suites start in parallel. The repo
    // sets this in mongodb-memory-server's package config; repeating it here keeps
    // direct `npx jest` runs deterministic.
    binary: { version: process.env.MONGO_MEMORY_VERSION || '8.0.13' },
  });
  const uri = mongo.getUri();
  await connectDB(uri);
}

export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

export async function closeTestDB(): Promise<void> {
  await disconnectDB();
  if (mongo) await mongo.stop();
}
