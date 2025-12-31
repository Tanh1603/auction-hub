/**
 * Integration Tests for 3.3.2 Get Auction by ID
 * Test Case IDs: TC-3.3.2-01 to TC-3.3.2-06
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { AppModule } from '../../../server/src/app/app.module';
import { AuctionStatus } from '../../../server/generated';
import { createDate, cleanupTestData } from '../helpers/test-helpers';
import { Decimal } from '@prisma/client/runtime/library';

describe('3.3.2 Get Auction by ID', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testAuction: { id: string; code: string };
  const TEST_PREFIX = 'TEST-GET';

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
    const location = await prisma.location.findFirst();

    testAuction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Get Test Auction',
        propertyOwner: { name: 'Owner', email: 'owner@test.com' },
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
        assetDescription: 'Test Asset Description',
        assetAddress: 'Test Address',
        validCheckInBeforeStartMinutes: 30,
        validCheckInAfterStartMinutes: 15,
        assetWardId: location?.id || 1,
        assetProvinceId: location?.id || 1,
      },
    });
  });

  describe('Get by ID', () => {
    it('TC-3.3.2-01: Verify get auction by ID (public)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auctions/${testAuction.id}`)
        .expect(200);

      expect(response.body.id).toBe(testAuction.id);
      expect(response.body.code).toBe(testAuction.code);
    });

    it('TC-3.3.2-02: Verify response includes all fields', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auctions/${testAuction.id}`)
        .expect(200);

      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('startingPrice');
      expect(response.body).toHaveProperty('bidIncrement');
      expect(response.body).toHaveProperty('status');
    });

    it('TC-3.3.2-03: Return 404 for non-existent ID', async () => {
      await request(app.getHttpServer())
        .get('/api/auctions/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);
    });

    it('TC-3.3.2-04: Return 400 for invalid ID format', async () => {
      await request(app.getHttpServer())
        .get('/api/auctions/invalid-id')
        .expect(400);
    });
  });

  describe('Get by Code', () => {
    it('TC-3.3.2-05: Verify get auction by code', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auctions/code/${testAuction.code}`)
        .expect(200);

      expect(response.body.code).toBe(testAuction.code);
    });

    it('TC-3.3.2-06: Return 404 for non-existent code', async () => {
      await request(app.getHttpServer())
        .get('/api/auctions/code/NON-EXISTENT')
        .expect(404);
    });
  });
});
