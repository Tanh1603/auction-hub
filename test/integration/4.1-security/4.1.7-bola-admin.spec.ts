/**
 * Integration Tests for 4.1.7 BOLA - Admin Endpoints Authorization
 * Test Case IDs: TC-4.1.3-01 to TC-4.1.3-05
 *
 * These tests verify Broken Object Level Authorization (BOLA) protection
 * on admin-only endpoints, ensuring non-admin roles cannot access them.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { AppModule } from '../../../server/src/app/app.module';
import { UserRole, AuctionStatus } from '../../../server/generated';
import {
  createTestJWT,
  createTestUser,
  createDate,
  cleanupTestData,
  TestUser,
} from '../helpers/test-helpers';
import { Decimal } from '@prisma/client/runtime/library';

describe('4.1.7 BOLA - Admin Endpoint Authorization', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let auctioneer: TestUser;
  let bidder: TestUser;
  let adminToken: string;
  let auctioneerToken: string;
  let bidderToken: string;
  let endedAuction: { id: string };
  const TEST_PREFIX = 'TEST-BOLA-ADMIN';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestData(prisma, TEST_PREFIX);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupTestData(prisma, TEST_PREFIX);

    admin = await createTestUser(prisma, {
      email: 'bola_admin@test.com',
      role: UserRole.admin,
    });
    auctioneer = await createTestUser(prisma, {
      email: 'bola_auctioneer@test.com',
      role: UserRole.auctioneer,
    });
    bidder = await createTestUser(prisma, {
      email: 'bola_bidder@test.com',
      role: UserRole.bidder,
    });

    adminToken = createTestJWT(admin, UserRole.admin);
    auctioneerToken = createTestJWT(auctioneer, UserRole.auctioneer);
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    const location = await prisma.location.findFirst();
    endedAuction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'BOLA Test Auction',
        propertyOwner: { name: 'Owner' },
        assetType: 'secured_asset',
        status: AuctionStatus.awaiting_result,
        saleStartAt: createDate(-20),
        saleEndAt: createDate(-5),
        depositEndAt: createDate(-15),
        auctionStartAt: createDate(-10),
        auctionEndAt: createDate(-5),
        viewTime: '9:00-17:00',
        saleFee: new Decimal(500000),
        depositAmountRequired: new Decimal(1000000),
        startingPrice: new Decimal(10000000),
        bidIncrement: new Decimal(500000),
        assetDescription: 'Test',
        assetAddress: 'Test',
        validCheckInBeforeStartMinutes: 30,
        validCheckInAfterStartMinutes: 15,
        assetWardId: location?.id || 1,
        assetProvinceId: location?.id || 1,
      },
    });
  });

  // ============================================
  // Admin Registration Endpoints
  // ============================================
  describe('Admin Registration Endpoints', () => {
    it('TC-4.1.3-01: BOLA - Bidder cannot access admin registrations', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/register-to-bid/admin/registrations')
        .set('Authorization', `Bearer ${bidderToken}`);

      expect(response.status).toBe(403);
    });

    it('TC-4.1.3-01b: Admin CAN access admin registrations', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/register-to-bid/admin/registrations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });

  // ============================================
  // Auction Finalization Endpoints
  // ============================================
  describe('Auction Finalization Endpoints', () => {
    it('TC-4.1.3-02: BOLA - Bidder cannot evaluate auction', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auction-finalization/evaluate/${endedAuction.id}`)
        .set('Authorization', `Bearer ${bidderToken}`);

      expect(response.status).toBe(403);
    });

    it('TC-4.1.3-03: BOLA - Auctioneer cannot override auction', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auction-finalization/override')
        .set('Authorization', `Bearer ${auctioneerToken}`)
        .send({
          auctionId: endedAuction.id,
          status: 'cancelled',
          reason: 'Attempted unauthorized override',
        });

      expect(response.status).toBe(403);
    });

    it('TC-4.1.3-03b: Admin CAN override auction', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auction-finalization/override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          auctionId: endedAuction.id,
          status: 'cancelled',
          reason: 'Authorized override by admin',
        });

      // Should succeed or return 200/400 (if status transition not allowed)
      expect([200, 400]).toContain(response.status);
    });
  });

  // ============================================
  // System Variables Endpoints
  // ============================================
  describe('System Variables Endpoints', () => {
    it('TC-4.1.3-05: BOLA - Auctioneer cannot view system variables', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/system-variables')
        .set('Authorization', `Bearer ${auctioneerToken}`);

      expect(response.status).toBe(403);
    });

    it('TC-4.1.3-05b: BOLA - Bidder cannot view system variables', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/system-variables')
        .set('Authorization', `Bearer ${bidderToken}`);

      expect(response.status).toBe(403);
    });

    it('TC-4.1.3-05c: Admin CAN view system variables', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/system-variables')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });

  // ============================================
  // Auction Costs Delete Endpoint
  // ============================================
  describe('Auction Costs Endpoints', () => {
    it('TC-4.1.3-04: BOLA - Auctioneer cannot delete auction costs', async () => {
      // Create auction costs first
      await prisma.auctionCost.create({
        data: {
          auctionId: endedAuction.id,
          advertisingCost: new Decimal(100000),
        },
      });

      const response = await request(app.getHttpServer())
        .delete(`/api/auction-costs/auction/${endedAuction.id}`)
        .set('Authorization', `Bearer ${auctioneerToken}`);

      expect(response.status).toBe(403);
    });

    it('TC-4.1.3-04b: Admin CAN delete auction costs', async () => {
      await prisma.auctionCost.create({
        data: {
          auctionId: endedAuction.id,
          advertisingCost: new Decimal(100000),
        },
      });

      const response = await request(app.getHttpServer())
        .delete(`/api/auction-costs/auction/${endedAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 204]).toContain(response.status);
    });
  });

  // ============================================
  // User Promotion Endpoints
  // ============================================
  describe('User Promotion Endpoints', () => {
    it('TC-4.1.3-06: BOLA - Bidder cannot promote users', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/auth/admin/users/${auctioneer.id}/promote`)
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ role: 'auctioneer' });

      expect(response.status).toBe(403);
    });

    it('TC-4.1.3-06b: BOLA - Auctioneer cannot promote users', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/auth/admin/users/${bidder.id}/promote`)
        .set('Authorization', `Bearer ${auctioneerToken}`)
        .send({ role: 'auctioneer' });

      expect(response.status).toBe(403);
    });
  });
});
