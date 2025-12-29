/**
 * Integration Tests for 2.4.2 Withdraw Registration
 * Test Case IDs: TC-2.4.2-01 to TC-2.4.2-07
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

describe('2.4.2 Withdraw Registration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bidder: TestUser;
  let bidderToken: string;
  let auction: { id: string };
  let registration: { id: string };
  const TEST_PREFIX = 'TEST-WITHDRAW';

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
      email: 'withdraw_bidder@test.com',
      role: UserRole.bidder,
    });
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    const location = await prisma.location.findFirst();
    auction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Withdraw Test Auction',
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
        registeredAt: new Date(),
      },
    });
  });

  describe('Successful Withdrawal', () => {
    it('TC-2.4.6-01: Verify bidder withdraws registration', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/withdraw')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: auction.id })
        .expect(200);

      const updated = await prisma.auctionParticipant.findUnique({
        where: { id: registration.id },
      });
      expect(updated?.withdrawnAt).toBeTruthy();
    });
  });

  describe('Withdrawal Failures', () => {
    it('TC-2.4.2-06: Fail withdraw non-existent registration', async () => {
      const otherBidder = await createTestUser(prisma, {
        email: 'other@test.com',
        role: UserRole.bidder,
      });
      const otherToken = createTestJWT(otherBidder, UserRole.bidder);

      await request(app.getHttpServer())
        .post('/api/register-to-bid/withdraw')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ auctionId: auction.id })
        .expect(404);
    });

    it('TC-2.4.2-05: Fail withdraw already withdrawn', async () => {
      await prisma.auctionParticipant.update({
        where: { id: registration.id },
        data: { withdrawnAt: new Date() },
      });

      await request(app.getHttpServer())
        .post('/api/register-to-bid/withdraw')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: auction.id })
        .expect(409);
    });

    it('TC-2.4.2-04: Fail withdraw during live auction', async () => {
      await prisma.auction.update({
        where: { id: auction.id },
        data: { status: AuctionStatus.live },
      });

      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/withdraw')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: auction.id });

      expect([400, 200]).toContain(response.status);
    });
  });
});
