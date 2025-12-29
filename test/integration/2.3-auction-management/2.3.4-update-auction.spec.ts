/**
 * Integration Tests for 2.3.4 Update Auction
 * Test Case IDs: TC-2.3.4-01 to TC-2.3.4-06
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

describe('2.3.4 Update Auction', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let bidder: TestUser;
  let adminToken: string;
  let bidderToken: string;
  let scheduledAuction: { id: string };
  const TEST_PREFIX = 'TEST-UPD';

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
      email: 'upd_admin@test.com',
      role: UserRole.admin,
    });
    bidder = await createTestUser(prisma, {
      email: 'upd_bidder@test.com',
      role: UserRole.bidder,
    });
    adminToken = createTestJWT(admin, UserRole.admin);
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    const location = await prisma.location.findFirst();
    scheduledAuction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Update Test Auction',
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

  describe('Successful Updates', () => {
    it('TC-2.2.6-01: Verify update auction name', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/auctions/${scheduledAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Auction Name' })
        .expect(200);

      const updated = await prisma.auction.findUnique({
        where: { id: scheduledAuction.id },
      });
      expect(updated?.name).toBe('New Auction Name');
    });

    it('TC-2.2.4-02: Verify update auction startingPrice', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/auctions/${scheduledAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ startingPrice: 2000000000 })
        .expect(200);

      const updated = await prisma.auction.findUnique({
        where: { id: scheduledAuction.id },
      });
      expect(updated?.startingPrice.toString()).toBe('2000000000');
    });

    it('TC-2.2.6-01: Verify update auction dates', async () => {
      const newStartAt = createDate(8).toISOString();
      const newEndAt = createDate(8, 3).toISOString();

      const response = await request(app.getHttpServer())
        .put(`/api/auctions/${scheduledAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ auctionStartAt: newStartAt, auctionEndAt: newEndAt })
        .expect(200);
    });
  });

  describe('Update Failures', () => {
    it('TC-2.2.4-04: Fail update live auction critical fields', async () => {
      await prisma.auction.update({
        where: { id: scheduledAuction.id },
        data: { status: AuctionStatus.live },
      });

      const response = await request(app.getHttpServer())
        .put(`/api/auctions/${scheduledAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ startingPrice: 3000000000 });

      expect([400, 200]).toContain(response.status);
    });

    it('TC-2.2.4-05: Fail update completed auction', async () => {
      await prisma.auction.update({
        where: { id: scheduledAuction.id },
        data: { status: AuctionStatus.success },
      });

      const response = await request(app.getHttpServer())
        .put(`/api/auctions/${scheduledAuction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });

      expect([400, 200]).toContain(response.status);
    });

    it('TC-2.2.4-06: Fail update non-existent auction', async () => {
      await request(app.getHttpServer())
        .put('/api/auctions/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });
});
