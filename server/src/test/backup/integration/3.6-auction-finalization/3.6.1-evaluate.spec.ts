/**
 * Integration Tests for 3.6.1 Evaluate Auction
 * Test Case IDs: TC-3.6.1-01 to TC-3.6.1-07
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

describe('3.6.1 Evaluate Auction', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let bidder: TestUser;
  let adminToken: string;
  let bidderToken: string;
  let endedAuction: { id: string };
  const TEST_PREFIX = 'TEST-EVAL';

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
      email: 'eval_admin@test.com',
      role: UserRole.admin,
    });
    bidder = await createTestUser(prisma, {
      email: 'eval_bidder@test.com',
      role: UserRole.bidder,
    });
    adminToken = createTestJWT(admin, UserRole.admin);
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    const location = await prisma.location.findFirst();
    endedAuction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
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

    const participant = await prisma.auctionParticipant.create({
      data: {
        userId: bidder.id,
        auctionId: endedAuction.id,
        registeredAt: createDate(-18),
        confirmedAt: createDate(-15),
        checkedInAt: createDate(-12),
        depositPaidAt: createDate(-15),
        depositAmount: new Decimal(100000000),
      },
    });

    await prisma.auctionBid.create({
      data: {
        auctionId: endedAuction.id,
        participantId: participant.id,
        amount: new Decimal(1200000000),
        bidAt: createDate(-11),
        bidType: BidType.manual,
        isWinningBid: true,
      },
    });
  });

  describe('Successful Evaluation', () => {
    it('TC-3.6.1-01: Verify Admin evaluates auction', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auction-finalization/evaluate/${endedAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('auctionId');
      expect(response.body).toHaveProperty('winningBid');
      expect(response.body).toHaveProperty('bidCount');
    });

    it('TC-3.6.1-02: Verify evaluation includes winner data', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auction-finalization/evaluate/${endedAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.winningBid).toBeTruthy();
      expect(response.body.winningBid.amount).toBe('1200000000');
    });
  });

  describe('Evaluation Failures', () => {
    it('TC-3.6.1-03: Fail Bidder evaluates auction', async () => {
      await request(app.getHttpServer())
        .get(`/api/auction-finalization/evaluate/${endedAuction.id}`)
        .set('Authorization', `Bearer ${bidderToken}`)
        .expect(403);
    });

    it('TC-3.6.1-04: Fail evaluate non-existent auction', async () => {
      await request(app.getHttpServer())
        .get(
          '/api/auction-finalization/evaluate/550e8400-e29b-41d4-a716-446655440000'
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('TC-3.6.1-05: Fail evaluate live auction', async () => {
      await prisma.auction.update({
        where: { id: endedAuction.id },
        data: { status: AuctionStatus.live },
      });

      await request(app.getHttpServer())
        .get(`/api/auction-finalization/evaluate/${endedAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});
