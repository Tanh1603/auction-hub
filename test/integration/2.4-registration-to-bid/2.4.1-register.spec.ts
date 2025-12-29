/**
 * Integration Tests for 2.4.1 Register for Auction
 * Test Case IDs: TC-2.4.1-01 to TC-2.4.1-16
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

describe('2.4.1 Register for Auction', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bidder: TestUser;
  let bidderToken: string;
  let openAuction: { id: string };
  const TEST_PREFIX = 'TEST-REG';

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
      email: 'reg_bidder@test.com',
      role: UserRole.bidder,
    });
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    const location = await prisma.location.findFirst();
    openAuction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Open Registration Auction',
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
  });

  describe('Successful Registration', () => {
    it('TC-2.4.2-01: Verify bidder registers for auction', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: openAuction.id })
        .expect(201);

      expect(response.body.auctionId).toBe(openAuction.id);
      expect(response.body.registeredAt).toBeTruthy();

      const participant = await prisma.auctionParticipant.findFirst({
        where: { userId: bidder.id, auctionId: openAuction.id },
      });
      expect(participant).toBeTruthy();
    });

    it('TC-2.4.8-02: Verify registration creates pending status', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: openAuction.id })
        .expect(201);

      expect(response.body.confirmedAt).toBeNull();
    });
  });

  describe('Registration Failures', () => {
    it('TC-2.4.9-04: Fail duplicate registration', async () => {
      await request(app.getHttpServer())
        .post('/api/register-to-bid')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: openAuction.id })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/register-to-bid')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: openAuction.id })
        .expect(409);
    });

    it('TC-2.4.1-07: Fail registration without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/register-to-bid')
        .send({ auctionId: openAuction.id })
        .expect(401);
    });

    it('TC-2.4.1-06: Fail registration for non-existent auction', async () => {
      await request(app.getHttpServer())
        .post('/api/register-to-bid')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: '550e8400-e29b-41d4-a716-446655440000' })
        .expect(404);
    });

    it('TC-2.4.1-10: Fail registration for closed auction', async () => {
      const location = await prisma.location.findFirst();
      const closedAuction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-CLOSED`,
          name: 'Closed Auction',
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

      await request(app.getHttpServer())
        .post('/api/register-to-bid')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: closedAuction.id })
        .expect(403); // Registration closed - returns 403 Forbidden
    });

    it('TC-4.1.8-02: Fail banned user registers', async () => {
      await prisma.user.update({
        where: { id: bidder.id },
        data: { isBanned: true },
      });

      await request(app.getHttpServer())
        .post('/api/register-to-bid')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: openAuction.id })
        .expect(403);
    });
  });
});
