/**
 * Integration tests for Refund & Disqualification System
 * Tests: TC-3.4.14-01 through TC-3.4.15-17
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from '../../common/services/email.service';

// Import modules
import { RegisterToBidModule } from '../../feature/bidding/register-to-bid/register-to-bid.module';
import { CommonModule } from '../../common/common.module';

// Types and enums
import { AuctionStatus, User, Auction } from '../../../generated';
import {
  RefundStatus,
  DisqualificationReason,
} from '../../feature/bidding/register-to-bid/services/refund.service';

describe('Refund Flow Integration Tests (TC-3.4.14, TC-3.4.15)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  // Test data
  let testUsers: {
    bidder1: User;
    bidder2: User;
    bidder3: User; // This one will be disqualified
    winner: User;
    admin: User;
  };

  let testAuction: Auction;
  let authTokens: {
    bidder1: string;
    bidder2: string;
    bidder3: string;
    winner: string;
    admin: string;
  };

  let participantIds: {
    eligible: string;
    disqualified: string;
    winner: string;
    lateWithdrawal: string;
    noDeposit: string;
  };

  // Helper function to create JWT tokens for testing
  const createTestJWT = (user: User, role = 'bidder'): string => {
    const payload = {
      sub: user.id,
      email: user.email,
      full_name: user.fullName,
      aud: 'authenticated',
      role: role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    };

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not found');
    }

    return jwt.sign(payload, jwtSecret, { algorithm: 'HS256' });
  };

  // Helper to create dates relative to now
  const createDate = (daysOffset: number, hoursOffset = 0): Date => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    date.setHours(date.getHours() + hoursOffset);
    return date;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: process.env.JWT_SECRET,
              DATABASE_URL: process.env.DATABASE_URL,
              EMAIL_PROVIDER: 'smtp',
              SMTP_HOST: 'smtp.ethereal.email',
              SMTP_PORT: '587',
            }),
          ],
        }),
        RegisterToBidModule,
        CommonModule,
      ],
    })
      .overrideProvider(EmailService)
      .useValue({
        sendAuctionResultEmail: jest.fn(),
        sendDepositPaymentRequestEmail: jest.fn(),
        sendDepositConfirmedEmail: jest.fn(),
        // Add mock for all email methods
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    // Clean up test data
    await prismaService.auctionBid.deleteMany({});
    await prismaService.auctionParticipant.deleteMany({});
    await prismaService.payment.deleteMany({});

    // Create test users
    const timestamp = Date.now();
    testUsers = {
      bidder1: await prismaService.user.create({
        data: {
          email: `bidder1_refund_${timestamp}@test.com`,
          fullName: 'Eligible Bidder',
          role: 'bidder',
          password: 'hashedpassword',
          isVerified: true,
        },
      }),
      bidder2: await prismaService.user.create({
        data: {
          email: `bidder2_refund_${timestamp}@test.com`,
          fullName: 'Late Withdrawal Bidder',
          role: 'bidder',
          password: 'hashedpassword',
          isVerified: true,
        },
      }),
      bidder3: await prismaService.user.create({
        data: {
          email: `bidder3_refund_${timestamp}@test.com`,
          fullName: 'Disqualified Bidder',
          role: 'bidder',
          password: 'hashedpassword',
          isVerified: true,
        },
      }),
      winner: await prismaService.user.create({
        data: {
          email: `winner_refund_${timestamp}@test.com`,
          fullName: 'Auction Winner',
          role: 'bidder',
          password: 'hashedpassword',
          isVerified: true,
        },
      }),
      admin: await prismaService.user.create({
        data: {
          email: `admin_refund_${timestamp}@test.com`,
          fullName: 'Test Admin',
          role: 'admin',
          password: 'hashedpassword',
          isVerified: true,
        },
      }),
    };

    // Create auth tokens
    authTokens = {
      bidder1: createTestJWT(testUsers.bidder1, 'bidder'),
      bidder2: createTestJWT(testUsers.bidder2, 'bidder'),
      bidder3: createTestJWT(testUsers.bidder3, 'bidder'),
      winner: createTestJWT(testUsers.winner, 'bidder'),
      admin: createTestJWT(testUsers.admin, 'admin'),
    };

    // Create test auction (ended)
    testAuction = await prismaService.auction.create({
      data: {
        code: `REFUND_TEST_${timestamp}`,
        name: 'Refund Test Auction',
        status: AuctionStatus.ended,
        startingPrice: 1000000000,
        bidIncrement: 50000000,
        depositAmountRequired: 50000000,
        auctionStartAt: createDate(-2),
        auctionEndAt: createDate(-1), // Ended yesterday
        saleStartAt: createDate(-7),
        saleEndAt: createDate(-3), // Withdrawal deadline was 3 days ago
        createdById: testUsers.admin.id,
      },
    });

    // Create participants with various states
    // 1. Eligible participant (withdrew before deadline)
    const eligibleParticipant = await prismaService.auctionParticipant.create({
      data: {
        userId: testUsers.bidder1.id,
        auctionId: testAuction.id,
        depositAmount: 50000000,
        depositPaidAt: createDate(-6),
        documentsVerifiedAt: createDate(-6),
        confirmedAt: createDate(-5),
        withdrawnAt: createDate(-4), // Withdrew before saleEndAt (-3)
        isDisqualified: false,
      },
    });
    participantIds = { ...participantIds, eligible: eligibleParticipant.id };

    // 2. Late withdrawal participant (withdrew after deadline)
    const lateParticipant = await prismaService.auctionParticipant.create({
      data: {
        userId: testUsers.bidder2.id,
        auctionId: testAuction.id,
        depositAmount: 50000000,
        depositPaidAt: createDate(-6),
        documentsVerifiedAt: createDate(-6),
        confirmedAt: createDate(-5),
        withdrawnAt: createDate(-2), // Withdrew after saleEndAt (-3)
        isDisqualified: false,
      },
    });
    participantIds = { ...participantIds, lateWithdrawal: lateParticipant.id };

    // 3. Disqualified participant
    const disqualifiedParticipant =
      await prismaService.auctionParticipant.create({
        data: {
          userId: testUsers.bidder3.id,
          auctionId: testAuction.id,
          depositAmount: 50000000,
          depositPaidAt: createDate(-6),
          documentsVerifiedAt: createDate(-6),
          confirmedAt: createDate(-5),
          checkedInAt: createDate(-2),
          isDisqualified: true,
          disqualifiedAt: createDate(-1),
          disqualifiedReason: DisqualificationReason.PRICE_RIGGING,
          refundStatus: RefundStatus.FORFEITED,
        },
      });
    participantIds = {
      ...participantIds,
      disqualified: disqualifiedParticipant.id,
    };

    // 4. Winner participant (has winning bid)
    const winnerParticipant = await prismaService.auctionParticipant.create({
      data: {
        userId: testUsers.winner.id,
        auctionId: testAuction.id,
        depositAmount: 50000000,
        depositPaidAt: createDate(-6),
        documentsVerifiedAt: createDate(-6),
        confirmedAt: createDate(-5),
        checkedInAt: createDate(-2),
        isDisqualified: false,
      },
    });
    participantIds = { ...participantIds, winner: winnerParticipant.id };

    // Create winning bid for winner
    await prismaService.auctionBid.create({
      data: {
        auctionId: testAuction.id,
        participantId: winnerParticipant.id,
        amount: 1200000000,
        isWinningBid: true,
        bidType: 'manual',
      },
    });
  });

  afterAll(async () => {
    // Clean up
    await prismaService.auctionBid.deleteMany({});
    await prismaService.auctionParticipant.deleteMany({});
    await prismaService.auction.deleteMany({
      where: { code: { startsWith: 'REFUND_TEST_' } },
    });
    await prismaService.user.deleteMany({
      where: { email: { contains: '_refund_' } },
    });
    await app.close();
  });

  // ============ TC-3.4.14: User Refund Request Tests ============

  describe('TC-3.4.14 - User Refund Request', () => {
    it('TC-3.4.14-01: Eligible bidder can request refund after valid withdrawal', async () => {
      const response = await request(app.getHttpServer())
        .post('/register-to-bid/request-refund')
        .set('Authorization', `Bearer ${authTokens.bidder1}`)
        .send({
          auctionId: testAuction.id,
          reason: 'Changed my mind',
        });

      expect(response.status).toBe(200);
      expect(response.body.refund.status).toBe(RefundStatus.PENDING);
      expect(response.body.refund.requestedAt).toBeDefined();
      expect(response.body.eligibility.eligible).toBe(true);
    });

    it('TC-3.4.14-02: Disqualified participant cannot request refund', async () => {
      const response = await request(app.getHttpServer())
        .post('/register-to-bid/request-refund')
        .set('Authorization', `Bearer ${authTokens.bidder3}`)
        .send({
          auctionId: testAuction.id,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Not eligible for refund');
    });

    it('TC-3.4.14-03: Winner cannot request refund', async () => {
      const response = await request(app.getHttpServer())
        .post('/register-to-bid/request-refund')
        .set('Authorization', `Bearer ${authTokens.winner}`)
        .send({
          auctionId: testAuction.id,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Winner must complete purchase');
    });

    it('TC-3.4.14-04: Late withdrawal cannot request refund', async () => {
      const response = await request(app.getHttpServer())
        .post('/register-to-bid/request-refund')
        .set('Authorization', `Bearer ${authTokens.bidder2}`)
        .send({
          auctionId: testAuction.id,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('after deadline');
    });

    it('TC-3.4.14-09: Unauthenticated request returns 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/register-to-bid/request-refund')
        .send({
          auctionId: testAuction.id,
        });

      expect(response.status).toBe(401);
    });
  });

  // ============ TC-3.4.15: Admin Refund Management Tests ============

  describe('TC-3.4.15 - Admin Refund Management', () => {
    beforeEach(async () => {
      // Set up a pending refund request for eligible bidder
      await prismaService.auctionParticipant.update({
        where: { id: participantIds.eligible },
        data: {
          refundStatus: RefundStatus.PENDING,
          refundRequestedAt: new Date(),
        },
      });
    });

    it('TC-3.4.15-01: Admin can list refund requests with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/register-to-bid/admin/refunds')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authTokens.admin}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.currentPage).toBe(1);
    });

    it('TC-3.4.15-02: Admin can filter refunds by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/register-to-bid/admin/refunds')
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${authTokens.admin}`);

      expect(response.status).toBe(200);
      // All returned items should have pending status
      response.body.data.forEach((item: { refund: { status: string } }) => {
        expect(item.refund.status).toBe(RefundStatus.PENDING);
      });
    });

    it('TC-3.4.15-04: Admin can get refund detail', async () => {
      const response = await request(app.getHttpServer())
        .get(`/register-to-bid/admin/refunds/${participantIds.eligible}`)
        .set('Authorization', `Bearer ${authTokens.admin}`);

      expect(response.status).toBe(200);
      expect(response.body.participant.id).toBe(participantIds.eligible);
      expect(response.body.eligibility).toBeDefined();
      expect(response.body.disqualification).toBeDefined();
    });

    it('TC-3.4.15-05: Admin can approve pending refund', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/register-to-bid/admin/refunds/${participantIds.eligible}`)
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .send({ action: 'approve' });

      expect(response.status).toBe(200);
      expect(response.body.refund.status).toBe(RefundStatus.APPROVED);
    });

    it('TC-3.4.15-06: Cannot approve non-pending refund', async () => {
      // First approve the refund
      await prismaService.auctionParticipant.update({
        where: { id: participantIds.eligible },
        data: { refundStatus: RefundStatus.APPROVED },
      });

      const response = await request(app.getHttpServer())
        .patch(`/register-to-bid/admin/refunds/${participantIds.eligible}`)
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .send({ action: 'approve' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('pending');
    });

    it('TC-3.4.15-07: Admin can reject refund with reason', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/register-to-bid/admin/refunds/${participantIds.eligible}`)
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .send({ action: 'reject', reason: 'Violated terms' });

      expect(response.status).toBe(200);
      expect(response.body.refund.status).toBe(RefundStatus.REJECTED);
    });

    it('TC-3.4.15-08: Cannot reject refund without reason', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/register-to-bid/admin/refunds/${participantIds.eligible}`)
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .send({ action: 'reject' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Reason is required');
    });

    it('TC-3.4.15-14: Bidder cannot access admin refund endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/register-to-bid/admin/refunds')
        .set('Authorization', `Bearer ${authTokens.bidder1}`);

      expect(response.status).toBe(403);
    });

    it('TC-3.4.15-16: Disqualify participant sets forfeited status', async () => {
      // Create a new participant to disqualify
      const newParticipant = await prismaService.auctionParticipant.create({
        data: {
          userId: testUsers.bidder1.id,
          auctionId: testAuction.id,
          depositAmount: 50000000,
          depositPaidAt: new Date(),
          isDisqualified: false,
        },
      });

      // Call the service directly since disqualify is internal
      const { RefundService } = await import(
        '../../feature/bidding/register-to-bid/services/refund.service'
      );
      const refundService = app.get(RefundService);

      await refundService.disqualifyParticipant(
        newParticipant.id,
        DisqualificationReason.PAYMENT_DEFAULT,
        testUsers.admin.id
      );

      const updated = await prismaService.auctionParticipant.findUnique({
        where: { id: newParticipant.id },
      });

      expect(updated?.isDisqualified).toBe(true);
      expect(updated?.refundStatus).toBe(RefundStatus.FORFEITED);
      expect(updated?.disqualifiedReason).toBe(
        DisqualificationReason.PAYMENT_DEFAULT
      );
    });
  });
});
