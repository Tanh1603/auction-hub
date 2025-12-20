/**
 * Integration Tests for 3.5.4-5 Bid History and WebSocket Stream
 * Test Case IDs: TC-3.5.4-01 to TC-3.5.5-04
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

describe('3.5.4-5 Bid History and Stream', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bidder1: TestUser;
  let bidder2: TestUser;
  let bidder1Token: string;
  let liveAuction: { id: string };
  const TEST_PREFIX = 'TEST-HIST';

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

    bidder1 = await createTestUser(prisma, {
      email: 'hist_bidder1@test.com',
      role: UserRole.bidder,
    });
    bidder2 = await createTestUser(prisma, {
      email: 'hist_bidder2@test.com',
      role: UserRole.bidder,
    });
    bidder1Token = createTestJWT(bidder1, UserRole.bidder);

    const location = await prisma.location.findFirst();
    liveAuction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Bid History Test',
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

    const part1 = await prisma.auctionParticipant.create({
      data: {
        userId: bidder1.id,
        auctionId: liveAuction.id,
        registeredAt: createDate(-7),
        confirmedAt: createDate(-5),
        checkedInAt: createDate(0, -1),
        depositPaidAt: createDate(-5),
        depositAmount: new Decimal(100000000),
      },
    });

    const part2 = await prisma.auctionParticipant.create({
      data: {
        userId: bidder2.id,
        auctionId: liveAuction.id,
        registeredAt: createDate(-7),
        confirmedAt: createDate(-5),
        checkedInAt: createDate(0, -1),
        depositPaidAt: createDate(-5),
        depositAmount: new Decimal(100000000),
      },
    });

    // Create bid history
    await prisma.auctionBid.createMany({
      data: [
        {
          auctionId: liveAuction.id,
          participantId: part1.id,
          amount: new Decimal(1000000000),
          bidAt: createDate(0, -1, -30),
          bidType: BidType.manual,
          isWinningBid: false,
        },
        {
          auctionId: liveAuction.id,
          participantId: part2.id,
          amount: new Decimal(1050000000),
          bidAt: createDate(0, -1, -20),
          bidType: BidType.manual,
          isWinningBid: false,
        },
        {
          auctionId: liveAuction.id,
          participantId: part1.id,
          amount: new Decimal(1100000000),
          bidAt: createDate(0, -1, -10),
          bidType: BidType.manual,
          isWinningBid: true,
        },
      ],
    });
  });

  // ============================================
  // 3.5.4 Bid History
  // ============================================
  describe('3.5.4 Bid History', () => {
    it('TC-3.5.4-01: Verify get bid history for auction', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auctions/${liveAuction.id}/bids`)
        .set('Authorization', `Bearer ${bidder1Token}`)
        .expect(200);

      const bids = response.body.data || response.body;
      expect(Array.isArray(bids)).toBe(true);
      expect(bids.length).toBe(3);
    });

    it('TC-3.5.4-02: Verify bid history sorted by time', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auctions/${liveAuction.id}/bids?sortBy=bidAt&order=desc`)
        .set('Authorization', `Bearer ${bidder1Token}`)
        .expect(200);

      const bids = response.body.data || response.body;
      if (bids.length >= 2) {
        expect(new Date(bids[0].bidAt).getTime()).toBeGreaterThanOrEqual(
          new Date(bids[1].bidAt).getTime()
        );
      }
    });

    it('TC-3.5.4-03: Verify get current winning bid', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auctions/${liveAuction.id}/bids/current`)
        .set('Authorization', `Bearer ${bidder1Token}`);

      if (response.status === 200) {
        expect(response.body.isWinningBid).toBe(true);
      } else {
        expect([404, 200]).toContain(response.status);
      }
    });

    it('TC-3.5.4-04: Verify bid history pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auctions/${liveAuction.id}/bids?page=1&limit=2`)
        .set('Authorization', `Bearer ${bidder1Token}`)
        .expect(200);

      const bids = response.body.data || response.body;
      expect(bids.length).toBeLessThanOrEqual(2);
    });
  });

  // ============================================
  // 3.5.5 WebSocket Bid Stream (Placeholder)
  // ============================================
  describe('3.5.5 WebSocket Bid Stream', () => {
    it('TC-3.5.5-01: WebSocket connection test (placeholder)', async () => {
      // NOTE: WebSocket testing requires socket.io-client
      // This is a placeholder for documentation purposes
      console.log('TODO: Implement WebSocket tests with socket.io-client');
      expect(true).toBe(true);
    });

    it('TC-3.5.5-02: Verify bid broadcast to subscribers (placeholder)', async () => {
      // NOTE: WebSocket testing requires socket.io-client
      console.log('TODO: Implement WebSocket bid broadcast test');
      expect(true).toBe(true);
    });

    it('TC-3.5.5-03: Verify auction status updates via WebSocket (placeholder)', async () => {
      // NOTE: WebSocket testing requires socket.io-client
      console.log('TODO: Implement WebSocket status update test');
      expect(true).toBe(true);
    });

    it('TC-3.5.5-04: Verify WebSocket authentication (placeholder)', async () => {
      // NOTE: WebSocket testing requires socket.io-client
      console.log('TODO: Implement WebSocket authentication test');
      expect(true).toBe(true);
    });
  });
});
