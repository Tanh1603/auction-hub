/**
 * Shared Test Helpers for Integration Tests
 *
 * Provides utilities for:
 * - JWT token generation
 * - Test user creation
 * - Database cleanup
 * - Date helpers
 */

import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import { AppModule } from '../../../server/src/app/app.module';
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { UserRole, UserType } from '../../../server/generated';

// Load environment variables from server/.env
dotenv.config({ path: path.resolve(__dirname, '../../../server/.env') });

// ============================================
// Test App Initialization
// ============================================

export interface TestAppContext {
  app: INestApplication;
  prisma: PrismaService;
  moduleFixture: TestingModule;
}

/**
 * Silent logger for tests - suppresses error logs to keep output clean.
 * Expected errors during negative tests (e.g., ConflictException) won't clutter the console.
 */
const silentLogger = {
  log: (message: string) => {
    // Only log important startup messages
    if (message.includes('Nest application successfully started')) {
      console.log(`[Test] ${message}`);
    }
  },
  error: () => {
    // Suppress error logs during tests - they're expected in negative tests
  },
  warn: () => {
    // Suppress warnings during tests
  },
  debug: () => {
    // Suppress debug logs
  },
  verbose: () => {
    // Suppress verbose logs
  },
};

/**
 * Initializes a NestJS test application with proper configuration.
 * IMPORTANT: This sets the global 'api' prefix to match main.ts production config.
 * Without this, routes like '/api/manual-bid' would return 404.
 *
 * Uses a silent logger to suppress expected error logs during negative tests.
 */
export async function initTestApp(): Promise<TestAppContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Use silent logger to suppress expected errors during tests
  app.useLogger(silentLogger);

  // CRITICAL: Set global prefix to match main.ts
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  await app.init();

  const prisma = moduleFixture.get<PrismaService>(PrismaService);

  return { app, prisma, moduleFixture };
}

/**
 * Properly closes a test application and disconnects from database.
 * IMPORTANT: Call this in afterAll() to prevent Jest from hanging.
 *
 * Usage:
 * afterAll(async () => {
 *   await closeTestApp(app, prisma);
 * });
 */
export async function closeTestApp(
  app: INestApplication,
  prisma: PrismaService
): Promise<void> {
  try {
    // Disconnect Prisma first to ensure no pending DB operations
    await prisma.$disconnect();
  } catch {
    // Ignore disconnection errors
  }

  try {
    // Then close the Nest application
    await app.close();
  } catch {
    // Ignore close errors
  }
}

// ============================================
// Response Helpers
// ============================================

/**
 * Extracts data from API response, handling both wrapped { data: {...} }
 * and unwrapped direct response formats.
 * Usage: const data = getResponseData(response);
 */
export function getResponseData<T = unknown>(response: {
  body: { data?: T } & T;
}): T {
  return (response.body.data || response.body) as T;
}

// ============================================
// Types
// ============================================

export interface TestUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  userType: UserType;
  isBanned: boolean;
  isVerified: boolean;
}

export interface CreateUserOptions {
  email: string;
  role?: UserRole;
  userType?: UserType;
  isVerified?: boolean;
  isBanned?: boolean;
  fullName?: string;
}

// ============================================
// JWT Helpers
// ============================================

// CRITICAL: Use a getter function to read JWT secret at runtime
// This ensures we pick up the value set by jest.setup.ts, not a cached value
const FALLBACK_JWT_SECRET =
  '0qvsYzg5IvGfwEL6Wox0jmh9My22gJhu+5iUjVXYwpZXcZf2rm0cqmJE4PxzQLnKFmcAjfOYINbY8zlme8UXpw==';

function getJwtSecret(): string {
  const secret = process.env.SUPABASE_JWT_SECRET || FALLBACK_JWT_SECRET;
  return secret;
}

/**
 * Creates a valid JWT token for testing
 * Mimics Supabase JWT structure with required claims for AuthGuard
 */
export function createTestJWT(user: TestUser, role?: UserRole): string {
  const userRole = role || user.role;
  const jwtSecret = getJwtSecret();

  const payload = {
    // Core claims
    sub: user.id,
    email: user.email,
    // Supabase requires 'aud' claim
    aud: 'authenticated',
    // Role for Supabase strategies (some check this)
    role: 'authenticated',
    // App metadata contains the actual app-level role
    app_metadata: {
      role: userRole,
    },
    // User metadata
    user_metadata: {
      full_name: user.fullName,
      role: userRole,
    },
    // Standard JWT claims
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  };

  return jwt.sign(payload, jwtSecret, { algorithm: 'HS256' });
}

/**
 * Creates an expired JWT token for testing rejection
 */
export function createExpiredJWT(user: TestUser): string {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
    exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
  };

  return jwt.sign(payload, getJwtSecret(), { algorithm: 'HS256' });
}

/**
 * Creates a JWT token with invalid signature
 */
export function createInvalidJWT(user: TestUser): string {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  return jwt.sign(payload, 'wrong-secret-key', { algorithm: 'HS256' });
}

// ============================================
// User Factory
// ============================================

/**
 * Creates a test user in the database
 */
export async function createTestUser(
  prisma: PrismaService,
  options: CreateUserOptions
): Promise<TestUser> {
  const user = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      email: options.email,
      fullName: options.fullName || `Test User ${Date.now()}`,
      role: options.role || UserRole.bidder,
      userType: options.userType || UserType.individual,
      isBanned: options.isBanned || false,
      isVerified: options.isVerified !== false, // Default true
      phoneNumber: `09${Math.floor(Math.random() * 100000000)
        .toString()
        .padStart(8, '0')}`,
      identityNumber: `0${Math.floor(Math.random() * 100000000000)
        .toString()
        .padStart(11, '0')}`,
    },
  });

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName || '',
    role: user.role as UserRole,
    userType: user.userType as UserType,
    isBanned: user.isBanned,
    isVerified: user.isVerified,
  };
}

// ============================================
// Date Helpers
// ============================================

/**
 * Creates a date relative to now
 * @param days Days from now (negative for past)
 * @param hours Hours offset
 * @param minutes Minutes offset
 */
export function createDate(days: number, hours = 0, minutes = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(date.getHours() + hours);
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

// ============================================
// Test Data Generators
// ============================================

let emailCounter = 0;

/**
 * Generates a unique test email
 */
export function generateTestEmail(prefix = 'test'): string {
  emailCounter++;
  return `${prefix}_${Date.now()}_${emailCounter}@test.com`;
}

/**
 * Generates a valid Vietnamese phone number
 */
export function generateVietnamesePhone(): string {
  const prefixes = ['090', '091', '093', '094', '096', '097', '098', '099'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.floor(Math.random() * 10000000)
    .toString()
    .padStart(7, '0');
  return `${prefix}${suffix}`;
}

/**
 * Generates a valid CCCD number (12 digits)
 * Format: [ProvinceCode 3 digits][Gender+Century 1 digit][YY 2 digits][Random 6 digits]
 * Province codes must match the regex pattern in the DTO
 */
export function generateCCCD(): string {
  // Valid province codes that match the regex pattern
  const validProvinceCodes = [
    '001',
    '002',
    '004',
    '006',
    '008',
    '010',
    '011',
    '012',
    '014',
    '015',
    '017',
    '019',
    '020',
    '022',
    '024',
    '025',
    '026',
    '027',
    '030',
    '031',
    '033',
    '034',
    '035',
    '036',
    '037',
    '038',
    '040',
    '042',
    '044',
    '045',
    '046',
    '048',
    '049',
    '051',
    '052',
    '054',
    '056',
    '058',
    '060',
    '062',
    '064',
    '066',
    '067',
    '068',
    '070',
    '072',
    '074',
    '075',
    '077',
    '079',
    '080',
    '082',
    '083',
    '084',
    '086',
    '087',
    '089',
    '091',
    '092',
    '093',
    '094',
    '095',
    '096',
  ];
  const provinceCode =
    validProvinceCodes[Math.floor(Math.random() * validProvinceCodes.length)];
  // Gender+century digit (0-3 for valid pattern)
  const genderCentury = Math.floor(Math.random() * 4).toString();
  // Year of birth (2 digits)
  const yearOfBirth = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, '0');
  // Random 6 digits
  const randomDigits = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, '0');
  return `${provinceCode}${genderCentury}${yearOfBirth}${randomDigits}`;
}

// ============================================
// Valid Payloads
// ============================================

export const validRegistrationPayload = () => ({
  email: generateTestEmail('reg'),
  password: 'SecurePass123!',
  full_name: 'Test User',
  user_type: 'individual',
  phone_number: generateVietnamesePhone(),
  identity_number: generateCCCD(),
});

export const validLoginPayload = (email: string) => ({
  email,
  password: 'SecurePass123!',
});

// ============================================
// Database Cleanup
// ============================================

/**
 * Cleans up test users by email pattern and their dependent data
 */
export async function cleanupTestUsers(prisma: PrismaService): Promise<void> {
  const testEmailFilter = {
    OR: [
      { email: { contains: '@test.com' } },
      { email: { contains: '_test_' } },
    ],
  };

  // 1. Delete dependent records first (Child tables) to prevent foreign key violations

  // Contracts where any related user matches the test pattern
  await prisma.contract.deleteMany({
    where: {
      OR: [
        { buyer: testEmailFilter },
        { propertyOwner: testEmailFilter },
        { creator: testEmailFilter },
      ],
    },
  });

  // Bids where the participant or denier matches the test pattern
  await prisma.auctionBid.deleteMany({
    where: {
      OR: [
        { participant: { user: testEmailFilter } },
        { denier: testEmailFilter },
      ],
    },
  });

  // Audit Logs performed by test users
  await prisma.auctionAuditLog.deleteMany({
    where: {
      user: testEmailFilter,
    },
  });

  // Participants (and cascaded AutoBidSettings)
  // Covers where user is the participant, verifier, or confirmer
  await prisma.auctionParticipant.deleteMany({
    where: {
      OR: [
        { user: testEmailFilter },
        { documentsVerifier: testEmailFilter },
        { confirmer: testEmailFilter },
      ],
    },
  });

  // Payments
  await prisma.payment.deleteMany({
    where: {
      user: testEmailFilter,
    },
  });

  // 2. Finally, delete the users (Parent table)
  await prisma.user.deleteMany({
    where: testEmailFilter,
  });
}

/**
 * Comprehensive cleanup for test data
 */
export async function cleanupTestData(
  prisma: PrismaService,
  codePrefix: string
): Promise<void> {
  const auctions = await prisma.auction.findMany({
    where: { code: { startsWith: codePrefix } },
    select: { id: true },
  });
  const auctionIds = auctions.map((a) => a.id);

  await prisma.$transaction([
    prisma.auctionAuditLog.deleteMany({
      where: { auctionId: { in: auctionIds } },
    }),
    prisma.contract.deleteMany({
      where: { auctionId: { in: auctionIds } },
    }),
    prisma.payment.deleteMany({
      where: { auctionId: { in: auctionIds } },
    }),
    prisma.auctionBid.deleteMany({
      where: { auctionId: { in: auctionIds } },
    }),
    prisma.auctionParticipant.deleteMany({
      where: { auctionId: { in: auctionIds } },
    }),
    prisma.auctionCost.deleteMany({
      where: { auctionId: { in: auctionIds } },
    }),
    prisma.auctionRelation.deleteMany({
      where: {
        OR: [
          { auctionId: { in: auctionIds } },
          { relatedAuctionId: { in: auctionIds } },
        ],
      },
    }),
    prisma.auction.deleteMany({ where: { id: { in: auctionIds } } }),
  ]);
  await cleanupTestUsers(prisma);
}
