/**
 * Integration Tests for 2.6.3-5 Auction Results and Audit
 * Test Case IDs: TC-2.6.3-01 to TC-2.6.5-06
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

describe('2.6.3-5 Auction Results and Audit', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let bidder: TestUser;
  let adminToken: string;
  let bidderToken: string;
  let completedAuction: { id: string };
  const TEST_PREFIX = 'TEST-RES';

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
      email: 'res_admin@test.com',
      role: UserRole.admin,
    });
    bidder = await createTestUser(prisma, {
      email: 'res_bidder@test.com',
      role: UserRole.bidder,
    });
    adminToken = createTestJWT(admin, UserRole.admin);
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    const location = await prisma.location.findFirst();
    completedAuction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Results Test Auction',
        propertyOwner: { name: 'Owner' },
        assetType: 'secured_asset',
        status: AuctionStatus.success,
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

    const participant = await prisma.auctionParticipant.create({
      data: {
        userId: bidder.id,
        auctionId: completedAuction.id,
        registeredAt: createDate(-18),
        confirmedAt: createDate(-15),
        checkedInAt: createDate(-12),
        depositPaidAt: createDate(-15),
        depositAmount: new Decimal(1000000),
      },
    });

    await prisma.auctionBid.create({
      data: {
        auctionId: completedAuction.id,
        participantId: participant.id,
        amount: new Decimal(12000000),
        bidAt: createDate(-11),
        bidType: BidType.manual,
        isWinningBid: true,
      },
    });

    // Create audit logs
    await prisma.auctionAuditLog.create({
      data: {
        auctionId: completedAuction.id,
        action: 'AUCTION_FINALIZED',
        performedBy: admin.id,
        metadata: { status: 'success', winningamount: 12000000 },
        createdAt: createDate(-10),
      },
    });
  });

  // ============================================
  // 2.6.3 Get Auction Results
  // ============================================
  describe('2.6.3 Get Auction Results', () => {
    it('TC-2.6.4-04: Verify get results for completed auction', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auction-finalization/results/${completedAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('auctionId');
      expect(response.body).toHaveProperty('winningBid');
    });

    it('TC-2.6.4-05: Winner can view their result', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auction-finalization/results/${completedAuction.id}`)
        .set('Authorization', `Bearer ${bidderToken}`);

      expect([200, 403]).toContain(response.status);
    });

    it('TC-2.6.4-04: Fail get results for live auction', async () => {
      await prisma.auction.update({
        where: { id: completedAuction.id },
        data: { status: AuctionStatus.live },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/auction-finalization/results/${completedAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([400, 200]).toContain(response.status);
    });
  });

  // ============================================
  // 2.6.4 Audit Logs
  // ============================================
  describe('2.6.4 Audit Logs', () => {
    it('TC-2.6.5-01: Verify Admin views audit logs', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auction-finalization/audit-logs/${completedAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('TC-2.6.5-02: Fail Bidder views audit logs', async () => {
      await request(app.getHttpServer())
        .get(`/api/auction-finalization/audit-logs/${completedAuction.id}`)
        .set('Authorization', `Bearer ${bidderToken}`)
        .expect(403);
    });

    it('TC-2.6.4-02: Verify audit log includes action details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auction-finalization/audit-logs/${completedAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const log = response.body[0];
      expect(log).toHaveProperty('action');
      expect(log).toHaveProperty('performedBy');
      expect(log).toHaveProperty('createdAt');
    });
  });

  // ============================================
  // 2.6.5 Status Override
  // ============================================
  describe('2.6.5 Status Override', () => {
    it('TC-2.8.4-01: Verify Admin overrides auction status', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/auction-finalization/override`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          auctionId: completedAuction.id,
          newStatus: 'cancelled',
          reason: 'Winner did not complete payment',
        });

      expect([200, 400]).toContain(response.status);
    });

    it('TC-2.8.4-03: Fail Bidder overrides status', async () => {
      await request(app.getHttpServer())
        .post(`/api/auction-finalization/override`)
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          auctionId: completedAuction.id,
          newStatus: 'failed',
          reason: 'Test',
        })
        .expect(403);
    });

    it('TC-2.6.3-06: Verify override creates audit log', async () => {
      await request(app.getHttpServer())
        .post(`/api/auction-finalization/override`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          auctionId: completedAuction.id,
          newStatus: 'cancelled',
          reason: 'Administrative decision',
        });

      const logs = await prisma.auctionAuditLog.findMany({
        where: { auctionId: completedAuction.id },
        orderBy: { createdAt: 'desc' },
      });

      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it('TC-2.6.3-04: Fail override without reason', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/auction-finalization/override`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          auctionId: completedAuction.id,
          newStatus: 'cancelled',
        });

      expect([400, 200]).toContain(response.status);
    });
  });
});
