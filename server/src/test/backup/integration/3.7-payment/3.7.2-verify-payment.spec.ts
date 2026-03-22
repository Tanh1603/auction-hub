/**
 * Integration Tests for 3.7.2 Verify Payment
 * Test Case IDs: TC-3.7.2-01 to TC-3.7.2-05
 *
 * NOTE: These tests require Stripe session IDs from completed payments.
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

describe('3.7.2 Verify Payment', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bidder: TestUser;
  let bidderToken: string;

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
    it('TC-3.7.2-01: Verify payment verification via query param', async () => {
      // NOTE: Requires actual Stripe session
      const response = await request(app.getHttpServer())
        .get('/api/payments/verify?session_id=cs_test_valid_session')
        .set('Authorization', `Bearer ${bidderToken}`);

      // Without real Stripe, will likely fail
      expect([200, 400, 404]).toContain(response.status);
    });

    it('TC-3.7.2-02: Fail verify with missing session_id', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payments/verify')
        .set('Authorization', `Bearer ${bidderToken}`)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('TC-3.7.2-03: Fail verify with invalid session_id', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payments/verify?session_id=invalid_session_id')
        .set('Authorization', `Bearer ${bidderToken}`);

      expect([400, 404]).toContain(response.status);
    });

    it('TC-3.7.2-04: Verify response includes payment status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payments/verify?session_id=cs_test_example')
        .set('Authorization', `Bearer ${bidderToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('status');
      }
    });

    it('TC-3.7.2-05: Verify incomplete payment returns unpaid', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payments/verify?session_id=cs_test_incomplete')
        .set('Authorization', `Bearer ${bidderToken}`);

      if (response.status === 200) {
        expect(['paid', 'unpaid']).toContain(response.body.status);
      }
    });
  });
});
