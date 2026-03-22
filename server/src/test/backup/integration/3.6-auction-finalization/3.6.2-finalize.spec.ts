/**
 * Integration Tests for 3.6.2 Finalize Auction
 * Test Case IDs: TC-3.6.2-01 to TC-3.6.2-10
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

describe('3.6.2 Finalize Auction', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let bidder: TestUser;
  let auctioneer: TestUser;
  let adminToken: string;
  let bidderToken: string;
  let endedAuction: { id: string };
  const TEST_PREFIX = 'TEST-FIN';

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
      email: 'fin_admin@test.com',
      role: UserRole.admin,
    });
    auctioneer = await createTestUser(prisma, {
      email: 'fin_auctioneer@test.com',
      role: UserRole.auctioneer,
    });
    bidder = await createTestUser(prisma, {
      email: 'fin_bidder@test.com',
      role: UserRole.bidder,
    });
    adminToken = createTestJWT(admin, UserRole.admin);
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    const location = await prisma.location.findFirst();
    endedAuction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Finalization Test Auction',
        propertyOwner: { name: 'Owner', email: 'owner@test.com' },
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

  describe('Successful Finalization', () => {
    it('TC-3.6.2-01: Verify Admin finalizes auction with bids', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auction-finalization/finalize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ auctionId: endedAuction.id })
        .expect(200);

      const auction = await prisma.auction.findUnique({
        where: { id: endedAuction.id },
      });
      expect(auction?.status).toBe(AuctionStatus.success);
    });

    it('TC-3.6.2-02: Verify finalization creates contract', async () => {
      await request(app.getHttpServer())
        .post('/api/auction-finalization/finalize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ auctionId: endedAuction.id })
        .expect(200);

      const contract = await prisma.contract.findFirst({
        where: { auctionId: endedAuction.id },
      });
      expect(contract).toBeTruthy();
      expect(contract?.buyerUserId).toBe(bidder.id);
    });

    it('TC-3.6.2-03: Verify finalization without bids marks as failed', async () => {
      await prisma.auctionBid.deleteMany({
        where: { auctionId: endedAuction.id },
      });

      await request(app.getHttpServer())
        .post('/api/auction-finalization/finalize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ auctionId: endedAuction.id })
        .expect(200);

      const auction = await prisma.auction.findUnique({
        where: { id: endedAuction.id },
      });
      expect(auction?.status).toBe(AuctionStatus.failed);
    });

    it('TC-3.6.2-04: Verify finalization creates audit log', async () => {
      await request(app.getHttpServer())
        .post('/api/auction-finalization/finalize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ auctionId: endedAuction.id })
        .expect(200);

      const logs = await prisma.auctionAuditLog.findMany({
        where: { auctionId: endedAuction.id },
      });
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('Finalization Failures', () => {
    it('TC-3.6.2-05: Fail Bidder finalizes auction', async () => {
      await request(app.getHttpServer())
        .post('/api/auction-finalization/finalize')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: endedAuction.id })
        .expect(403);
    });

    it('TC-3.6.2-06: Fail finalize already finalized', async () => {
      await prisma.auction.update({
        where: { id: endedAuction.id },
        data: { status: AuctionStatus.success },
      });

      await request(app.getHttpServer())
        .post('/api/auction-finalization/finalize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ auctionId: endedAuction.id })
        .expect(400);
    });

    it('TC-3.6.2-07: Fail finalize live auction', async () => {
      await prisma.auction.update({
        where: { id: endedAuction.id },
        data: { status: AuctionStatus.live },
      });

      await request(app.getHttpServer())
        .post('/api/auction-finalization/finalize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ auctionId: endedAuction.id })
        .expect(400);
    });
  });
});
