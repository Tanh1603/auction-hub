/**
 * Integration Tests for 2.8.1-2 Create and Get Auction Costs
 * Test Case IDs: TC-2.8.1-01 to TC-2.8.2-04
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

describe('2.8.1-2 Create and Get Auction Costs', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let auctioneer: TestUser;
  let bidder: TestUser;
  let adminToken: string;
  let auctioneerToken: string;
  let bidderToken: string;
  let auction: { id: string };
  const TEST_PREFIX = 'TEST-COST';

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
      email: 'cost_admin@test.com',
      role: UserRole.admin,
    });
    auctioneer = await createTestUser(prisma, {
      email: 'cost_auctioneer@test.com',
      role: UserRole.auctioneer,
    });
    bidder = await createTestUser(prisma, {
      email: 'cost_bidder@test.com',
      role: UserRole.bidder,
    });

    adminToken = createTestJWT(admin, UserRole.admin);
    auctioneerToken = createTestJWT(auctioneer, UserRole.auctioneer);
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    const location = await prisma.location.findFirst();
    auction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Auction Cost Test',
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
  });

  // ============================================
  // 2.8.1 Create Auction Costs
  // ============================================
  describe('2.8.1 Create Auction Costs', () => {
    it('TC-2.8.1-01: Verify create auction costs with all fields', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          advertisingCost: 2000000,
          venueRentalCost: 5000000,
          appraisalCost: 10000000,
          assetViewingCost: 1000000,
        })
        .expect(201);

      const cost = await prisma.auctionCost.findUnique({
        where: { auctionId: auction.id },
      });
      expect(cost).toBeTruthy();
      expect(cost?.advertisingCost?.toString()).toBe('2000000');
    });

    it('TC-2.8.1-02: Verify upsert updates existing', async () => {
      // Pre-seed existing cost record
      await prisma.auctionCost.create({
        data: {
          auctionId: auction.id,
          advertisingCost: new Decimal(1000000),
          totalCosts: new Decimal(1000000),
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ advertisingCost: 3000000 });

      // POST upsert may return 201 (HTTP POST semantics) even when updating
      // Accept both 200 and 201 as valid for upsert behavior
      expect([200, 201]).toContain(response.status);

      const cost = await prisma.auctionCost.findUnique({
        where: { auctionId: auction.id },
      });
      expect(cost?.advertisingCost?.toString()).toBe('3000000');
    });

    it('TC-2.8.1-03: Verify create with otherCosts array', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          advertisingCost: 1000000,
          otherCosts: [{ description: 'Security', amount: 5000000 }],
        })
        .expect(201);

      const cost = await prisma.auctionCost.findUnique({
        where: { auctionId: auction.id },
      });
      expect(cost?.otherCosts).toBeDefined();
    });

    it('TC-2.8.1-04: Verify create with empty optional fields', async () => {
      await request(app.getHttpServer())
        .post(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ advertisingCost: 1000000 })
        .expect(201);
    });

    it('TC-2.8.1-05: Fail create with negative cost', async () => {
      await request(app.getHttpServer())
        .post(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ advertisingCost: -1000000 })
        .expect(400);
    });

    it('TC-2.8.1-06: Fail create for non-existent auction', async () => {
      await request(app.getHttpServer())
        .post('/api/auction-costs/auction/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ advertisingCost: 1000000 })
        .expect(404);
    });

    it('TC-2.8.1-07: Fail create without authentication', async () => {
      await request(app.getHttpServer())
        .post(`/api/auction-costs/auction/${auction.id}`)
        .send({ advertisingCost: 1000000 })
        .expect(401);
    });

    it('TC-2.8.1-08: Fail Bidder creating costs', async () => {
      await request(app.getHttpServer())
        .post(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ advertisingCost: 1000000 })
        .expect(403);
    });
  });

  // ============================================
  // 2.8.2 Get Auction Costs
  // ============================================
  describe('2.8.2 Get Auction Costs', () => {
    beforeEach(async () => {
      await prisma.auctionCost.create({
        data: {
          auctionId: auction.id,
          advertisingCost: new Decimal(2000000),
          venueRentalCost: new Decimal(5000000),
          appraisalCost: new Decimal(10000000),
          assetViewingCost: new Decimal(1000000),
          totalCosts: new Decimal(18000000),
        },
      });
    });

    it('TC-2.8.2-01: Verify get auction costs', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.advertisingCost).toBeDefined();
      expect(response.body.totalCosts).toBeDefined();
    });

    it('TC-2.8.2-02: Verify get includes totalCost calculation', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(parseFloat(response.body.totalCosts)).toBe(18000000);
    });

    it('TC-2.8.2-03: Return 404 for auction without costs', async () => {
      await prisma.auctionCost.delete({ where: { auctionId: auction.id } });

      await request(app.getHttpServer())
        .get(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('TC-2.8.2-04: Fail get for non-existent auction', async () => {
      await request(app.getHttpServer())
        .get('/api/auction-costs/auction/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
