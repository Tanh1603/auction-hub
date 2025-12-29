/**
 * Jest Setup for Integration Tests
 *
 * CRITICAL: This file runs BEFORE any test files are loaded.
 * It must set all environment variables before any modules cache them.
 *
 * Key responsibilities:
 * 1. Set JWT secret FIRST (before any module imports it)
 * 2. Configure test environment
 * 3. Suppress expected error patterns
 * 4. Clear mocks between tests
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// STEP 1: Load .env IMMEDIATELY (before anything else)
// ============================================
const envPath = path.resolve(__dirname, '../../server/.env');

// CRITICAL: Force set the JWT secret FIRST, before any module can cache it
// This ensures both jest.setup.ts and test-helpers.ts use the same value
const FALLBACK_JWT_SECRET =
  '0qvsYzg5IvGfwEL6Wox0jmh9My22gJhu+5iUjVXYwpZXcZf2rm0cqmJE4PxzQLnKFmcAjfOYINbY8zlme8UXpw==';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      if (key && value) {
        // FORCE override for critical test vars (don't skip if already set)
        if (key === 'SUPABASE_JWT_SECRET' || key === 'DATABASE_URL') {
          process.env[key] = value;
        } else if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

// Ensure JWT secret is always set (fallback if .env missing)
if (!process.env.SUPABASE_JWT_SECRET) {
  process.env.SUPABASE_JWT_SECRET = FALLBACK_JWT_SECRET;
}
// Also set JWT_SECRET as an alias - some parts of the backend may check this key
process.env.JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

// ============================================
// STEP 2: Configure Jest Environment
// ============================================

// Increase timeout for integration tests (DB operations can be slow)
jest.setTimeout(60000);

// Set test environment
process.env.NODE_ENV = 'test';
process.env.AUTH_MODE = 'jwt'; // Ensure JWT mode is used

// ============================================
// STEP 3: Mock Cleanup Between Tests
// ============================================

// Clear all mocks after each test to prevent state leakage
afterEach(() => {
  jest.clearAllMocks();
});

// ============================================
// STEP 4: Suppress Verbose Error Logging
// ============================================

// Store original console.error for cleanup
const originalConsoleError = console.error;

console.error = (...args: unknown[]) => {
  const message = args[0]?.toString() || '';

  // Patterns that are EXPECTED during negative tests - suppress these
  const suppressPatterns = [
    'PrismaClientKnownRequestError', // Race condition tests
    'PrismaClientValidationError', // Validation tests
    'Unique constraint failed', // Duplicate registration tests
    'Error verifying payment', // Payment failure tests
    'StripeInvalidRequestError', // Stripe mock not set up
    'No such checkout.session', // Expected Stripe mock issue
    'jwt malformed', // Expected in invalid JWT tests
    'invalid signature', // Expected in invalid JWT tests
  ];

  const shouldSuppress = suppressPatterns.some((pattern) =>
    message.includes(pattern)
  );

  if (!shouldSuppress) {
    originalConsoleError.apply(console, args);
  }
};

// ============================================
// STEP 5: Log Test Environment (for debugging)
// ============================================

console.log('\n========================================');
console.log('Integration Test Environment:');
console.log('========================================');
console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  AUTH_MODE: ${process.env.AUTH_MODE}`);
console.log(
  `  JWT_SECRET: ${
    process.env.SUPABASE_JWT_SECRET
      ? `[SET - ${process.env.SUPABASE_JWT_SECRET.substring(0, 10)}...]`
      : '[NOT SET - CRITICAL ERROR]'
  }`
);
console.log(`  Timeout: 60s`);
console.log(`  Mocks: Cleared after each test`);
console.log(`  Error Logging: Suppressing expected patterns`);
console.log('========================================\n');

// Validate JWT secret is set
if (!process.env.SUPABASE_JWT_SECRET) {
  throw new Error(
    'CRITICAL: SUPABASE_JWT_SECRET not set! Tests will fail with 401 errors.'
  );
}
