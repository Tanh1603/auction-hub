/**
 * Integration Tests for 2.7.1 Create Payment
 * Test Case IDs: TC-2.7.1-01 to TC-2.7.1-20
 *
 * Uses Stripe mocking for reliable, isolated tests.
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

// Mock Stripe before importing modules that use it
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn().mockImplementation((params: any) =>
          Promise.resolve({
            id: `cs_test_mock_${Date.now()}`,
            url: 'https://checkout.stripe.com/test/mock',
            payment_status: 'unpaid',
            amount_total:
              params.line_items?.[0]?.price_data?.unit_amount || 50000000,
            currency: params.line_items?.[0]?.price_data?.currency || 'vnd',
            metadata: params.metadata || {},
          })
        ),
        retrieve: jest.fn().mockResolvedValue({
          id: 'cs_test_mock_session',
          payment_status: 'paid',
          amount_total: 50000000,
          currency: 'vnd',
          metadata: { auctionId: 'test-auction-id' },
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

describe('2.7.1 Create Payment (Mocked Stripe)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bidder: TestUser;
  let bidderToken: string;
  let auction: { id: string };
  let registration: { id: string };
  const TEST_PREFIX = 'TEST-PAY';

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

    bidder = await createTestUser(prisma, {
      email: 'pay_bidder@test.com',
      role: UserRole.bidder,
    });
    bidderToken = createTestJWT(bidder, UserRole.bidder);

    const location = await prisma.location.findFirst();
    auction = await prisma.auction.create({
      data: {
        code: `${TEST_PREFIX}-001`,
        name: 'Payment Test Auction',
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

    registration = await prisma.auctionParticipant.create({
      data: {
        userId: bidder.id,
        auctionId: auction.id,
        registeredAt: createDate(-3),
        documentsVerifiedAt: createDate(-1),
      },
    });
  });

  describe('Successful Payment Creation', () => {
    it('TC-2.7.1-01: Verify create payment for deposit type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          auctionId: auction.id,
          registrationId: registration.id,
          paymentType: 'deposit',
          amount: 50000000,
          paymentMethod: 'bank_transfer',
        });

      // With mocked Stripe, should succeed
      expect([201, 200]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body).toHaveProperty('payment_id');
      }
    });

    it('TC-2.7.1-02: Verify create payment for participation_fee', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          auctionId: auction.id,
          registrationId: registration.id,
          paymentType: 'participation_fee',
          amount: 500000,
          paymentMethod: 'bank_transfer',
        });

      expect([201, 200]).toContain(response.status);
    });

    it('TC-2.7.1-03: Verify create payment for winning_payment', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          auctionId: auction.id,
          registrationId: registration.id,
          paymentType: 'winning_payment',
          amount: 12000000,
          paymentMethod: 'bank_transfer',
        });

      expect([201, 200]).toContain(response.status);
    });

    it('TC-2.7.1-12: Verify payment with bank_transfer method', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          auctionId: auction.id,
          registrationId: registration.id,
          paymentType: 'deposit',
          amount: 50000000,
          paymentMethod: 'bank_transfer',
        });

      expect([201, 200]).toContain(response.status);
    });

    it('TC-2.7.1-13: Verify payment with e_wallet method', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          auctionId: auction.id,
          registrationId: registration.id,
          paymentType: 'deposit',
          amount: 50000000,
          paymentMethod: 'e_wallet',
        });

      expect([201, 200]).toContain(response.status);
    });
  });

  describe('Validation Failures', () => {
    it('TC-2.7.1-04: Fail payment with invalid paymentType enum', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          auctionId: auction.id,
          registrationId: registration.id,
          paymentType: 'invalid_type',
          amount: 50000000,
          paymentMethod: 'bank_transfer',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('TC-2.7.1-05: Fail payment with invalid paymentMethod enum', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          auctionId: auction.id,
          registrationId: registration.id,
          paymentType: 'deposit',
          amount: 50000000,
          paymentMethod: 'crypto',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('TC-2.7.1-06: Fail payment with missing auctionId', async () => {
      await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          registrationId: registration.id,
          paymentType: 'deposit',
          amount: 50000000,
          paymentMethod: 'bank_transfer',
        })
        .expect(400);
    });

    it('TC-2.7.1-07: Fail payment with missing registrationId', async () => {
      await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          auctionId: auction.id,
          paymentType: 'deposit',
          amount: 50000000,
          paymentMethod: 'bank_transfer',
        })
        .expect(400);
    });

    it('TC-2.7.1-08: Fail payment with missing amount', async () => {
      await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          auctionId: auction.id,
          registrationId: registration.id,
          paymentType: 'deposit',
          paymentMethod: 'bank_transfer',
        })
        .expect(400);
    });

    it('TC-2.7.1-09: Fail payment with zero amount', async () => {
      await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          auctionId: auction.id,
          registrationId: registration.id,
          paymentType: 'deposit',
          amount: 0,
          paymentMethod: 'bank_transfer',
        })
        .expect(400);
    });

    it('TC-2.7.1-10: Fail payment with negative amount', async () => {
      await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          auctionId: auction.id,
          registrationId: registration.id,
          paymentType: 'deposit',
          amount: -50000000,
          paymentMethod: 'bank_transfer',
        })
        .expect(400);
    });

    it('TC-2.7.1-11: Fail payment without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/payments')
        .send({
          auctionId: auction.id,
          registrationId: registration.id,
          paymentType: 'deposit',
          amount: 50000000,
          paymentMethod: 'bank_transfer',
        })
        .expect(401);
    });

    it('TC-2.7.1-15: Fail payment with non-existent auctionId', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          auctionId: '550e8400-e29b-41d4-a716-446655440000',
          registrationId: registration.id,
          paymentType: 'deposit',
          amount: 50000000,
          paymentMethod: 'bank_transfer',
        });

      // May return 404 or 400 (foreign key) depending on implementation
      expect([404, 400]).toContain(response.status);
    });

    it('TC-2.7.1-16: Fail payment with non-existent registrationId', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({
          auctionId: auction.id,
          registrationId: '550e8400-e29b-41d4-a716-446655440000',
          paymentType: 'deposit',
          amount: 50000000,
          paymentMethod: 'bank_transfer',
        });

      // May return 404 or 400 (foreign key) depending on implementation
      expect([404, 400]).toContain(response.status);
    });
  });
});
