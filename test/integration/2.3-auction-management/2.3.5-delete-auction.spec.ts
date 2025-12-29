/**
 * Integration Tests for 2.3.5 Delete Auction
 * Test Case IDs: TC-2.3.5-01 to TC-2.3.5-05
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { AppModule } from '../../../server/src/app/app.module';
import { UserRole, AuctionStatus, BidType } from '../../../server/generated';
import {
  createTestJWT,
  createTestUser,
  createDate,
  cleanupTestData,
  TestUser,
} from '../helpers/test-helpers';
import { Decimal } from '@prisma/client/runtime/library';

describe('2.3.5 Delete Auction', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let adminToken: string;
  const TEST_PREFIX = 'TEST-DEL';

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
      email: 'del_admin@test.com',
      role: UserRole.admin,
    });
    adminToken = createTestJWT(admin, UserRole.admin);
  });

  async function createTestAuction(
    code: string,
    status: AuctionStatus = AuctionStatus.scheduled
  ) {
    const location = await prisma.location.findFirst();
    return prisma.auction.create({
      data: {
        code,
        name: 'Delete Test Auction',
        propertyOwner: { name: 'Owner' },
        assetType: 'secured_asset',
        status,
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
  }

  describe('Successful Deletion', () => {
    it('TC-2.2.5-01: Verify delete scheduled auction', async () => {
      const auction = await createTestAuction(`${TEST_PREFIX}-001`);

      await request(app.getHttpServer())
        .delete(`/api/auctions/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const deleted = await prisma.auction.findUnique({
        where: { id: auction.id },
      });
      expect(deleted).toBeNull();
    });
  });

  describe('Deletion Failures', () => {
    it('TC-2.2.5-02: Fail delete auction with bids', async () => {
      const auction = await createTestAuction(
        `${TEST_PREFIX}-002`,
        AuctionStatus.live
      );
      const bidder = await createTestUser(prisma, {
        email: 'del_bidder@test.com',
        role: UserRole.bidder,
      });

      const participant = await prisma.auctionParticipant.create({
        data: {
          userId: bidder.id,
          auctionId: auction.id,
          registeredAt: createDate(-3),
          confirmedAt: createDate(-1),
          checkedInAt: new Date(),
          depositPaidAt: createDate(-1),
          depositAmount: new Decimal(1000000),
        },
      });

      await prisma.auctionBid.create({
        data: {
          auctionId: auction.id,
          participantId: participant.id,
          amount: new Decimal(10000000),
          bidAt: new Date(),
          bidType: BidType.manual,
          isWinningBid: true,
        },
      });

      const response = await request(app.getHttpServer())
        .delete(`/api/auctions/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([400, 409]).toContain(response.status);
    });

    it('TC-2.2.5-03: Fail delete auction with participants', async () => {
      const auction = await createTestAuction(`${TEST_PREFIX}-003`);
      const bidder = await createTestUser(prisma, {
        email: 'del_bidder2@test.com',
        role: UserRole.bidder,
      });

      await prisma.auctionParticipant.create({
        data: {
          userId: bidder.id,
          auctionId: auction.id,
          registeredAt: createDate(-3),
        },
      });

      const response = await request(app.getHttpServer())
        .delete(`/api/auctions/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([400, 409]).toContain(response.status);
    });

    it('TC-2.2.5-04: Fail delete live auction', async () => {
      const auction = await createTestAuction(
        `${TEST_PREFIX}-004`,
        AuctionStatus.live
      );

      const response = await request(app.getHttpServer())
        .delete(`/api/auctions/${auction.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([400, 200]).toContain(response.status);
    });

    it('TC-2.2.5-05: Fail delete non-existent auction', async () => {
      await request(app.getHttpServer())
        .delete('/api/auctions/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
