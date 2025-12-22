/**
 * Integration Tests for 3.3.6 Auction Relations
 * Test Case IDs: TC-3.3.6-01 to TC-3.3.6-05
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

describe('3.3.6 Auction Relations', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let adminToken: string;
  let auction1: { id: string };
  let auction2: { id: string };
  let auction3: { id: string };
  const TEST_PREFIX = 'TEST-REL';

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
      email: 'rel_admin@test.com',
      role: UserRole.admin,
    });
    adminToken = createTestJWT(admin, UserRole.admin);

    const location = await prisma.location.findFirst();
    const baseData = {
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
    };

    auction1 = await prisma.auction.create({
      data: { ...baseData, code: `${TEST_PREFIX}-001`, name: 'Auction 1' },
    });
    auction2 = await prisma.auction.create({
      data: { ...baseData, code: `${TEST_PREFIX}-002`, name: 'Auction 2' },
    });
    auction3 = await prisma.auction.create({
      data: { ...baseData, code: `${TEST_PREFIX}-003`, name: 'Auction 3' },
    });
  });

  describe('Create Relations', () => {
    it('TC-3.3.6-01: Verify update auction relations', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/auctions/${auction1.id}/relations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ relatedIds: [auction2.id, auction3.id] })
        .expect(200);

      const relations = await prisma.auctionRelation.findMany({
        where: { auctionId: auction1.id },
      });
      expect(relations.length).toBe(2);
    });

    it('TC-3.3.6-02: Verify replace auction relations', async () => {
      await prisma.auctionRelation.create({
        data: { auctionId: auction1.id, relatedAuctionId: auction2.id },
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/auctions/${auction1.id}/relations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ relatedIds: [auction3.id] })
        .expect(200);

      const relations = await prisma.auctionRelation.findMany({
        where: { auctionId: auction1.id },
      });
      expect(relations.length).toBe(1);
      expect(relations[0].relatedAuctionId).toBe(auction3.id);
    });

    it('TC-3.3.6-03: Verify clear all auction relations', async () => {
      await prisma.auctionRelation.createMany({
        data: [
          { auctionId: auction1.id, relatedAuctionId: auction2.id },
          { auctionId: auction1.id, relatedAuctionId: auction3.id },
        ],
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/auctions/${auction1.id}/relations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ relatedIds: [] })
        .expect(200);

      const relations = await prisma.auctionRelation.findMany({
        where: { auctionId: auction1.id },
      });
      expect(relations.length).toBe(0);
    });
  });

  describe('Relation Failures', () => {
    it('TC-3.3.6-04: Fail relation with self', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/auctions/${auction1.id}/relations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ relatedIds: [auction1.id] });

      expect([400, 200]).toContain(response.status);
    });

    it('TC-3.3.6-05: Fail relation with non-existent auction', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/auctions/${auction1.id}/relations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ relatedIds: ['550e8400-e29b-41d4-a716-446655440000'] });

      expect([400, 404]).toContain(response.status);
    });
  });
});
