/**
 * Integration Tests for 4.1.1 IDOR Vulnerabilities
 * Test Case IDs: TC-4.1.1-01 to TC-4.1.1-05
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

describe('4.1.1 IDOR Vulnerabilities', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user1: TestUser;
  let user2: TestUser;
  let user1Token: string;
  let user2Token: string;
  const TEST_PREFIX = 'TEST-IDOR';

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

    user1 = await createTestUser(prisma, {
      email: 'idor_user1@test.com',
      role: UserRole.bidder,
    });
    user2 = await createTestUser(prisma, {
      email: 'idor_user2@test.com',
      role: UserRole.bidder,
    });
    user1Token = createTestJWT(user1, UserRole.bidder);
    user2Token = createTestJWT(user2, UserRole.bidder);
  });

  describe('User Data IDOR', () => {
    it('TC-4.1.1-01: User cannot access another user data via ID manipulation', async () => {
      // Attempt to access user2's data with user1's token
      const response = await request(app.getHttpServer())
        .get(`/api/users/${user2.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      // Should either 403 or 404 (not reveal existence)
      expect([403, 404]).toContain(response.status);
    });

    it('TC-4.1.1-02: User cannot modify another user profile', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/users/${user2.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ fullName: 'Hacked Name' });

      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Registration IDOR', () => {
    it('TC-4.1.1-03: User cannot withdraw another users registration', async () => {
      const location = await prisma.location.findFirst();
      const auction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-001`,
          name: 'IDOR Test Auction',
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
          userId: user2.id,
          auctionId: auction.id,
          registeredAt: new Date(),
        },
      });

      // User1 tries to withdraw user2's registration
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/withdraw')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ auctionId: auction.id });

      // Should fail - not user1's registration
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Contract IDOR', () => {
    it('TC-4.1.1-04: Non-party cannot access contract', async () => {
      const location = await prisma.location.findFirst();
      const auction = await prisma.auction.create({
        data: {
          code: `${TEST_PREFIX}-002`,
          name: 'Contract IDOR Test',
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

      const auctioneer = await createTestUser(prisma, {
        email: 'idor_auctioneer@test.com',
        role: UserRole.auctioneer,
      });

      const contract = await prisma.contract.create({
        data: {
          auctionId: auction.id,
          buyerUserId: user2.id,
          sellerUserId: auctioneer.id,
          price: new Decimal(1200000000),
          status: 'draft',
        },
      });

      // User1 (not buyer or seller) tries to access contract
      const response = await request(app.getHttpServer())
        .get(`/api/contracts/${contract.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(403);
    });
  });
});
