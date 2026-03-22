/**
 * Jest Configuration for Integration Tests
 *
 * Runs API integration tests against the NestJS server
 * with a real database connection.
 *
 * COVERAGE SETUP:
 * - rootDir is set to project root to allow coverage collection from server/src
 * - 'roots' specifies both test and source directories
 * - forceCoverageMatch ensures server code is instrumented even when imported via NestJS
 */
const path = require('path');

module.exports = {
  displayName: 'integration',
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Set rootDir to project root to enable coverage from server/src
  rootDir: path.resolve(__dirname, '../..'),

  // Specify roots for test discovery and module resolution
  roots: ['<rootDir>/test/integration', '<rootDir>/server/src'],

  // Transform TypeScript files (paths now relative to project root)
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/test/integration/tsconfig.json',
      },
    ],
  },

  // Module path mappings
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/src/$1',
  },

  // Test file patterns - match .spec.ts files in test/integration subdirectories
  testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/'],

  // Global setup - runs before test files are compiled
  globalSetup: '<rootDir>/test/integration/jest.globalSetup.js',

  // Setup files - runs after Jest is loaded
  setupFilesAfterEnv: ['<rootDir>/test/integration/jest.setup.ts'],

  // Timeout for each test (60 seconds to match jest.setup.ts)
  testTimeout: 60000,

  // Run tests serially to avoid database conflicts
  maxWorkers: 1,

  // Force Jest to exit after tests complete (prevents hanging from unclosed handles)
  forceExit: true,

  // Detect open handles for debugging (can be disabled in CI for speed)
  detectOpenHandles: false,

  // Verbose output
  verbose: true,

  // Coverage settings
  collectCoverage: true,
  coverageDirectory: '<rootDir>/test/integration/coverage',

  // Use babel provider - works better with ts-jest for coverage
  coverageProvider: 'babel',

  // Collect coverage from server source files
  collectCoverageFrom: [
    'server/src/**/*.ts',
    '!server/src/**/*.module.ts',
    '!server/src/**/*.spec.ts',
    '!server/src/**/*.test.ts',
    '!server/src/main.ts',
    '!server/src/**/*.d.ts',
  ],

  // Force match these patterns for coverage even if not directly imported by tests
  // This is critical for integration tests which use NestJS testing module
  forceCoverageMatch: ['server/src/**/*.ts'],

  // Ignore paths that should not appear in coverage reports
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/generated/',
    '\\.module\\.ts$',
    '\\.spec\\.ts$',
  ],

  // Coverage thresholds (optional - uncomment to enforce minimums)
  // coverageThreshold: {
  //   global: {
  //     branches: 50,
  //     functions: 50,
  //     lines: 50,
  //     statements: 50,
  //   },
  // },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'clover', 'json'],

  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/test/integration/reports',
        outputName: 'integration-test-results.xml',
      },
    ],
    // Custom bug reporter - generates BUG_REPORT_GENERATED.txt on failures
    '<rootDir>/utils/custom-bug-reporter.js',
  ],
};
