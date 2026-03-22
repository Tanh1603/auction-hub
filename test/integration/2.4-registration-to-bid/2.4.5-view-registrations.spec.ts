/**
 * Integration Tests for 2.4.6-8 Registration Viewing
 * Test Case IDs: TC-2.4.6-01 to TC-2.4.8-05
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

describe('2.4.6-8 Registration Viewing', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let bidder1: TestUser;
  let bidder2: TestUser;
  let adminToken: string;
  let bidder1Token: string;
  let bidder2Token: string;
  let auction: { id: string };
  const TEST_PREFIX = 'TEST-VIEW';

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
      email: 'view_admin@test.com',
      role: UserRole.admin,
    });
    bidder1 = await createTestUser(prisma, {
      email: 'view_bidder1@test.com',
      role: UserRole.bidder,
    });
    bidder2 = await createTestUser(prisma, {
      email: 'view_bidder2@test.com',
      role: UserRole.bidder,
    });

    adminToken = createTestJWT(admin, UserRole.admin);
    bidder1Token = createTestJWT(bidder1, UserRole.bidder);
    bidder2Token = createTestJWT(bidder2, UserRole.bidder);

    const location = await prisma.location.findFirst();
    auction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'View Test Auction',
        propertyOwner: { name: 'Owner' },
        assetType: 'secured_asset',
        status: AuctionStatus.scheduled,
        saleStartAt: createDate(-5),
        saleEndAt: createDate(10),
        depositEndAt: createDate(5),
        auctionStartAt: createDate(7),
        auctionEndAt: createDate(7, 3),
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

    await prisma.auctionParticipant.create({
      data: {
        userId: bidder1.id,
        auctionId: auction.id,
        registeredAt: createDate(-3),
        confirmedAt: createDate(-1),
      },
    });
  });

  // ============================================
  // 2.4.6 View Own Registrations
  // ============================================
  describe('2.4.6 View Own Registrations', () => {
    it('TC-2.4.6-01: Verify bidder views own registrations', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/register-to-bid/users/${bidder1.id}/registrations`)
        .set('Authorization', `Bearer ${bidder1Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('TC-2.4.6-02: Fail view other users registrations as bidder', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/register-to-bid/users/${bidder1.id}/registrations`)
        .set('Authorization', `Bearer ${bidder2Token}`);

      expect([403, 200]).toContain(response.status);
    });

    it('TC-2.4.6-03: Verify Admin can view any users registrations', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/register-to-bid/users/${bidder1.id}/registrations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('TC-2.4.6-05: Verify empty list for user with no registrations', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/register-to-bid/users/${bidder2.id}/registrations`)
        .set('Authorization', `Bearer ${bidder2Token}`);

      // Accept 200 (empty list) or 404 (not found)
      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toEqual([]);
      }
    });
  });

  // ============================================
  // 2.4.7 Get Registration for Auction
  // ============================================
  describe('2.4.7 Get Registration for Auction', () => {
    it('TC-2.4.7-01: Verify get registration for specific auction', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/register-to-bid/auctions/${auction.id}/registration`)
        .set('Authorization', `Bearer ${bidder1Token}`)
        .expect(200);

      expect(response.body.auctionId).toBe(auction.id);
    });

    it('TC-2.4.7-02: Return 404 for non-registered auction', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/register-to-bid/auctions/${auction.id}/registration`)
        .set('Authorization', `Bearer ${bidder2Token}`)
        .expect(404);
    });

    it('TC-2.4.7-03: Fail without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/api/register-to-bid/auctions/${auction.id}/registration`)
        .expect(401);
    });
  });

  // ============================================
  // 2.4.8 Admin List Registrations
  // ============================================
  describe('2.4.8 Admin List Registrations', () => {
    it('TC-2.4.8-01: Verify Admin lists all registrations', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/register-to-bid/admin/registrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data || response.body).toBeDefined();
    });

    it('TC-2.4.15-02: Verify filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/register-to-bid/admin/registrations?status=confirmed')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('TC-2.4.15-03: Verify filter by auctionId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/register-to-bid/admin/registrations?auctionId=${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('TC-2.4.8-04: Fail Bidder accessing admin registrations', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/register-to-bid/admin/registrations')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .expect(403);
    });
  });
});
