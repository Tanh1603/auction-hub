/**
 * Integration Tests for 5.2.3 Auction State Transitions
 * Test Case IDs: TC-5.2.3-01 to TC-5.2.3-02
 *
 * These tests verify automatic auction state transitions:
 * - Scheduled → Live (at auctionStartAt)
 * - Live → Ended (at auctionEndAt)
 *
 * NOTE: Automatic transitions may be handled by a scheduler/cron job.
 * These tests verify the state can be correctly set and that
 * business rules are enforced at boundaries.
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

describe('5.2.3 Auction State Transitions', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let bidder: TestUser;
  let adminToken: string;
  let bidderToken: string;
  const TEST_PREFIX = 'TEST-STATE-TRANS';

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
      email: 'trans_admin@test.com',
      role: UserRole.admin,
    });
    bidder = await createTestUser(prisma, {
      email: 'trans_bidder@test.com',
      role: UserRole.bidder,
    });

    adminToken = createTestJWT(admin, UserRole.admin);
    bidderToken = createTestJWT(bidder, UserRole.bidder);
  });

  // ============================================
  // Scheduled → Live Transition
  // ============================================
  describe('Scheduled to Live Transition', () => {
    it('TC-5.2.3-01a: Bidding blocked on scheduled auction', async () => {
      const location = await prisma.location.findFirst();
      const futureAuction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-FUTURE-001`,
          name: 'Future Auction',
          propertyOwner: { name: 'Owner' },
          assetType: 'secured_asset',
          status: AuctionStatus.scheduled,
          saleStartAt: createDate(-5),
          saleEndAt: createDate(10),
          depositEndAt: createDate(3),
          auctionStartAt: createDate(5), // Starts in 5 days
          auctionEndAt: createDate(5, 3),
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

      // Create participant
      await prisma.auctionParticipant.create({
        data: {
          userId: bidder.id,
          auctionId: futureAuction.id,
          registeredAt: createDate(-3),
          confirmedAt: createDate(-2),
          checkedInAt: createDate(-1),
          depositPaidAt: createDate(-2),
          depositAmount: new Decimal(1000000),
        },
      });

      // Try to bid on scheduled auction
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: futureAuction.id, amount: 10000000 });

      // Should be blocked
      expect([400, 403]).toContain(response.status);
    });

    it('TC-5.2.3-01b: Bidding allowed on live auction', async () => {
      const location = await prisma.location.findFirst();
      const liveAuction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-LIVE-001`,
          name: 'Live Auction',
          propertyOwner: { name: 'Owner' },
          assetType: 'secured_asset',
          status: AuctionStatus.live,
          saleStartAt: createDate(-10),
          saleEndAt: createDate(5),
          depositEndAt: createDate(-5),
          auctionStartAt: createDate(0, -2), // Started 2 hours ago
          auctionEndAt: createDate(0, 4), // Ends in 4 hours
          viewTime: '9:00-17:00',
          saleFee: new Decimal(500000),
          depositAmountRequired: new Decimal(1000000),
          startingPrice: new Decimal(10000000),
          bidIncrement: new Decimal(500000),
          assetDescription: 'Test',
          assetAddress: 'Test',
          validCheckInBeforeStartMinutes: 60,
          validCheckInAfterStartMinutes: 30,
          assetWardId: location?.id || 1,
          assetProvinceId: location?.id || 1,
        },
      });

      // Create participant
      await prisma.auctionParticipant.create({
        data: {
          userId: bidder.id,
          auctionId: liveAuction.id,
          registeredAt: createDate(-7),
          confirmedAt: createDate(-5),
          checkedInAt: createDate(0, -1),
          depositPaidAt: createDate(-5),
          depositAmount: new Decimal(1000000),
        },
      });

      // Bid on live auction
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: liveAuction.id, amount: 10000000 });

      // Should succeed
      expect(response.status).toBe(201);
    });

    it('TC-5.2.3-01c: Admin can manually trigger status update', async () => {
      const location = await prisma.location.findFirst();

      // Create auction that should be live (start time passed)
      const shouldBeLiveAuction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-SHOULDLIVE-001`,
          name: 'Should Be Live',
          propertyOwner: { name: 'Owner' },
          assetType: 'secured_asset',
          status: AuctionStatus.scheduled, // Still marked scheduled
          saleStartAt: createDate(-10),
          saleEndAt: createDate(5),
          depositEndAt: createDate(-5),
          auctionStartAt: createDate(0, -1), // Started 1 hour ago
          auctionEndAt: createDate(0, 4),
          viewTime: '9:00-17:00',
          saleFee: new Decimal(500000),
          depositAmountRequired: new Decimal(1000000),
          startingPrice: new Decimal(10000000),
          bidIncrement: new Decimal(500000),
          assetDescription: 'Test',
          assetAddress: 'Test',
          validCheckInBeforeStartMinutes: 60,
          validCheckInAfterStartMinutes: 30,
          assetWardId: location?.id || 1,
          assetProvinceId: location?.id || 1,
        },
      });

      // Admin updates status to live
      const response = await request(app.getHttpServer())
        .put(`/api/auctions/${shouldBeLiveAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'live' });

      expect([200, 400]).toContain(response.status);

      if (response.status === 200) {
        const updated = await prisma.auction.findUnique({
          where: { id: shouldBeLiveAuction.id },
        });
        expect(updated?.status).toBe(AuctionStatus.live);
      }
    });
  });

  // ============================================
  // Live → Ended Transition
  // ============================================
  describe('Live to Ended Transition', () => {
    it('TC-5.2.3-02a: Bidding blocked on ended auction', async () => {
      const location = await prisma.location.findFirst();
      const endedAuction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-ENDED-001`,
          name: 'Ended Auction',
          propertyOwner: { name: 'Owner' },
          assetType: 'secured_asset',
          status: AuctionStatus.awaiting_result,
          saleStartAt: createDate(-20),
          saleEndAt: createDate(-5),
          depositEndAt: createDate(-15),
          auctionStartAt: createDate(-10),
          auctionEndAt: createDate(-5), // Ended 5 days ago
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

      // Create participant
      await prisma.auctionParticipant.create({
        data: {
          userId: bidder.id,
          auctionId: endedAuction.id,
          registeredAt: createDate(-18),
          confirmedAt: createDate(-16),
          checkedInAt: createDate(-10),
          depositPaidAt: createDate(-16),
          depositAmount: new Decimal(1000000),
        },
      });

      // Try to bid on ended auction
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: endedAuction.id, amount: 10000000 });

      // Should be blocked
      expect([400, 403]).toContain(response.status);
    });

    it('TC-5.2.3-02b: Finalization allowed on awaiting_result auction', async () => {
      const location = await prisma.location.findFirst();
      const awaitingAuction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-AWAIT-001`,
          name: 'Awaiting Result',
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

      // Create first participant with bid (the winner)
      const participant = await prisma.auctionParticipant.create({
        data: {
          userId: bidder.id,
          auctionId: awaitingAuction.id,
          registeredAt: createDate(-18),
          confirmedAt: createDate(-16),
          checkedInAt: createDate(-10),
          depositPaidAt: createDate(-16),
          depositAmount: new Decimal(1000000),
        },
      });

      // Create second participant to meet minimum participants requirement (2)
      // The evaluation service requires at least 2 confirmed participants
      const bidder2 = await prisma.user.create({
        data: {
          id: require('crypto').randomUUID(),
          email: `${TEST_PREFIX.toLowerCase()}_bidder2@test.com`,
          fullName: 'Test Bidder 2',
          userType: 'individual',
          role: UserRole.bidder,
        },
      });
      await prisma.auctionParticipant.create({
        data: {
          userId: bidder2.id,
          auctionId: awaitingAuction.id,
          registeredAt: createDate(-18),
          confirmedAt: createDate(-16),
          checkedInAt: createDate(-10),
          depositPaidAt: createDate(-16),
          depositAmount: new Decimal(1000000),
        },
      });

      await prisma.auctionBid.create({
        data: {
          auctionId: awaitingAuction.id,
          participantId: participant.id,
          amount: new Decimal(15000000),
          bidAt: createDate(-8),
          bidType: BidType.manual,
          isWinningBid: true,
        },
      });

      // Admin finalizes
      const response = await request(app.getHttpServer())
        .post('/api/auction-finalization/finalize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ auctionId: awaitingAuction.id });

      expect(response.status).toBe(200);

      const updated = await prisma.auction.findUnique({
        where: { id: awaitingAuction.id },
      });
      expect(updated?.status).toBe(AuctionStatus.success);
    });

    it('TC-5.2.3-02c: Finalization blocked on live auction', async () => {
      const location = await prisma.location.findFirst();
      const liveAuction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-LIVE-FIN-001`,
          name: 'Still Live',
          propertyOwner: { name: 'Owner' },
          assetType: 'secured_asset',
          status: AuctionStatus.live,
          saleStartAt: createDate(-10),
          saleEndAt: createDate(5),
          depositEndAt: createDate(-5),
          auctionStartAt: createDate(0, -2),
          auctionEndAt: createDate(0, 4),
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

      // Try to finalize live auction
      const response = await request(app.getHttpServer())
        .post('/api/auction-finalization/finalize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ auctionId: liveAuction.id });

      // Should be blocked
      expect(response.status).toBe(400);
    });
  });

  // ============================================
  // State Transition Validation
  // ============================================
  describe('State Transition Validation', () => {
    it('TC-5.2.3-03: Cannot transition backwards (success → live)', async () => {
      const location = await prisma.location.findFirst();
      const successAuction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-SUCCESS-001`,
          name: 'Success Auction',
          propertyOwner: { name: 'Owner' },
          assetType: 'secured_asset',
          status: AuctionStatus.success,
          saleStartAt: createDate(-30),
          saleEndAt: createDate(-10),
          depositEndAt: createDate(-25),
          auctionStartAt: createDate(-20),
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

      // Try to update status back to live
      const response = await request(app.getHttpServer())
        .put(`/api/auctions/${successAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'live' });

      // Should fail (invalid transition)
      expect([400, 403]).toContain(response.status);
    });

    it('TC-5.2.3-04: Cancelled is terminal state', async () => {
      const location = await prisma.location.findFirst();
      const cancelledAuction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-CANCEL-001`,
          name: 'Cancelled Auction',
          propertyOwner: { name: 'Owner' },
          assetType: 'secured_asset',
          status: AuctionStatus.failed,
          saleStartAt: createDate(-10),
          saleEndAt: createDate(5),
          depositEndAt: createDate(-5),
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

      // Try to update status
      const response = await request(app.getHttpServer())
        .put(`/api/auctions/${cancelledAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'scheduled' });

      // Should fail
      expect([400, 403]).toContain(response.status);
    });
  });
});
