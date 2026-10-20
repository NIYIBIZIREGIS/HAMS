import { app } from './app';
import { connectDB } from './config/db';
import { config } from './config/env';
import { seedIfNeeded } from './seed';

async function start() {
  await connectDB();
  if (config.seedOnStart) {
    await seedIfNeeded();
  }
  app.listen(config.port, () => {
    console.log(`HAS backend running on http://localhost:${config.port}`);
    console.log(`Swagger docs: http://localhost:${config.port}/api-docs`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
