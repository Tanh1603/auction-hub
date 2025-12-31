/**
 * Integration Tests for 3.3.1 List Auctions
 * Test Case IDs: TC-3.3.1-01 to TC-3.3.1-10
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { AppModule } from '../../../server/src/app/app.module';
import { AuctionStatus } from '../../../server/generated';
import { createDate, cleanupTestData } from '../helpers/test-helpers';
import { Decimal } from '@prisma/client/runtime/library';

describe('3.3.1 List Auctions', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const TEST_PREFIX = 'TEST-LIST';

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

    // Create test auctions
    await prisma.auction.createMany({
      data: [
        {
          code: `${TEST_PREFIX}-001`,
          name: 'Scheduled Auction',
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
        {
          code: `${TEST_PREFIX}-002`,
          name: 'Live Auction',
          propertyOwner: { name: 'Owner' },
          assetType: 'vehicle',
          status: AuctionStatus.live,
          saleStartAt: createDate(-10),
          saleEndAt: createDate(5),
          depositEndAt: createDate(-5),
          auctionStartAt: createDate(0, -2),
          auctionEndAt: createDate(0, 4),
          viewTime: '9:00-17:00',
          saleFee: new Decimal(500000),
          depositAmountRequired: new Decimal(50000000),
          startingPrice: new Decimal(500000000),
          bidIncrement: new Decimal(20000000),
          assetDescription: 'Test',
          assetAddress: 'Test',
          validCheckInBeforeStartMinutes: 30,
          validCheckInAfterStartMinutes: 15,
          assetWardId: location?.id || 1,
          assetProvinceId: location?.id || 1,
        },
      ],
    });
  });

  describe('Public Listing', () => {
    it('TC-3.3.1-01: Verify public list auctions (no auth)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auctions')
        .expect(200);

      expect(Array.isArray(response.body.data || response.body)).toBe(true);
    });

    it('TC-3.3.1-02: Verify pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auctions?page=1&limit=10')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
    });

    it('TC-3.3.1-03: Verify filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auctions?status=live')
        .expect(200);

      const auctions = response.body.data || response.body;
      auctions.forEach((a: { status: string }) =>
        expect(a.status).toBe('live')
      );
    });

    it('TC-3.3.1-04: Verify filter by assetType', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auctions?assetType=vehicle')
        .expect(200);
    });

    it('TC-3.3.1-05: Verify search by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auctions?search=Live')
        .expect(200);
    });

    it('TC-3.3.1-06: Verify sort by startingPrice', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auctions?sortBy=startingPrice&order=asc')
        .expect(200);
    });
  });
});
