/**
 * Integration Tests for 5.1.2 Idempotency
 * Test Case IDs: TC-5.1.8-01 to TC-5.1.8-03
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

describe('5.1.2 Idempotency', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bidder: TestUser;
  let bidderToken: string;
  const TEST_PREFIX = 'TEST-IDEMP';

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
      email: 'idemp_bidder@test.com',
      role: UserRole.bidder,
    });
    bidderToken = createTestJWT(bidder, UserRole.bidder);
  });

  describe('Registration Idempotency', () => {
    it('TC-5.1.2-01: Duplicate registration returns conflict', async () => {
      const location = await prisma.location.findFirst();
      const auction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-001`,
          name: 'Idempotency Test',
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

      // First registration
      await request(app.getHttpServer())
        .post('/api/register-to-bid')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: auction.id })
        .expect(201);

      // Second registration - should fail with 409
      await request(app.getHttpServer())
        .post('/api/register-to-bid')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: auction.id })
        .expect(409);

      // Only one registration should exist
      const count = await prisma.auctionParticipant.count({
        where: { auctionId: auction.id, userId: bidder.id },
      });
      expect(count).toBe(1);
    });
  });

  describe('Check-in Idempotency', () => {
    it('TC-5.1.2-02: Duplicate check-in returns conflict', async () => {
      const location = await prisma.location.findFirst();
      const auction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-002`,
          name: 'Check-in Idempotency',
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

      await prisma.auctionParticipant.create({
        data: {
          userId: bidder.id,
          auctionId: auction.id,
          registeredAt: createDate(-7),
          confirmedAt: createDate(-5),
          depositPaidAt: createDate(-5),
          depositAmount: new Decimal(100000000),
        },
      });

      // First check-in
      await request(app.getHttpServer())
        .post('/api/register-to-bid/check-in')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: auction.id })
        .expect(200);

      // Second check-in - should fail
      await request(app.getHttpServer())
        .post('/api/register-to-bid/check-in')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: auction.id })
        .expect(409);
    });
  });

  describe('Finalization Idempotency', () => {
    it('TC-5.1.2-03: Duplicate finalization returns error', async () => {
      const admin = await createTestUser(prisma, {
        email: 'idemp_admin@test.com',
        role: UserRole.admin,
      });
      const adminToken = createTestJWT(admin, UserRole.admin);

      const location = await prisma.location.findFirst();
      const auction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-003`,
          name: 'Finalization Idempotency',
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

      // First finalization
      await request(app.getHttpServer())
        .post('/api/auction-finalization/finalize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ auctionId: auction.id })
        .expect(200);

      // Second finalization - should fail
      await request(app.getHttpServer())
        .post('/api/auction-finalization/finalize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ auctionId: auction.id })
        .expect(400);
    });
  });
});
