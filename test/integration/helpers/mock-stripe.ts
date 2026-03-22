/**
 * Mock Stripe Service for Integration Tests
 *
 * Provides consistent, predictable responses for Stripe operations
 * without hitting the actual Stripe API.
 */

export interface MockStripeSession {
  id: string;
  payment_status: 'unpaid' | 'paid' | 'no_payment_required';
  amount_total: number;
  currency: string;
  url: string;
  metadata: Record<string, string>;
}

export interface MockStripeCheckoutResponse {
  id: string;
  url: string;
  payment_status: string;
  metadata: Record<string, string>;
  amount_total: number;
  currency: string;
}

/**
 * Mock Payment Service Provider
 * Use this to override PaymentService in test modules
 */
export const mockPaymentServiceProvider = {
  provide: 'PaymentService',
  useValue: {
    createPayment: jest.fn().mockResolvedValue({
      payment_id: 'cs_test_mock_session_001',
      amount: 50000000,
      currency: 'VND',
      status: 'unpaid',
      payment_url: 'https://checkout.stripe.com/test/mock_session',
      qr_code: 'data:image/png;base64,mockqrcode',
      bank_info: {
        bank_name: 'Mock Bank',
        account_number: '1234567890',
        account_name: 'Auction Hub',
        transfer_content: 'Payment for deposit',
      },
      payment_deadline: new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString(),
    }),
    verifyPayment: jest.fn().mockImplementation((sessionId: string) => {
      if (sessionId === 'cs_test_valid_session') {
        return Promise.resolve({
          payment_id: sessionId,
          status: 'paid',
          amount: 50000000,
          currency: 'VND',
          metadata: { auctionId: 'test-auction-id' },
        });
      }
      if (sessionId === 'cs_test_incomplete') {
        return Promise.resolve({
          payment_id: sessionId,
          status: 'unpaid',
          amount: 50000000,
          currency: 'VND',
          metadata: { auctionId: 'test-auction-id' },
        });
      }
      return Promise.reject(new Error(`Invalid session: ${sessionId}`));
    }),
    constructEvent: jest
      .fn()
      .mockImplementation((payload: Buffer, signature: string) => {
        return {
          id: 'evt_test_mock',
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_mock_session_001',
              payment_status: 'paid',
              metadata: {
                auctionId: 'test-auction-id',
                registrationId: 'test-registration-id',
                userId: 'test-user-id',
              },
            },
          },
        };
      }),
  },
};

/**
 * Creates a mock Stripe session for testing
 */
export function createMockStripeSession(
  overrides: Partial<MockStripeSession> = {}
): MockStripeSession {
  return {
    id: `cs_test_mock_${Date.now()}`,
    payment_status: 'unpaid',
    amount_total: 50000000,
    currency: 'vnd',
    url: 'https://checkout.stripe.com/test/mock',
    metadata: {},
    ...overrides,
  };
}

/**
 * Mock Stripe checkout.sessions.create response
 */
export function createMockCheckoutResponse(
  auctionId: string,
  registrationId: string,
  paymentType: string,
  amount: number
): MockStripeCheckoutResponse {
  return {
    id: `cs_test_mock_${Date.now()}`,
    url: 'https://checkout.stripe.com/test/mock',
    payment_status: 'unpaid',
    amount_total: amount,
    currency: 'vnd',
    metadata: {
      auctionId,
      registrationId,
      paymentType,
    },
  };
}

/**
 * Jest mock factory for Stripe
 * Usage: jest.mock('stripe', () => createStripeMock())
 */
export function createStripeMock() {
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
        retrieve: jest.fn().mockImplementation((sessionId: string) => {
          if (sessionId.includes('valid') || sessionId.includes('mock')) {
            return Promise.resolve({
              id: sessionId,
              payment_status: 'paid',
              amount_total: 50000000,
              currency: 'vnd',
              metadata: { auctionId: 'test-auction-id' },
            });
          }
          if (sessionId.includes('incomplete')) {
            return Promise.resolve({
              id: sessionId,
              payment_status: 'unpaid',
              amount_total: 50000000,
              currency: 'vnd',
              metadata: { auctionId: 'test-auction-id' },
            });
          }
          return Promise.reject(
            new Error(`No such checkout session: ${sessionId}`)
          );
        }),
      },
    },
    webhooks: {
      constructEvent: jest.fn().mockImplementation(() => ({
        id: 'evt_test_mock',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_mock_session_001',
            payment_status: 'paid',
            metadata: {
              auctionId: 'test-auction-id',
              registrationId: 'test-registration-id',
              userId: 'test-user-id',
            },
          },
        },
      })),
    },
  }));
}
