/**
 * Integration Tests for 3.1.2 Get Current User Info
 * Test Case IDs: TC-3.1.2-01 to TC-3.1.2-08
 *
 * Tests /api/auth/me endpoint functionality including:
 * - Authenticated access
 * - Response structure
 * - Error handling for unauthorized
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { AppModule } from '../../../server/src/app/app.module';
import { UserRole } from '../../../server/generated';
import {
  createTestJWT,
  createExpiredJWT,
  createTestUser,
  cleanupTestUsers,
  TestUser,
} from '../helpers/test-helpers';

describe('3.1.2 Get Current User Info', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testUser: TestUser;
  let testToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestUsers(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupTestUsers(prisma);
    testUser = await createTestUser(prisma, {
      email: 'me_test@test.com',
      role: UserRole.bidder,
    });
    testToken = createTestJWT(testUser, UserRole.bidder);
  });

  // ============================================
  // Successful Retrieval
  // ============================================
  describe('Successful Retrieval', () => {
    it('TC-3.1.2-01: Verify authenticated user gets own info', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.id).toBe(testUser.id);
      expect(response.body.email).toBe(testUser.email);
    });

    it('TC-3.1.2-02: Verify response includes required fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('role');
    });

    it('TC-3.1.2-03: Verify password NOT included in response', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('TC-3.1.2-04: Verify Admin user gets admin role in response', async () => {
      const adminUser = await createTestUser(prisma, {
        email: 'admin_me@test.com',
        role: UserRole.admin,
      });
      const adminToken = createTestJWT(adminUser, UserRole.admin);

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.role).toBe('admin');
    });
  });

  // ============================================
  // Authentication Failures
  // ============================================
  describe('Authentication Failures', () => {
    it('TC-3.1.2-05: Fail without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.message).toMatch(/unauthorized|missing|token/i);
    });

    it('TC-3.1.2-06: Fail with expired token', async () => {
      const expiredToken = createExpiredJWT(testUser);

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.message).toMatch(/expired/i);
    });

    it('TC-3.1.2-07: Fail with invalid token format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-format')
        .expect(401);
    });

    it('TC-3.1.2-08: Fail with malformed Authorization header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', testToken) // Missing "Bearer " prefix
        .expect(401);
    });
  });
});
