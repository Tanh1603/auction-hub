/**
 * Integration Tests for 3.12.3-4 List and Update Contracts
 * Test Case IDs: TC-3.12.3-01 to TC-3.12.4-02
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../../server/src/prisma/prisma.service';
import { AppModule } from '../../../server/src/app/app.module';
import {
  UserRole,
  AuctionStatus,
  ContractStatus,
} from '../../../server/generated';
import {
  createTestJWT,
  createTestUser,
  createDate,
  cleanupTestData,
  TestUser,
} from '../helpers/test-helpers';
import { Decimal } from '@prisma/client/runtime/library';

describe('3.12.3-4 List and Update Contracts', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let buyer: TestUser;
  let adminToken: string;
  let buyerToken: string;
  let contract: { id: string };
  let auction: { id: string };
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

    admin = await createTestUser(prisma, {
      email: 'list_admin@test.com',
      role: UserRole.admin,
    });
    buyer = await createTestUser(prisma, {
      email: 'list_buyer@test.com',
      role: UserRole.bidder,
    });

    adminToken = createTestJWT(admin, UserRole.admin);
    buyerToken = createTestJWT(buyer, UserRole.bidder);

    const location = await prisma.location.findFirst();
    auction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'List Test Auction',
        propertyOwner: { name: 'Test Owner' },
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
        assetDescription: 'Test Asset',
        assetAddress: '123 Test St',
        validCheckInBeforeStartMinutes: 30,
        validCheckInAfterStartMinutes: 15,
        assetWardId: location?.id || 1,
        assetProvinceId: location?.id || 1,
      },
    });

    const participant = await prisma.auctionParticipant.create({
      data: {
        userId: buyer.id,
        auctionId: auction.id,
        registeredAt: createDate(-18),
        confirmedAt: createDate(-15),
        depositPaidAt: createDate(-15),
        depositAmount: new Decimal(100000000),
      },
    });

    const winningBid = await prisma.auctionBid.create({
      data: {
        auctionId: auction.id,
        participantId: participant.id,
        amount: new Decimal(1200000000),
        bidAt: createDate(-11),
        bidType: 'manual',
        isWinningBid: true,
      },
    });

    contract = await prisma.contract.create({
      data: {
        auctionId: auction.id,
        winningBidId: winningBid.id,
        buyerUserId: buyer.id,
        createdBy: admin.id,
        price: new Decimal(1200000000),
        status: ContractStatus.draft,
      },
    });
  });

  // ============================================
  // 3.12.3 List Contracts
  // ============================================
  describe('3.12.3 List Contracts', () => {
    it('TC-3.12.3-01: Verify list user contracts', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/contracts')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      const contracts = response.body.data || response.body;
      expect(Array.isArray(contracts)).toBe(true);
      expect(contracts.length).toBeGreaterThan(0);
    });

    it('TC-3.12.3-02: Verify empty list when no contracts', async () => {
      const newUser = await createTestUser(prisma, {
        email: 'no_contracts@test.com',
        role: UserRole.bidder,
      });
      const newUserToken = createTestJWT(newUser, UserRole.bidder);

      const response = await request(app.getHttpServer())
        .get('/api/contracts')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      const contracts = response.body.data || response.body;
      expect(Array.isArray(contracts)).toBe(true);
      expect(contracts.length).toBe(0);
    });
  });

  // ============================================
  // 3.12.4 Update Contract
  // ============================================
  describe('3.12.4 Update Contract', () => {
    it('TC-3.12.4-01: Verify update contract status', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/contracts/${contract.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'signed' })
        .expect(200);

      const updated = await prisma.contract.findUnique({
        where: { id: contract.id },
      });
      expect(updated?.status).toBe('signed');
    });

    it('TC-3.12.4-02: Fail Bidder updating contract', async () => {
      await request(app.getHttpServer())
        .patch(`/api/contracts/${contract.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ status: 'signed' })
        .expect(403);
    });
  });

  // ============================================
  // Additional Contract Tests
  // ============================================
  describe('Contract Digital Signatures', () => {
    it('Verify buyer can sign contract', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/contracts/${contract.id}/sign`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ signature: 'buyer_signature_data' });

      expect([200, 201, 400]).toContain(response.status);
    });

    it('Fail unsigned user signing contract', async () => {
      const otherUser = await createTestUser(prisma, {
        email: 'unsigned@test.com',
        role: UserRole.bidder,
      });
      const otherToken = createTestJWT(otherUser, UserRole.bidder);

      const response = await request(app.getHttpServer())
        .post(`/api/contracts/${contract.id}/sign`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ signature: 'unauthorized_signature' });

      expect([403, 400]).toContain(response.status);
    });
  });
});
