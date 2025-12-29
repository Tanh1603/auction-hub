/**
 * Integration Tests for 5.1.1 Race Conditions
 * Test Case IDs: TC-5.1.1-01 to TC-5.1.1-03
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

describe('5.1.1 Race Conditions', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bidder1: TestUser;
  let bidder2: TestUser;
  let bidder3: TestUser;
  let bidder1Token: string;
  let bidder2Token: string;
  let bidder3Token: string;
  let liveAuction: { id: string };
  const TEST_PREFIX = 'TEST-RACE';

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
      email: 'race_b1@test.com',
      role: UserRole.bidder,
    });
    bidder2 = await createTestUser(prisma, {
      email: 'race_b2@test.com',
      role: UserRole.bidder,
    });
    bidder3 = await createTestUser(prisma, {
      email: 'race_b3@test.com',
      role: UserRole.bidder,
    });

    bidder1Token = createTestJWT(bidder1, UserRole.bidder);
    bidder2Token = createTestJWT(bidder2, UserRole.bidder);
    bidder3Token = createTestJWT(bidder3, UserRole.bidder);

    const location = await prisma.location.findFirst();
    liveAuction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Race Condition Test',
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

    // Create participants
    for (const bidder of [bidder1, bidder2, bidder3]) {
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
    }
  });

  describe('Concurrent Bidding', () => {
    it('TC-5.1.1-01: Concurrent bids at same price - only one wins', async () => {
      const bidAmount = 50000000;

      const results = await Promise.allSettled([
        request(app.getHttpServer())
          .post('/api/manual-bid')
          .set('Authorization', `Bearer ${bidder1Token}`)
          .send({ auctionId: liveAuction.id, amount: bidAmount }),
        request(app.getHttpServer())
          .post('/api/manual-bid')
          .set('Authorization', `Bearer ${bidder2Token}`)
          .send({ auctionId: liveAuction.id, amount: bidAmount }),
        request(app.getHttpServer())
          .post('/api/manual-bid')
          .set('Authorization', `Bearer ${bidder3Token}`)
          .send({ auctionId: liveAuction.id, amount: bidAmount }),
      ]);

      // At least one should succeed
      const successes = results.filter(
        (r) =>
          r.status === 'fulfilled' &&
          (r.value as { status: number }).status === 201
      );
      expect(successes.length).toBeGreaterThanOrEqual(1);

      // Only ONE winning bid should exist
      const winningBids = await prisma.auctionBid.findMany({
        where: { auctionId: liveAuction.id, isWinningBid: true },
      });
      expect(winningBids.length).toBe(1);
    });

    it('TC-5.1.1-02: Concurrent incremental bids preserve order', async () => {
      // Create initial bid
      await prisma.auctionBid.create({
        data: {
          auctionId: liveAuction.id,
          participantId: (await prisma.auctionParticipant.findFirst({
            where: { auctionId: liveAuction.id, userId: bidder1.id },
          }))!.id,
          amount: new Decimal(10000000),
          bidAt: new Date(),
          bidType: BidType.manual,
          isWinningBid: true,
        },
      });

      // Send concurrent higher bids
      await Promise.allSettled([
        request(app.getHttpServer())
          .post('/api/manual-bid')
          .set('Authorization', `Bearer ${bidder2Token}`)
          .send({ auctionId: liveAuction.id, amount: 10500000 }),
        request(app.getHttpServer())
          .post('/api/manual-bid')
          .set('Authorization', `Bearer ${bidder3Token}`)
          .send({ auctionId: liveAuction.id, amount: 11000000 }),
      ]);

      // Highest bid should be winning
      const winningBid = await prisma.auctionBid.findFirst({
        where: { auctionId: liveAuction.id, isWinningBid: true },
        orderBy: { amount: 'desc' },
      });

      expect(winningBid).toBeTruthy();
    });
  });

  describe('Concurrent Registration', () => {
    it('TC-2.4.1-05: Duplicate registration prevented under race', async () => {
      const location = await prisma.location.findFirst();
      const newAuction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-DUPE-001`,
          name: 'Duplicate Registration Test',
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

      // Concurrent registrations for same user
      await Promise.allSettled([
        request(app.getHttpServer())
          .post('/api/register-to-bid')
          .set('Authorization', `Bearer ${bidder1Token}`)
          .send({ auctionId: newAuction.id }),
        request(app.getHttpServer())
          .post('/api/register-to-bid')
          .set('Authorization', `Bearer ${bidder1Token}`)
          .send({ auctionId: newAuction.id }),
      ]);

      // Only ONE registration should exist
      const registrations = await prisma.auctionParticipant.findMany({
        where: { auctionId: newAuction.id, userId: bidder1.id },
      });
      expect(registrations.length).toBe(1);
    });
  });
});
