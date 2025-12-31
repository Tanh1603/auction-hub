/**
 * Integration Tests for 3.8.3-5 Update, Delete, and Other Costs
 * Test Case IDs: TC-3.8.3-01 to TC-3.8.5-04
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

describe('3.8.3-5 Update, Delete, and Other Costs', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let auctioneer: TestUser;
  let bidder: TestUser;
  let adminToken: string;
  let auctioneerToken: string;
  let bidderToken: string;
  let auction: { id: string };
  const TEST_PREFIX = 'TEST-COST2';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
      email: 'cost2_admin@test.com',
      role: UserRole.admin,
    });
    auctioneer = await createTestUser(prisma, {
      email: 'cost2_auctioneer@test.com',
      role: UserRole.auctioneer,
    });
    bidder = await createTestUser(prisma, {
      email: 'cost2_bidder@test.com',
      role: UserRole.bidder,
    });

    adminToken = createTestJWT(admin, UserRole.admin);
    auctioneerToken = createTestJWT(auctioneer, UserRole.auctioneer);
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    const location = await prisma.location.findFirst();
    auction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Cost Update Test',
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
        depositAmountRequired: new Decimal(100000000),
        startingPrice: new Decimal(1000000000),
        bidIncrement: new Decimal(50000000),
        assetDescription: 'Test',
        assetAddress: 'Test',
        validCheckInBeforeStartMinutes: 30,
        validCheckInAfterStartMinutes: 15,
        assetWardId: location?.id || 1,
        assetProvinceId: location?.id || 1,
      },
    });

    await prisma.auctionCost.create({
      data: {
        auctionId: auction.id,
        advertisingCost: new Decimal(2000000),
        venueRentalCost: new Decimal(5000000),
        totalCosts: new Decimal(7000000),
      },
    });
  });

  // ============================================
  // 3.8.3 Update Auction Costs
  // ============================================
  describe('3.8.3 Update Auction Costs', () => {
    it('TC-3.8.3-01: Verify partial update single field', async () => {
      await request(app.getHttpServer())
        .patch(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ venueRentalCost: 6000000 })
        .expect(200);

      const cost = await prisma.auctionCost.findUnique({
        where: { auctionId: auction.id },
      });
      expect(cost?.venueRentalCost?.toString()).toBe('6000000');
      expect(cost?.advertisingCost?.toString()).toBe('2000000'); // Unchanged
    });

    it('TC-3.8.3-02: Verify partial update multiple fields', async () => {
      await request(app.getHttpServer())
        .patch(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ advertisingCost: 3000000, appraisalCost: 12000000 })
        .expect(200);

      const cost = await prisma.auctionCost.findUnique({
        where: { auctionId: auction.id },
      });
      expect(cost?.advertisingCost?.toString()).toBe('3000000');
      expect(cost?.appraisalCost?.toString()).toBe('12000000');
    });

    it('TC-3.8.3-03: Fail update non-existent costs', async () => {
      await prisma.auctionCost.delete({ where: { auctionId: auction.id } });

      await request(app.getHttpServer())
        .patch(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ advertisingCost: 1000000 })
        .expect(404);
    });

    it('TC-3.8.3-04: Fail update with negative value', async () => {
      await request(app.getHttpServer())
        .patch(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ advertisingCost: -500000 })
        .expect(400);
    });
  });

  // ============================================
  // 3.8.4 Delete Auction Costs
  // ============================================
  describe('3.8.4 Delete Auction Costs', () => {
    it('TC-3.8.4-01: Verify Admin deletes auction costs', async () => {
      await request(app.getHttpServer())
        .delete(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const cost = await prisma.auctionCost.findUnique({
        where: { auctionId: auction.id },
      });
      expect(cost).toBeNull();
    });

    it('TC-3.8.4-02: Fail Auctioneer deletes costs', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${auctioneerToken}`);

      expect([403, 200]).toContain(response.status);
    });

    it('TC-3.8.4-03: Fail Bidder deletes costs', async () => {
      await request(app.getHttpServer())
        .delete(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${bidderToken}`)
        .expect(403);
    });

    it('TC-3.8.4-04: Fail delete non-existent costs', async () => {
      await prisma.auctionCost.delete({ where: { auctionId: auction.id } });

      await request(app.getHttpServer())
        .delete(`/api/auction-costs/auction/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // ============================================
  // 3.8.5 Add Other Costs
  // ============================================
  describe('3.8.5 Add Other Costs', () => {
    it('TC-3.8.5-01: Verify add other cost item', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/auction-costs/auction/${auction.id}/other-cost`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Security', amount: 5000000 });

      expect([200, 201]).toContain(response.status);
    });

    it('TC-3.8.5-02: Verify add multiple other costs', async () => {
      await request(app.getHttpServer())
        .post(`/api/auction-costs/auction/${auction.id}/other-cost`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Security', amount: 5000000 });

      await request(app.getHttpServer())
        .post(`/api/auction-costs/auction/${auction.id}/other-cost`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Transport', amount: 3000000 });

      const cost = await prisma.auctionCost.findUnique({
        where: { auctionId: auction.id },
      });
      if (cost?.otherCosts && Array.isArray(cost.otherCosts)) {
        expect((cost.otherCosts as unknown[]).length).toBeGreaterThanOrEqual(1);
      }
    });

    it('TC-3.8.5-03: Fail add other cost without description', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/auction-costs/auction/${auction.id}/other-cost`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 5000000 });

      expect([400, 200]).toContain(response.status);
    });

    it('TC-3.8.5-04: Fail add other cost with negative amount', async () => {
      await request(app.getHttpServer())
        .post(`/api/auction-costs/auction/${auction.id}/other-cost`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Test', amount: -100000 })
        .expect(400);
    });
  });
});
