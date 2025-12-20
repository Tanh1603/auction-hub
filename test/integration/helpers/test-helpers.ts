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
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { UserRole, UserType } from '../../../server/generated';
import { Decimal } from '@prisma/client/runtime/library';

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

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  'test-jwt-secret';

/**
 * Creates a valid JWT token for testing
 */
export function createTestJWT(user: TestUser, role?: UserRole): string {
  const payload = {
    sub: user.id,
    email: user.email,
    role: role || user.role,
    user_metadata: {
      full_name: user.fullName,
      role: role || user.role,
    },
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  };

  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
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

  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
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
      email: options.email,
      fullName: options.fullName || `Test User ${Date.now()}`,
      role: options.role || UserRole.bidder,
      userType: options.userType || UserType.individual,
      isBanned: options.isBanned || false,
      isVerified: options.isVerified !== false, // Default true
      phone: `09${Math.floor(Math.random() * 100000000)
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
 */
export function generateCCCD(): string {
  return `0${Math.floor(Math.random() * 100000000000)
    .toString()
    .padStart(11, '0')}`;
}

// ============================================
// Valid Payloads
// ============================================

export const validRegistrationPayload = () => ({
  email: generateTestEmail('reg'),
  password: 'SecurePass123!',
  full_name: 'Test User',
  user_type: 'individual',
  phone: generateVietnamesePhone(),
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
 * Cleans up test users by email pattern
 */
export async function cleanupTestUsers(prisma: PrismaService): Promise<void> {
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { contains: '@test.com' } },
        { email: { contains: '_test_' } },
      ],
    },
  });
}

/**
 * Comprehensive cleanup for test data
 */
export async function cleanupTestData(
  prisma: PrismaService,
  codePrefix: string
): Promise<void> {
  await prisma.$transaction([
    prisma.auctionAuditLog.deleteMany({
      where: { auction: { code: { startsWith: codePrefix } } },
    }),
    prisma.contract.deleteMany({
      where: { auction: { code: { startsWith: codePrefix } } },
    }),
    prisma.payment.deleteMany({
      where: { auction: { code: { startsWith: codePrefix } } },
    }),
    prisma.auctionBid.deleteMany({
      where: { auction: { code: { startsWith: codePrefix } } },
    }),
    prisma.auctionParticipant.deleteMany({
      where: { auction: { code: { startsWith: codePrefix } } },
    }),
    prisma.auctionCost.deleteMany({
      where: { auction: { code: { startsWith: codePrefix } } },
    }),
    prisma.auctionRelation.deleteMany({
      where: { auction: { code: { startsWith: codePrefix } } },
    }),
    prisma.auction.deleteMany({ where: { code: { startsWith: codePrefix } } }),
  ]);
  await cleanupTestUsers(prisma);
}
