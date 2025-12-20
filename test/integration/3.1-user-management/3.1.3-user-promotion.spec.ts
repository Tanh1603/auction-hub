/**
 * Integration Tests for 3.1.3 User Promotion
 * Test Case IDs: TC-3.1.3-01 to TC-3.1.3-12
 *
 * Tests user role promotion/demotion including:
 * - Admin promoting users
 * - Super Admin privileges
 * - Role-based access control
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { AppModule } from '../../../server/src/app/app.module';
import { UserRole } from '../../../server/generated';
import {
  createTestJWT,
  createTestUser,
  cleanupTestUsers,
  TestUser,
} from '../helpers/test-helpers';

describe('3.1.3 User Promotion', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let superAdmin: TestUser;
  let admin: TestUser;
  let auctioneer: TestUser;
  let bidder: TestUser;

  let superAdminToken: string;
  let adminToken: string;
  let auctioneerToken: string;
  let bidderToken: string;

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

    superAdmin = await createTestUser(prisma, {
      email: 'promo_super@test.com',
      role: UserRole.super_admin,
    });
    admin = await createTestUser(prisma, {
      email: 'promo_admin@test.com',
      role: UserRole.admin,
    });
    auctioneer = await createTestUser(prisma, {
      email: 'promo_auctioneer@test.com',
      role: UserRole.auctioneer,
    });
    bidder = await createTestUser(prisma, {
      email: 'promo_bidder@test.com',
      role: UserRole.bidder,
    });

    superAdminToken = createTestJWT(superAdmin, UserRole.super_admin);
    adminToken = createTestJWT(admin, UserRole.admin);
    auctioneerToken = createTestJWT(auctioneer, UserRole.auctioneer);
    bidderToken = createTestJWT(bidder, UserRole.bidder);
  });

  // ============================================
  // Admin Promotion
  // ============================================
  describe('Admin Promotion', () => {
    it('TC-3.1.3-01: Verify Admin promotes Bidder to Auctioneer', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${bidder.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'auctioneer' })
        .expect(200);

      expect(response.body.role).toBe('auctioneer');

      const updated = await prisma.user.findUnique({
        where: { id: bidder.id },
      });
      expect(updated!.role).toBe(UserRole.auctioneer);
    });

    it('TC-3.1.3-02: Fail Admin promotes to Admin', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${bidder.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(403);
    });

    it('TC-3.1.3-03: Fail Admin promotes to Super Admin', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${bidder.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'super_admin' })
        .expect(403);
    });
  });

  // ============================================
  // Super Admin Promotion
  // ============================================
  describe('Super Admin Promotion', () => {
    it('TC-3.1.3-04: Verify Super Admin promotes to Admin', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${bidder.id}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: 'admin' })
        .expect(200);

      expect(response.body.role).toBe('admin');
    });

    it('TC-3.1.3-05: Verify Super Admin demotes Admin to Bidder', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${admin.id}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: 'bidder' })
        .expect(200);

      expect(response.body.role).toBe('bidder');
    });
  });

  // ============================================
  // Role-Based Access Control
  // ============================================
  describe('Role-Based Access Control', () => {
    it('TC-3.1.3-06: Fail Auctioneer promotes users', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${bidder.id}/role`)
        .set('Authorization', `Bearer ${auctioneerToken}`)
        .send({ role: 'auctioneer' })
        .expect(403);
    });

    it('TC-3.1.3-07: Fail Bidder promotes users', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${auctioneer.id}/role`)
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ role: 'admin' })
        .expect(403);
    });

    it('TC-3.1.3-08: Fail promotion without authentication', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${bidder.id}/role`)
        .send({ role: 'auctioneer' })
        .expect(401);
    });
  });

  // ============================================
  // Validation
  // ============================================
  describe('Validation', () => {
    it('TC-3.1.3-09: Fail with invalid role enum', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${bidder.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'invalid_role' })
        .expect(400);
    });

    it('TC-3.1.3-10: Fail promote non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/users/550e8400-e29b-41d4-a716-446655440000/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'auctioneer' })
        .expect(404);
    });

    it('TC-3.1.3-11: Fail promote self', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${admin.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'super_admin' });

      // Should fail - cannot promote self
      expect([400, 403]).toContain(response.status);
    });

    it('TC-3.1.3-12: Fail with missing role field', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${bidder.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });
  });
});
