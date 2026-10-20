/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // The isolation suite drives 46 real HTTP requests against MongoMemoryServer. On a
  // loaded machine a single test can exceed the 60s default, and booting the in-memory
  // database can exceed the default hook timeout, which fails an entire suite through
  // `beforeAll`. `testTimeout` also governs hooks, so it is the only knob needed.
  testTimeout: 180000,
  setupFiles: ['<rootDir>/tests/setup.ts'],
  maxWorkers: 1,
};
