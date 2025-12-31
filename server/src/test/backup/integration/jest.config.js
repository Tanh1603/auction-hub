/**
 * Jest Configuration for Integration Tests
 *
 * Runs API integration tests against the NestJS server
 * with a real database connection.
 */

module.exports = {
  displayName: 'integration',
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Transform TypeScript files
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },

  // Module path mappings
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../server/src/$1',
  },

  // Root directory
  rootDir: '.',

  // Test file patterns - match .spec.ts files in subdirectories
  testMatch: ['**/*.spec.ts'],

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/'],

  // Setup files
  setupFilesAfterEnv: ['./jest.setup.ts'],

  // Timeout for each test (30 seconds)
  testTimeout: 30000,

  // Run tests serially to avoid database conflicts
  maxWorkers: 1,

  // Verbose output
  verbose: true,

  // Coverage settings
  collectCoverageFrom: [
    '../../server/src/**/*.ts',
    '!../../server/src/**/*.module.ts',
    '!../../server/src/main.ts',
  ],

  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './reports',
        outputName: 'integration-test-results.xml',
      },
    ],
  ],
};
