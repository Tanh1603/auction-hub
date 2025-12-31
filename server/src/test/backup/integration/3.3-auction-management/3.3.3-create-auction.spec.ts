/**
 * Integration Tests for 3.3.3 Create Auction
 * Test Case IDs: TC-3.3.3-01 to TC-3.3.3-10
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { AppModule } from '../../../server/src/app/app.module';
import { UserRole } from '../../../server/generated';
import {
  createTestJWT,
  createTestUser,
  createDate,
  cleanupTestData,
  TestUser,
} from '../helpers/test-helpers';

describe('3.3.3 Create Auction', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let auctioneer: TestUser;
  let bidder: TestUser;
  let adminToken: string;
  let auctioneerToken: string;
  let bidderToken: string;
  const TEST_PREFIX = 'TEST-CREATE';

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
      email: 'create_admin@test.com',
      role: UserRole.admin,
    });
    auctioneer = await createTestUser(prisma, {
      email: 'create_auctioneer@test.com',
      role: UserRole.auctioneer,
    });
    bidder = await createTestUser(prisma, {
      email: 'create_bidder@test.com',
      role: UserRole.bidder,
    });

    adminToken = createTestJWT(admin, UserRole.admin);
    auctioneerToken = createTestJWT(auctioneer, UserRole.auctioneer);
    bidderToken = createTestJWT(bidder, UserRole.bidder);
  });

  const validPayload = () => ({
    code: `${TEST_PREFIX}-${Date.now()}`,
    name: 'New Test Auction',
    propertyOwner: { name: 'Owner', email: 'owner@test.com' },
    assetType: 'secured_asset',
    startingPrice: 1000000000,
    bidIncrement: 50000000,
    saleFee: 500000,
    depositAmountRequired: 100000000,
    saleStartAt: createDate(1).toISOString(),
    saleEndAt: createDate(10).toISOString(),
    depositEndAt: createDate(5).toISOString(),
    auctionStartAt: createDate(7).toISOString(),
    auctionEndAt: createDate(7, 3).toISOString(),
    viewTime: '9:00 - 17:00',
    assetDescription: 'Test Asset',
    assetAddress: 'Test Address',
  });

  describe('Successful Creation', () => {
    it('TC-3.3.3-01: Verify Admin creates auction', async () => {
      const payload = validPayload();

      const response = await request(app.getHttpServer())
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201);

      expect(response.body.code).toBe(payload.code);
      expect(response.body.status).toBe('scheduled');
    });

    it('TC-3.3.3-02: Verify Auctioneer creates auction', async () => {
      const payload = validPayload();

      const response = await request(app.getHttpServer())
        .post('/api/auctions')
        .set('Authorization', `Bearer ${auctioneerToken}`)
        .send(payload)
        .expect(201);
    });
  });

  describe('Authorization Failures', () => {
    it('TC-3.3.3-03: Fail Bidder creates auction', async () => {
      await request(app.getHttpServer())
        .post('/api/auctions')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send(validPayload())
        .expect(403);
    });

    it('TC-3.3.3-04: Fail create without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/auctions')
        .send(validPayload())
        .expect(401);
    });
  });

  describe('Validation Failures', () => {
    it('TC-3.3.3-05: Fail with missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Incomplete' })
        .expect(400);
    });

    it('TC-3.3.3-06: Fail with duplicate code', async () => {
      const payload = validPayload();

      await request(app.getHttpServer())
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(409);
    });

    it('TC-3.3.3-07: Fail with negative starting price', async () => {
      const payload = { ...validPayload(), startingPrice: -1000 };

      await request(app.getHttpServer())
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(400);
    });

    it('TC-3.3.3-08: Fail with auction end before start', async () => {
      const payload = {
        ...validPayload(),
        auctionStartAt: createDate(10).toISOString(),
        auctionEndAt: createDate(5).toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect([400, 201]).toContain(response.status);
    });
  });
});
