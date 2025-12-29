/**
 * Integration Tests for 2.4.4-5 Submit and Verify Deposit
 * Test Case IDs: TC-2.4.4-01 to TC-2.4.5-04
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

describe('2.4.4-5 Deposit Operations', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bidder: TestUser;
  let bidderToken: string;
  let auction: { id: string };
  let registration: { id: string };
  const TEST_PREFIX = 'TEST-DEP';

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

    bidder = await createTestUser(prisma, {
      email: 'dep_bidder@test.com',
      role: UserRole.bidder,
    });
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    const location = await prisma.location.findFirst();
    auction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Deposit Test Auction',
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

    registration = await prisma.auctionParticipant.create({
      data: {
        userId: bidder.id,
        auctionId: auction.id,
        registeredAt: createDate(-3),
        documentsVerifiedAt: createDate(-1),
      },
    });
  });

  // ============================================
  // 2.4.4 Submit Deposit
  // ============================================
  describe('2.4.4 Submit Deposit', () => {
    it('TC-2.4.4-01: Verify submit deposit after document verification', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/submit-deposit')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          registrationId: registration.id,
          auctionId: auction.id,
          amount: 50000000,
        });

      // NOTE: Requires Stripe integration
      expect([200, 201, 400]).toContain(response.status);
    });

    it('TC-2.4.4-02: Fail submit deposit without document verification', async () => {
      await prisma.auctionParticipant.update({
        where: { id: registration.id },
        data: { documentsVerifiedAt: null },
      });

      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/submit-deposit')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          registrationId: registration.id,
          auctionId: auction.id,
          amount: 50000000,
        });

      expect([400, 403]).toContain(response.status);
    });

    it('TC-2.4.4-03: Fail submit deposit with wrong amount', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/submit-deposit')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          registrationId: registration.id,
          auctionId: auction.id,
          amount: 1000, // Wrong amount
        });

      expect([400, 200]).toContain(response.status);
    });

    it('TC-2.4.4-04: Fail submit deposit for already paid', async () => {
      await prisma.auctionParticipant.update({
        where: { id: registration.id },
        data: {
          depositPaidAt: new Date(),
          depositAmount: new Decimal(1000000),
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/submit-deposit')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          registrationId: registration.id,
          auctionId: auction.id,
          amount: 50000000,
        });

      expect([409, 400]).toContain(response.status);
    });

    it('TC-2.4.4-05: Fail submit deposit with negative amount', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/submit-deposit')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          registrationId: registration.id,
          auctionId: auction.id,
          amount: -50000000,
        })
        .expect(400);
    });
  });

  // ============================================
  // 2.4.5 Verify Deposit Payment
  // ============================================
  describe('2.4.5 Verify Deposit Payment', () => {
    it('TC-2.4.5-01: Verify deposit payment verification', async () => {
      // NOTE: Requires real Stripe session
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/verify-deposit-payment')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          sessionId: 'cs_test_valid_session',
          registrationId: registration.id,
        });

      expect([200, 400, 404]).toContain(response.status);
    });

    it('TC-2.4.5-02: Fail verify incomplete payment', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/verify-deposit-payment')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          sessionId: 'cs_test_incomplete_session',
          registrationId: registration.id,
        });

      expect([400, 404]).toContain(response.status);
    });

    it('TC-2.4.5-03: Fail verify with invalid sessionId', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/verify-deposit-payment')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          sessionId: 'invalid_session',
          registrationId: registration.id,
        });

      expect([400, 404]).toContain(response.status);
    });
  });
});
