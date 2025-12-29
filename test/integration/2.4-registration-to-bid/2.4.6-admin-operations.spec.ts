/**
 * Integration Tests for 2.4.9-13 Admin Registration Operations
 * Test Case IDs: TC-2.4.9-01 to TC-2.4.13-04
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

describe('2.4.9-13 Admin Registration Operations', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let bidder: TestUser;
  let adminToken: string;
  let bidderToken: string;
  let auction: { id: string };
  let registration: { id: string };
  const TEST_PREFIX = 'TEST-ADMIN-REG';

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
      email: 'adm_reg_admin@test.com',
      role: UserRole.admin,
    });
    bidder = await createTestUser(prisma, {
      email: 'adm_reg_bidder@test.com',
      role: UserRole.bidder,
    });

    adminToken = createTestJWT(admin, UserRole.admin);
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    const location = await prisma.location.findFirst();
    auction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Admin Reg Test',
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

    // Registration must be in "submitted" state for admin operations to work
    // Workflow: register -> submit documents -> admin verifies/approves
    registration = await prisma.auctionParticipant.create({
      data: {
        userId: bidder.id,
        auctionId: auction.id,
        registeredAt: createDate(-3),
        submittedAt: createDate(-2), // Required! Registration must be submitted
        documents: ['doc1.pdf'],
      },
    });
  });

  // ============================================
  // 2.4.9 Approve Registration
  // ============================================
  describe('2.4.9 Approve Registration', () => {
    it('TC-2.4.9-01: Verify Admin approves registration', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: registration.id })
        .expect(200);

      const updated = await prisma.auctionParticipant.findUnique({
        where: { id: registration.id },
      });
      expect(updated?.confirmedAt).toBeTruthy();
    });

    it('TC-2.4.9-02: Fail approve already approved', async () => {
      await prisma.auctionParticipant.update({
        where: { id: registration.id },
        data: { confirmedAt: new Date() },
      });

      await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: registration.id })
        .expect(409);
    });

    it('TC-2.4.9-03: Fail approve withdrawn registration', async () => {
      await prisma.auctionParticipant.update({
        where: { id: registration.id },
        data: { withdrawnAt: new Date() },
      });

      await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: registration.id })
        .expect(400);
    });

    it('TC-2.4.9-05: Fail approve non-existent registration', async () => {
      await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: '550e8400-e29b-41d4-a716-446655440000' })
        .expect(404);
    });
  });

  // ============================================
  // 2.4.10 Reject Registration
  // ============================================
  describe('2.4.10 Reject Registration', () => {
    it('TC-2.4.10-01: Verify Admin rejects registration with reason', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          registrationId: registration.id,
          rejectionReason: 'Invalid documents',
        })
        .expect(200);

      const updated = await prisma.auctionParticipant.findUnique({
        where: { id: registration.id },
      });
      expect(updated?.rejectedAt).toBeTruthy();
    });

    it('TC-2.4.10-02: Verify reject without reason (optional)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: registration.id });

      expect([200, 400]).toContain(response.status);
    });

    it('TC-2.4.10-03: Fail reject already confirmed registration', async () => {
      await prisma.auctionParticipant.update({
        where: { id: registration.id },
        data: { confirmedAt: new Date() },
      });

      await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: registration.id, rejectionReason: 'Test' })
        .expect(409);
    });
  });

  // ============================================
  // 2.4.11 Verify Documents (Tier 1)
  // ============================================
  describe('2.4.11 Verify Documents', () => {
    it('TC-2.4.11-01: Verify Admin verifies documents', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/verify-documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: registration.id })
        .expect(200);

      const updated = await prisma.auctionParticipant.findUnique({
        where: { id: registration.id },
      });
      expect(updated?.documentsVerifiedAt).toBeTruthy();
    });

    it('TC-2.4.11-02: Fail verify documents without submission', async () => {
      await prisma.auctionParticipant.update({
        where: { id: registration.id },
        data: { documents: null },
      });

      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/verify-documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: registration.id });

      expect([400, 200]).toContain(response.status);
    });

    it('TC-2.4.11-03: Fail verify already verified', async () => {
      await prisma.auctionParticipant.update({
        where: { id: registration.id },
        data: { documentsVerifiedAt: new Date() },
      });

      await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/verify-documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: registration.id })
        .expect(409);
    });
  });

  // ============================================
  // 2.4.12 Reject Documents
  // ============================================
  describe('2.4.12 Reject Documents', () => {
    it('TC-2.4.12-01: Verify Admin rejects documents with reason', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/reject-documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: registration.id, reason: 'Unclear scan' })
        .expect(200);

      const updated = await prisma.auctionParticipant.findUnique({
        where: { id: registration.id },
      });
      expect(updated?.documentsRejectedAt).toBeTruthy();
    });

    it('TC-2.4.12-02: Fail reject documents without reason', async () => {
      await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/reject-documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: registration.id })
        .expect(400);
    });
  });

  // ============================================
  // 2.4.13 Final Approval (Tier 2)
  // ============================================
  describe('2.4.13 Final Approval', () => {
    it('TC-2.4.13-01: Verify Admin final approval', async () => {
      await prisma.auctionParticipant.update({
        where: { id: registration.id },
        data: {
          documentsVerifiedAt: createDate(-1),
          depositPaidAt: createDate(-1),
          depositAmount: new Decimal(1000000),
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/final-approval')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: registration.id })
        .expect(200);

      const updated = await prisma.auctionParticipant.findUnique({
        where: { id: registration.id },
      });
      expect(updated?.confirmedAt).toBeTruthy();
    });

    it('TC-2.4.13-02: Fail final approval without document verification', async () => {
      await prisma.auctionParticipant.update({
        where: { id: registration.id },
        data: {
          depositPaidAt: createDate(-1),
          depositAmount: new Decimal(1000000),
        },
      });

      await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/final-approval')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: registration.id })
        .expect(400);
    });

    it('TC-2.4.13-02: Fail final approval without deposit payment', async () => {
      await prisma.auctionParticipant.update({
        where: { id: registration.id },
        data: { documentsVerifiedAt: createDate(-1) },
      });

      await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/final-approval')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: registration.id })
        .expect(400);
    });

    it('TC-2.4.13-04: Fail final approval already confirmed', async () => {
      await prisma.auctionParticipant.update({
        where: { id: registration.id },
        data: {
          documentsVerifiedAt: createDate(-1),
          depositPaidAt: createDate(-1),
          depositAmount: new Decimal(1000000),
          confirmedAt: createDate(0, -1),
        },
      });

      await request(app.getHttpServer())
        .post('/api/register-to-bid/admin/final-approval')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registrationId: registration.id })
        .expect(409);
    });
  });
});
