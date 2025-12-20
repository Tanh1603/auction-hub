/**
 * Integration Tests for 3.4.3 Check-in
 * Test Case IDs: TC-3.4.3-01 to TC-3.4.3-08
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

describe('3.4.3 Check-in', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bidder: TestUser;
  let bidderToken: string;
  let liveAuction: { id: string };
  let confirmedRegistration: { id: string };
  const TEST_PREFIX = 'TEST-CHECKIN';

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

    bidder = await createTestUser(prisma, {
      email: 'checkin_bidder@test.com',
      role: UserRole.bidder,
    });
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    const location = await prisma.location.findFirst();
    liveAuction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Live Check-in Auction',
        propertyOwner: { name: 'Owner' },
        assetType: 'secured_asset',
        status: AuctionStatus.live,
        saleStartAt: createDate(-10),
        saleEndAt: createDate(5),
        depositEndAt: createDate(-5),
        auctionStartAt: createDate(0, -1),
        auctionEndAt: createDate(0, 3),
        viewTime: '9:00-17:00',
        saleFee: new Decimal(500000),
        depositAmountRequired: new Decimal(100000000),
        startingPrice: new Decimal(1000000000),
        bidIncrement: new Decimal(50000000),
        assetDescription: 'Test',
        assetAddress: 'Test',
        validCheckInBeforeStartMinutes: 60,
        validCheckInAfterStartMinutes: 30,
        assetWardId: location?.id || 1,
        assetProvinceId: location?.id || 1,
      },
    });

    confirmedRegistration = await prisma.auctionParticipant.create({
      data: {
        userId: bidder.id,
        auctionId: liveAuction.id,
        registeredAt: createDate(-7),
        confirmedAt: createDate(-3),
        depositPaidAt: createDate(-3),
        depositAmount: new Decimal(100000000),
      },
    });
  });

  describe('Successful Check-in', () => {
    it('TC-3.4.3-01: Verify confirmed participant checks in', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/check-in')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: liveAuction.id })
        .expect(200);

      const updated = await prisma.auctionParticipant.findUnique({
        where: { id: confirmedRegistration.id },
      });
      expect(updated?.checkedInAt).toBeTruthy();
    });
  });

  describe('Check-in Failures', () => {
    it('TC-3.4.3-02: Fail check-in for non-confirmed participant', async () => {
      await prisma.auctionParticipant.update({
        where: { id: confirmedRegistration.id },
        data: { confirmedAt: null },
      });

      await request(app.getHttpServer())
        .post('/api/register-to-bid/check-in')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: liveAuction.id })
        .expect(403);
    });

    it('TC-3.4.3-03: Fail check-in for non-registered user', async () => {
      const otherBidder = await createTestUser(prisma, {
        email: 'other_checkin@test.com',
        role: UserRole.bidder,
      });
      const otherToken = createTestJWT(otherBidder, UserRole.bidder);

      await request(app.getHttpServer())
        .post('/api/register-to-bid/check-in')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ auctionId: liveAuction.id })
        .expect(404);
    });

    it('TC-3.4.3-04: Fail duplicate check-in', async () => {
      await prisma.auctionParticipant.update({
        where: { id: confirmedRegistration.id },
        data: { checkedInAt: new Date() },
      });

      await request(app.getHttpServer())
        .post('/api/register-to-bid/check-in')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: liveAuction.id })
        .expect(409);
    });

    it('TC-3.4.3-05: Fail check-in for scheduled auction', async () => {
      const location = await prisma.location.findFirst();
      const scheduledAuction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-SCHED`,
          name: 'Scheduled Auction',
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

      await prisma.auctionParticipant.create({
        data: {
          userId: bidder.id,
          auctionId: scheduledAuction.id,
          registeredAt: createDate(-3),
          confirmedAt: createDate(-1),
        },
      });

      await request(app.getHttpServer())
        .post('/api/register-to-bid/check-in')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: scheduledAuction.id })
        .expect(400);
    });
  });
});
