/**
 * Jest Setup for Integration Tests
 *
 * Configures test environment before running tests.
 */

// Increase timeout for integration tests
jest.setTimeout(30000);

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AUTH_MODE = 'test'; // Enable test mode for AuthGuard

// Default JWT secret for testing
if (!process.env.JWT_SECRET && !process.env.SUPABASE_JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';
}

// Log test environment
console.log('Integration Test Environment:');
console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  AUTH_MODE: ${process.env.AUTH_MODE}`);
console.log(`  JWT_SECRET: ${process.env.JWT_SECRET ? '[SET]' : '[NOT SET]'}`);
