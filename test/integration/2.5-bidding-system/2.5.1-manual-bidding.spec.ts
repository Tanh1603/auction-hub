/**
 * Integration Tests for 2.5.1 Manual Bidding
 * Test Case IDs: TC-2.5.1-01 to TC-2.5.1-30
 *
 * Tests manual bid placement including:
 * - Successful bids
 * - Bid validation
 * - Participant checks
 * - Auction status checks
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
  cleanupTestUsers,
  TestUser,
} from '../helpers/test-helpers';
import { Decimal } from '@prisma/client/runtime/library';

describe('2.5.1 Manual Bidding', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let bidder1: TestUser;
  let bidder2: TestUser;
  let bidder1Token: string;
  let bidder2Token: string;

  let liveAuction: { id: string };
  let participant1: { id: string };
  let participant2: { id: string };

  const TEST_PREFIX = 'TEST-BID';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
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
    await cleanupTestData(prisma, TEST_PREFIX);
    await app.close();
  });

  async function setupTestData() {
    await cleanupTestData(prisma, TEST_PREFIX);

    bidder1 = await createTestUser(prisma, {
      email: 'bid_bidder1@test.com',
      role: UserRole.bidder,
    });
    bidder2 = await createTestUser(prisma, {
      email: 'bid_bidder2@test.com',
      role: UserRole.bidder,
    });

    bidder1Token = createTestJWT(bidder1, UserRole.bidder);
    bidder2Token = createTestJWT(bidder2, UserRole.bidder);

    const location = await prisma.location.findFirst();

    liveAuction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-LIVE-001`,
        name: 'Live Bidding Auction',
        propertyOwner: { name: 'Owner' },
        assetType: 'secured_asset',
        status: AuctionStatus.live,
        saleStartAt: createDate(-10),
        saleEndAt: createDate(5),
        depositEndAt: createDate(-5),
        auctionStartAt: createDate(0, -2),
        auctionEndAt: createDate(0, 4),
        viewTime: '9:00 - 17:00',
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

    participant1 = await prisma.auctionParticipant.create({
      data: {
        userId: bidder1.id,
        auctionId: liveAuction.id,
        registeredAt: createDate(-7),
        confirmedAt: createDate(-5),
        checkedInAt: createDate(0, -1),
        depositPaidAt: createDate(-5),
        depositAmount: new Decimal(1000000),
      },
    });

    participant2 = await prisma.auctionParticipant.create({
      data: {
        userId: bidder2.id,
        auctionId: liveAuction.id,
        registeredAt: createDate(-7),
        confirmedAt: createDate(-5),
        checkedInAt: createDate(0, -1),
        depositPaidAt: createDate(-5),
        depositAmount: new Decimal(1000000),
      },
    });
  }

  beforeEach(async () => {
    await setupTestData();
  });

  // ============================================
  // Successful Bids
  // ============================================
  describe('Successful Bids', () => {
    it('TC-2.5.1-01: Verify first bid at starting price', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({ auctionId: liveAuction.id, amount: 10000000 })
        .expect(201);

      expect(response.body.amount).toBe('10000000');
      expect(response.body.isWinningBid).toBe(true);

      const bid = await prisma.auctionBid.findFirst({
        where: { auctionId: liveAuction.id, participantId: participant1.id },
      });
      expect(bid).toBeTruthy();
      expect(bid!.bidType).toBe(BidType.manual);
    });

    it('TC-2.5.1-02: Verify bid at minimum increment', async () => {
      // Create initial bid
      await prisma.auctionBid.create({
        data: {
          auctionId: liveAuction.id,
          participantId: participant1.id,
          amount: new Decimal(10000000),
          bidAt: new Date(),
          bidType: BidType.manual,
          isWinningBid: true,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder2Token}`)
        .send({ auctionId: liveAuction.id, amount: 10500000 })
        .expect(201);

      expect(response.body.isWinningBid).toBe(true);
    });

    it('TC-2.5.1-03: Verify bid higher than minimum increment', async () => {
      await prisma.auctionBid.create({
        data: {
          auctionId: liveAuction.id,
          participantId: participant1.id,
          amount: new Decimal(10000000),
          bidAt: new Date(),
          bidType: BidType.manual,
          isWinningBid: true,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder2Token}`)
        .send({ auctionId: liveAuction.id, amount: 12000000 })
        .expect(201);
    });

    it('TC-2.5.1-24: Verify self-outbidding (outbid own highest bid)', async () => {
      await prisma.auctionBid.create({
        data: {
          auctionId: liveAuction.id,
          participantId: participant1.id,
          amount: new Decimal(10000000),
          bidAt: new Date(),
          bidType: BidType.manual,
          isWinningBid: true,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({ auctionId: liveAuction.id, amount: 10500000 })
        .expect(201);
    });
  });

  // ============================================
  // Bid Validation Failures
  // ============================================
  describe('Bid Validation Failures', () => {
    it('TC-2.5.1-04: Fail with insufficient increment', async () => {
      await prisma.auctionBid.create({
        data: {
          auctionId: liveAuction.id,
          participantId: participant1.id,
          amount: new Decimal(10000000),
          bidAt: new Date(),
          bidType: BidType.manual,
          isWinningBid: true,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder2Token}`)
        .send({ auctionId: liveAuction.id, amount: 10400000 })
        .expect(400);

      expect(response.body.message).toMatch(/increment|minimum/i);
    });

    it('TC-2.5.1-06: Fail with bid below current highest', async () => {
      await prisma.auctionBid.create({
        data: {
          auctionId: liveAuction.id,
          participantId: participant1.id,
          amount: new Decimal(11000000),
          bidAt: new Date(),
          bidType: BidType.manual,
          isWinningBid: true,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder2Token}`)
        .send({ auctionId: liveAuction.id, amount: 10000000 })
        .expect(400);
    });

    it('TC-2.2.3-05: Fail with bid below starting price', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({ auctionId: liveAuction.id, amount: 5000000 })
        .expect(400);
    });

    it('TC-2.5.1-20: Fail with zero amount', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({ auctionId: liveAuction.id, amount: 0 })
        .expect(400);
    });

    it('TC-2.5.1-19: Fail with negative amount', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({ auctionId: liveAuction.id, amount: -1000000000 })
        .expect(400);
    });

    it('TC-2.7.1-06: Fail with missing auctionId', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({ amount: 10000000 })
        .expect(400);
    });

    it('TC-2.7.1-08: Fail with missing amount', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({ auctionId: liveAuction.id })
        .expect(400);
    });
  });

  // ============================================
  // Participant Status Checks
  // ============================================
  describe('Participant Status Checks', () => {
    it('TC-2.5.1-27: Fail bid from non-checked-in participant', async () => {
      await prisma.auctionParticipant.update({
        where: { id: participant1.id },
        data: { checkedInAt: null },
      });

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({ auctionId: liveAuction.id, amount: 10000000 })
        .expect(403);
    });

    it('TC-2.1.3-08: Fail bid from non-registered user', async () => {
      const newBidder = await createTestUser(prisma, {
        email: 'noreg@test.com',
        role: UserRole.bidder,
      });
      const newToken = createTestJWT(newBidder, UserRole.bidder);

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${newToken}`)
        .send({ auctionId: liveAuction.id, amount: 10000000 })
        .expect(403);
    });

    it('TC-2.5.1-26: Fail bid from withdrawn participant', async () => {
      await prisma.auctionParticipant.update({
        where: { id: participant1.id },
        data: { withdrawnAt: new Date() },
      });

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({ auctionId: liveAuction.id, amount: 10000000 })
        .expect(403);
    });

    it('TC-2.5.1-28: Fail bid from banned user', async () => {
      await prisma.user.update({
        where: { id: bidder1.id },
        data: { isBanned: true },
      });

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({ auctionId: liveAuction.id, amount: 10000000 })
        .expect(403);
    });
  });

  // ============================================
  // Auction Status Checks
  // ============================================
  describe('Auction Status Checks', () => {
    it('TC-2.5.1-08: Fail bid on scheduled auction', async () => {
      const location = await prisma.location.findFirst();
      const scheduledAuction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-SCHED-001`,
          name: 'Scheduled Auction',
          propertyOwner: { name: 'Owner' },
          assetType: 'secured_asset',
          status: AuctionStatus.scheduled,
          saleStartAt: createDate(-5),
          saleEndAt: createDate(10),
          depositEndAt: createDate(5),
          auctionStartAt: createDate(7),
          auctionEndAt: createDate(7, 3),
          viewTime: '9:00 - 17:00',
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
          auctionId: scheduledAuction.id,
          registeredAt: createDate(-3),
          confirmedAt: createDate(-1),
          checkedInAt: new Date(),
          depositPaidAt: createDate(-1),
          depositAmount: new Decimal(1000000),
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({ auctionId: scheduledAuction.id, amount: 10000000 })
        .expect(403); // Guard blocks non-live auctions before validation
    });

    it('TC-2.5.1-09: Fail bid on completed auction', async () => {
      const location = await prisma.location.findFirst();
      const completedAuction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-COMP-001`,
          name: 'Completed Auction',
          propertyOwner: { name: 'Owner' },
          assetType: 'secured_asset',
          status: AuctionStatus.success,
          saleStartAt: createDate(-20),
          saleEndAt: createDate(-10),
          depositEndAt: createDate(-15),
          auctionStartAt: createDate(-12),
          auctionEndAt: createDate(-10),
          viewTime: '9:00 - 17:00',
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

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bidder1Token}`)
        .send({ auctionId: completedAuction.id, amount: 10000000 })
        .expect(403); // Guard blocks non-live auctions before validation
    });
  });

  // ============================================
  // Authentication
  // ============================================
  describe('Authentication', () => {
    it('TC-2.4.7-03: Fail bid without authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .send({ auctionId: liveAuction.id, amount: 10000000 })
        .expect(401);
    });

    it('TC-2.2.4-02: Fail bid with invalid token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', 'Bearer invalid-token')
        .send({ auctionId: liveAuction.id, amount: 10000000 })
        .expect(401);
    });
  });
});
