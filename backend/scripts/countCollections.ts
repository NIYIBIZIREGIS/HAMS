/**
 * Prints the count of every collection in the seeded database.
 * Diagnostic only; run with: npx tsx scripts/countCollections.ts
 */
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db';

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection');

  const collections = await db.listCollections().toArray();
  const names = collections.map((c) => c.name).sort();

  const rows: { name: string; count: number }[] = [];
  for (const name of names) {
    const count = await db.collection(name).countDocuments();
    rows.push({ name, count });
  }

  const width = Math.max(...rows.map((r) => r.name.length));
  for (const row of rows) {
    console.log(`${row.name.padEnd(width)}  ${row.count}`);
  }
  console.log(`\n${rows.length} collections, ${rows.reduce((s, r) => s + r.count, 0)} documents`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});