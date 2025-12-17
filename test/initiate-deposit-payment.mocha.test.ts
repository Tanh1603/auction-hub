import { strict as assert } from 'assert';
import { describe, it, beforeEach } from 'mocha';
import PaymentService from '../server/src/payment/payment.service';
import * as QRCode from 'qrcode';

// Minimal Prisma mock used by PaymentService
class MockPrisma {
  payment: any;
  constructor() {
    this.payment = {
      create: async (payload: any) => {
        // Return a mock payment record that looks similar to the DB output
        return {
          id: 'payment-db-id-1',
          transactionId: payload.data.transactionId,
          userId: payload.data.userId,
          auctionId: payload.data.auctionId,
          registrationId: payload.data.registrationId,
          paymentDetails: payload.data.paymentDetails,
          status: payload.data.status,
          amount: payload.data.amount,
          createdAt: new Date().toISOString(),
        };
      },
    };
  }
}

describe('PaymentService (Mocha) - Initiate deposit payment', function () {
  let paymentService: PaymentService;
  let prisma: MockPrisma;

  beforeEach(function () {
    prisma = new MockPrisma();

    // Instantiate the PaymentService with the mock Prisma
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      PaymentService: PaymentServiceClass,
    } = require('../server/src/payment/payment.service');
    paymentService = new PaymentServiceClass(prisma as any);

    // Replace QRCode.toDataURL with a deterministic stub so we don't rely on actual implementation
    (QRCode as any).toDataURL = async () => 'data:image/png;base64,stub-qrcode';

    // Replace the stripe client created in PaymentService with a stub that returns a mock session
    (paymentService as any).stripe = {
      checkout: {
        sessions: {
          create: async (opts: any) => {
            return {
              id: 'cs_test_mocked_session_123',
              url: 'https://checkout.stripe.com/c/pay/cs_test_mocked_session_123',
              payment_status: 'unpaid',
              amount_total: Math.round(
                opts.line_items[0].price_data.unit_amount
              ),
              currency: opts.line_items[0].price_data.currency || 'vnd',
            };
          },
          retrieve: async (sessionId: string) => {
            return {
              id: sessionId,
              payment_status: 'paid',
              amount_total: 5000000,
              currency: 'vnd',
              metadata: {},
            };
          },
        },
      },
    } as any;
  });

  it('should create Stripe session and return payment info', async function () {
    const userId = 'user-test-1';
    const paymentRequest = {
      auctionId: 'auction-uuid-1',
      registrationId: 'registration-uuid-1',
      paymentType: 'deposit',
      amount: 50000000, // VND amount
      paymentMethod: 'bank_transfer',
    };

    const result = await paymentService.createPayment(
      userId,
      paymentRequest as any
    );

    // Assert basic shape
    assert.ok(result);
    assert.equal(result.payment_id, 'cs_test_mocked_session_123');
    assert.equal(
      result.payment_url,
      'https://checkout.stripe.com/c/pay/cs_test_mocked_session_123'
    );
    assert.equal(result.amount, paymentRequest.amount);
    assert.equal(result.currency, 'VND');
    assert.ok(
      result.qr_code && result.qr_code.startsWith('data:image/png;base64')
    );

    // Check that we returned pending status (as created session has payment_status 'unpaid')
    assert.equal(result.status, 'unpaid');
  });
});
