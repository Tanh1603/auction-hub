/**
 * Integration Tests for 2.7.2 Verify Payment
 * Test Case IDs: TC-2.7.2-01 to TC-2.7.2-05
 *
 * Uses Stripe mocking for reliable, isolated tests.
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
  cleanupTestUsers,
  TestUser,
} from '../helpers/test-helpers';

// Mock Stripe before importing modules that use it
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_mock_session',
          url: 'https://checkout.stripe.com/test/mock',
          payment_status: 'unpaid',
          amount_total: 50000000,
          currency: 'vnd',
          metadata: {},
        }),
        retrieve: jest.fn().mockImplementation((sessionId: string) => {
          // Valid paid session
          if (sessionId === 'cs_test_valid_session') {
            return Promise.resolve({
              id: sessionId,
              payment_status: 'paid',
              amount_total: 50000000,
              currency: 'vnd',
              metadata: { auctionId: 'test-auction-id' },
            });
          }
          // Incomplete/unpaid session
          if (sessionId === 'cs_test_incomplete') {
            return Promise.resolve({
              id: sessionId,
              payment_status: 'unpaid',
              amount_total: 50000000,
              currency: 'vnd',
              metadata: { auctionId: 'test-auction-id' },
            });
          }
          // Generic example session
          if (sessionId === 'cs_test_example') {
            return Promise.resolve({
              id: sessionId,
              payment_status: 'paid',
              amount_total: 50000000,
              currency: 'vnd',
              metadata: { auctionId: 'test-auction-id' },
            });
          }
          // Invalid session - throw error like real Stripe
          return Promise.reject({
            type: 'StripeInvalidRequestError',
            message: `No such checkout.session: ${sessionId}`,
          });
        }),
      },
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        id: 'evt_test_mock',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_mock' } },
      }),
    },
  }));
});

describe('2.7.2 Verify Payment (Mocked Stripe)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bidder: TestUser;
  let bidderToken: string;

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
    await cleanupTestUsers(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupTestUsers(prisma);
    bidder = await createTestUser(prisma, {
      email: 'verify_bidder@test.com',
      role: UserRole.bidder,
    });
    bidderToken = createTestJWT(bidder, UserRole.bidder);
  });

  describe('Payment Verification', () => {
    it('TC-2.7.2-01: Verify payment verification via query param', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payments/verify?session_id=cs_test_valid_session')
        .set('Authorization', `Bearer ${bidderToken}`);

      // With mocked Stripe, should succeed
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        'payment_id',
        'cs_test_valid_session'
      );
      expect(response.body).toHaveProperty('status', 'paid');
    });

    it('TC-2.7.2-02: Fail verify with missing session_id', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payments/verify')
        .set('Authorization', `Bearer ${bidderToken}`)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('TC-2.7.2-03: Fail verify with invalid session_id', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payments/verify?session_id=invalid_session_id')
        .set('Authorization', `Bearer ${bidderToken}`);

      // Mocked Stripe throws error for invalid sessions
      expect([400, 404]).toContain(response.status);
    });

    it('TC-2.7.2-04: Verify response includes payment status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payments/verify?session_id=cs_test_example')
        .set('Authorization', `Bearer ${bidderToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('payment_id');
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('currency');
    });

    it('TC-2.7.2-05: Verify incomplete payment returns unpaid', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payments/verify?session_id=cs_test_incomplete')
        .set('Authorization', `Bearer ${bidderToken}`)
        .expect(200);

      expect(response.body.status).toBe('unpaid');
    });
  });
});
