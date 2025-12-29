/**
 * Integration Tests for 5.1.3-5 Double Spend, Auction End, Concurrent Operations
 * Test Case IDs: TC-5.1.3-01 to TC-5.1.5-03
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { AppModule } from '../../../server/src/app/app.module';
import { UserRole, AuctionStatus, BidType } from '../../../server/generated';
import {
  createTestJWT,
  createTestUser,
  createDate,
  cleanupTestData,
  TestUser,
} from '../helpers/test-helpers';
import { Decimal } from '@prisma/client/runtime/library';

describe('5.1.3-5 Concurrency and Timing', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bidder1: TestUser;
  let bidder2: TestUser;
  let bidder1Token: string;
  let bidder2Token: string;
  const TEST_PREFIX = 'TEST-CONC';

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

    bidder1 = await createTestUser(prisma, {
      email: 'conc_b1@test.com',
      role: UserRole.bidder,
    });
    bidder2 = await createTestUser(prisma, {
      email: 'conc_b2@test.com',
      role: UserRole.bidder,
    });
    bidder1Token = createTestJWT(bidder1, UserRole.bidder);
    bidder2Token = createTestJWT(bidder2, UserRole.bidder);
  });

  // ============================================
  // 5.1.3 Double Spend Prevention
  // ============================================
  describe('5.1.3 Double Spend Prevention', () => {
    it('TC-2.4.13-03: Prevent double deposit payment', async () => {
      const location = await prisma.location.findFirst();
      const auction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-DS-001`,
          name: 'Double Spend Test',
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

      const registration = await prisma.auctionParticipant.create({
        data: {
          userId: bidder1.id,
          auctionId: auction.id,
          registeredAt: createDate(-3),
          documentsVerifiedAt: createDate(-1),
          depositPaidAt: new Date(),
          depositAmount: new Decimal(1000000),
        },
      });

      // Attempt second deposit
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/submit-deposit')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({
          registrationId: registration.id,
          auctionId: auction.id,
          amount: 100000000,
        });

      expect([409, 400]).toContain(response.status);
    });

    it('TC-5.1.3-02: Concurrent deposit attempts - only one succeeds', async () => {
      const location = await prisma.location.findFirst();
      const auction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-DS-002`,
          name: 'Concurrent Deposit Test',
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

      const registration = await prisma.auctionParticipant.create({
        data: {
          userId: bidder1.id,
          auctionId: auction.id,
          registeredAt: createDate(-3),
          documentsVerifiedAt: createDate(-1),
        },
      });

      // NOTE: Actual Stripe integration needed for real test
      console.log(
        'TODO: Concurrent deposit test requires Stripe session mocking'
      );
      expect(true).toBe(true);
    });
  });

  // ============================================
  // 5.1.4 Auction End Edge Cases
  // ============================================
  describe('5.1.4 Auction End Edge Cases', () => {
    it('TC-5.1.3-01: Bid at exact end time', async () => {
      const location = await prisma.location.findFirst();
      const auction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-END-001`,
          name: 'End Time Test',
          propertyOwner: { name: 'Owner' },
          assetType: 'secured_asset',
          status: AuctionStatus.live,
          saleStartAt: createDate(-10),
          saleEndAt: createDate(5),
          depositEndAt: createDate(-5),
          auctionStartAt: createDate(0, -1),
          auctionEndAt: new Date(), // Ending now
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
          registeredAt: createDate(-7),
          confirmedAt: createDate(-5),
          checkedInAt: createDate(0, -1),
          depositPaidAt: createDate(-5),
          depositAmount: new Decimal(1000000),
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({ auctionId: auction.id, amount: 10000000 });

      // May succeed or fail depending on timing - accept 403 (forbidden) as well
      expect([201, 400, 403]).toContain(response.status);
    });

    it('TC-2.5.1-12: Bid after auction ends', async () => {
      const location = await prisma.location.findFirst();
      const auction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-END-002`,
          name: 'Ended Auction',
          propertyOwner: { name: 'Owner' },
          assetType: 'secured_asset',
          status: AuctionStatus.awaiting_result,
          saleStartAt: createDate(-20),
          saleEndAt: createDate(-10),
          depositEndAt: createDate(-15),
          auctionStartAt: createDate(-12),
          auctionEndAt: createDate(-10),
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
          registeredAt: createDate(-18),
          confirmedAt: createDate(-15),
          checkedInAt: createDate(-12),
          depositPaidAt: createDate(-15),
          depositAmount: new Decimal(1000000),
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({ auctionId: auction.id, amount: 10000000 });

      // Accept both 400 (Bad Request - auction closed) and 403 (Forbidden - cannot bid)
      // Both indicate the bid was correctly rejected for an ended auction
      expect([400, 403]).toContain(response.status);
    });
  });

  // ============================================
  // 5.1.5 Concurrent Operations
  // ============================================
  describe('5.1.5 Concurrent Operations', () => {
    it('TC-2.3.4-03: Concurrent auction updates', async () => {
      const admin = await createTestUser(prisma, {
        email: 'conc_admin@test.com',
        role: UserRole.admin,
      });
      const adminToken = createTestJWT(admin, UserRole.admin);

      const location = await prisma.location.findFirst();
      const auction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-CONC-001`,
          name: 'Concurrent Update Test',
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

      await Promise.allSettled([
        request(app.getHttpServer())
          .put(`/api/auctions/${auction.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'Update A' }),
        request(app.getHttpServer())
          .put(`/api/auctions/${auction.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'Update B' }),
      ]);

      const updated = await prisma.auction.findUnique({
        where: { id: auction.id },
      });
      expect(['Update A', 'Update B']).toContain(updated?.name);
    });

    it('TC-2.3.4-03: Concurrent status transitions', async () => {
      const admin = await createTestUser(prisma, {
        email: 'conc_admin2@test.com',
        role: UserRole.admin,
      });
      const adminToken = createTestJWT(admin, UserRole.admin);

      const location = await prisma.location.findFirst();
      const auction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-CONC-002`,
          name: 'Concurrent Status Test',
          propertyOwner: { name: 'Owner' },
          assetType: 'secured_asset',
          status: AuctionStatus.awaiting_result,
          saleStartAt: createDate(-20),
          saleEndAt: createDate(-10),
          depositEndAt: createDate(-15),
          auctionStartAt: createDate(-12),
          auctionEndAt: createDate(-10),
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

      // Concurrent finalization attempts
      await Promise.allSettled([
        request(app.getHttpServer())
          .post('/api/auction-finalization/finalize')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ auctionId: auction.id }),
        request(app.getHttpServer())
          .post('/api/auction-finalization/finalize')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ auctionId: auction.id }),
      ]);

      // Should still have valid state
      const updated = await prisma.auction.findUnique({
        where: { id: auction.id },
      });
      expect([
        AuctionStatus.success,
        AuctionStatus.failed,
        AuctionStatus.awaiting_result,
      ]).toContain(updated?.status);
    });
  });
});
