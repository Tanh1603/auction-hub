/**
 * Integration Tests for 4.1.5-6 BOLA and Banned User Access
 * Test Case IDs: TC-4.1.5-01 to TC-4.1.6-03
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

describe('4.1.5-6 BOLA and Banned Access', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user1: TestUser;
  let bannedUser: TestUser;
  let user1Token: string;
  let bannedToken: string;
  const TEST_PREFIX = 'TEST-BOLA';

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

    user1 = await createTestUser(prisma, {
      email: 'bola_user1@test.com',
      role: UserRole.bidder,
    });
    bannedUser = await createTestUser(prisma, {
      email: 'banned_user@test.com',
      role: UserRole.bidder,
      isBanned: true,
    });

    user1Token = createTestJWT(user1, UserRole.bidder);
    bannedToken = createTestJWT(bannedUser, UserRole.bidder);
  });

  // ============================================
  // 4.1.5 BOLA (Broken Object Level Authorization)
  // ============================================
  describe('4.1.5 BOLA Prevention', () => {
    it('TC-4.1.1-02: Cannot access other users profile details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/users/${bannedUser.id}/profile`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect([403, 404]).toContain(response.status);
    });

    it('TC-4.1.1-02: Cannot access other users payment history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/users/${bannedUser.id}/payments`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect([403, 404]).toContain(response.status);
    });

    it('TC-4.1.1-02: Cannot modify other users notification settings', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${bannedUser.id}/notifications`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ emailNotifications: false });

      expect([403, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 4.1.6 Banned User Access Control
  // ============================================
  describe('4.1.6 Banned User Access', () => {
    it('TC-2.5.1-25: Banned user cannot register for auction', async () => {
      const location = await prisma.location.findFirst();
      const auction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-001`,
          name: 'Banned Test',
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

      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid')
        .set('Authorization', `Bearer ${bannedToken}`)
        .send({ auctionId: auction.id });

      expect([403, 401]).toContain(response.status);
    });

    it('TC-4.1.8-01: Banned user cannot place bids', async () => {
      const location = await prisma.location.findFirst();
      const auction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-002`,
          name: 'Banned Bid Test',
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

      const response = await request(app.getHttpServer())
        .post('/api/manual-bid')
        .set('Authorization', `Bearer ${bannedToken}`)
        .send({ auctionId: auction.id, amount: 10000000 });

      expect([403, 401]).toContain(response.status);
    });

    it('TC-2.4.15-15: Banned user can still access public endpoints', async () => {
      // Auctions listing is public
      const response = await request(app.getHttpServer())
        .get('/api/auctions')
        .set('Authorization', `Bearer ${bannedToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data || response.body)).toBe(true);
    });
  });
});
