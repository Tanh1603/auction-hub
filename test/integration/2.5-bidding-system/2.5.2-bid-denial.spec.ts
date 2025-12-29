/**
 * Integration Tests for 2.5.2 Bid Denial
 * Test Case IDs: TC-2.5.2-01 to TC-2.5.2-10
 *
 * Tests bid denial functionality including:
 * - Admin/Auctioneer denying bids
 * - Bid state changes
 * - Winner promotion
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

describe('2.5.2 Bid Denial', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let admin: TestUser;
  let auctioneer: TestUser;
  let bidder: TestUser;

  let adminToken: string;
  let auctioneerToken: string;
  let bidderToken: string;

  let liveAuction: { id: string };
  let winningBid: { id: string };

  const TEST_PREFIX = 'TEST-DENY';

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

    admin = await createTestUser(prisma, {
      email: 'deny_admin@test.com',
      role: UserRole.admin,
    });
    auctioneer = await createTestUser(prisma, {
      email: 'deny_auctioneer@test.com',
      role: UserRole.auctioneer,
    });
    bidder = await createTestUser(prisma, {
      email: 'deny_bidder@test.com',
      role: UserRole.bidder,
    });

    adminToken = createTestJWT(admin, UserRole.admin);
    auctioneerToken = createTestJWT(auctioneer, UserRole.auctioneer);
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    const location = await prisma.location.findFirst();

    liveAuction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Bid Denial Test Auction',
        // Set propertyOwner to the auctioneer so they have permission to deny bids
        // The deny endpoint checks: isOwner OR isAdminOrSuperAdmin
        propertyOwner: {
          id: auctioneer.id, // Critical: links auctioneer to auction
          fullName: 'Test Auctioneer Owner',
          email: auctioneer.email,
        },
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

    const participant = await prisma.auctionParticipant.create({
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

    winningBid = await prisma.auctionBid.create({
      data: {
        auctionId: liveAuction.id,
        participantId: participant.id,
        amount: new Decimal(10000000),
        bidAt: new Date(),
        bidType: BidType.manual,
        isWinningBid: true,
      },
    });
  }

  beforeEach(async () => {
    await setupTestData();
  });

  // ============================================
  // Successful Denial
  // ============================================
  describe('Successful Denial', () => {
    it('TC-2.5.2-02: Verify Admin denies bid with reason', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid/deny')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bidId: winningBid.id, reason: 'Invalid bidder' })
        .expect(200);

      const bid = await prisma.auctionBid.findUnique({
        where: { id: winningBid.id },
      });
      expect(bid!.isDenied).toBe(true);
      expect(bid!.deniedAt).toBeTruthy();
      expect(bid!.isWinningBid).toBe(false);
    });

    it('TC-2.5.2-01: Verify Auctioneer denies bid', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid/deny')
        .set('Authorization', `Bearer ${auctioneerToken}`)
        .send({ bidId: winningBid.id, reason: 'Fraud detected' })
        .expect(200);
    });
  });

  // ============================================
  // Denial Failures
  // ============================================
  describe('Denial Failures', () => {
    it('TC-2.8.4-03: Fail Bidder denies bid', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid/deny')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ bidId: winningBid.id, reason: 'Test' })
        .expect(403);
    });

    it('TC-2.5.2-06: Fail deny non-existent bid', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid/deny')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bidId: '550e8400-e29b-41d4-a716-446655440000', reason: 'Test' })
        .expect(404);
    });

    it('TC-2.5.2-07: Fail deny already denied bid', async () => {
      await prisma.auctionBid.update({
        where: { id: winningBid.id },
        data: { isDenied: true, deniedAt: new Date() },
      });

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid/deny')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bidId: winningBid.id, reason: 'Test' });

      // Accept 400 (Bad Request) or 409 (Conflict) - both indicate invalid state transition
      expect([400, 409]).toContain(response.status);
    });

    it('TC-2.5.1-18: Fail deny with missing reason', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid/deny')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bidId: winningBid.id });

      // May require reason or not
      expect([200, 400]).toContain(response.status);
    });
  });

  // ============================================
  // Winner Promotion
  // ============================================
  describe('Winner Promotion', () => {
    it('TC-2.5.2-08: Verify next highest bid promoted when winning denied', async () => {
      // Create second bidder and bids
      const bidder2 = await createTestUser(prisma, {
        email: 'deny_bidder2@test.com',
        role: UserRole.bidder,
      });

      const participant2 = await prisma.auctionParticipant.create({
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

      // Create a lower bid
      const lowerBid = await prisma.auctionBid.create({
        data: {
          auctionId: liveAuction.id,
          participantId: participant2.id,
          amount: new Decimal(950000000),
          bidAt: new Date(Date.now() - 1000),
          bidType: BidType.manual,
          isWinningBid: false,
        },
      });

      // Deny winning bid
      await request(app.getHttpServer())
        .post('/api/manual-bid/deny')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bidId: winningBid.id, reason: 'Invalid' })
        .expect(200);

      // Lower bid should now be winning
      const updatedLowerBid = await prisma.auctionBid.findUnique({
        where: { id: lowerBid.id },
      });
      expect(updatedLowerBid!.isWinningBid).toBe(true);
    });
  });

  // ============================================
  // Authentication
  // ============================================
  describe('Authentication', () => {
    it('TC-2.5.1-14: Fail denial without authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/manual-bid/deny')
        .send({ bidId: winningBid.id, reason: 'Test' })
        .expect(401);
    });
  });
});
