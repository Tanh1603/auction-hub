# Auction Hub Integration (API) Test Suite

This directory contains the comprehensive **Integration/API Test Suite** for the Auction Hub application.

> **Note on Naming**: These are **Integration Tests** (not E2E tests). They test API endpoints directly using HTTP requests via `supertest`, without browser automation. True E2E tests would involve browser automation tools like Playwright or Cypress.

## 📂 Directory Structure

```
test/integration/
├── README.md                              # This file
├── jest.config.js                         # Jest configuration
├── jest.setup.ts                          # Test environment setup
│
├── helpers/
│   └── test-helpers.ts                    # Shared utilities (JWT, cleanup, etc.)
│
├── 3.1-user-management/
│   ├── 3.1.1-user-registration.spec.ts    # ~30 tests
│   ├── 3.1.2-get-user-info.spec.ts        # ~8 tests
│   └── 3.1.3-user-promotion.spec.ts       # ~12 tests
│
├── 3.2-authentication/
│   ├── 3.2.1-login.spec.ts                # ~10 tests
│   ├── 3.2.2-forgot-password.spec.ts      # ~4 tests
│   └── 3.2.3-email-verification.spec.ts   # ~12 tests
│
├── 3.3-auction-management/
│   ├── 3.3.1-list-auctions.spec.ts        # ~6 tests
│   ├── 3.3.2-get-auction.spec.ts          # ~6 tests
│   ├── 3.3.3-create-auction.spec.ts       # ~8 tests
│   ├── 3.3.4-update-auction.spec.ts       # ~6 tests
│   ├── 3.3.5-delete-auction.spec.ts       # ~5 tests
│   └── 3.3.6-auction-relations.spec.ts    # ~5 tests
│
├── 3.4-registration-to-bid/
│   ├── 3.4.1-register.spec.ts             # ~7 tests
│   ├── 3.4.2-withdraw.spec.ts             # ~4 tests
│   ├── 3.4.3-check-in.spec.ts             # ~5 tests
│   ├── 3.4.4-deposit.spec.ts              # ~8 tests
│   ├── 3.4.5-view-registrations.spec.ts   # ~11 tests
│   └── 3.4.6-admin-operations.spec.ts     # ~18 tests
│
├── 3.5-bidding-system/
│   ├── 3.5.1-manual-bidding.spec.ts       # ~26 tests
│   ├── 3.5.2-bid-denial.spec.ts           # ~8 tests
│   ├── 3.5.3-auto-bid.spec.ts             # ~6 tests
│   └── 3.5.4-bid-history.spec.ts          # ~8 tests
│
├── 3.6-auction-finalization/
│   ├── 3.6.1-evaluate.spec.ts             # ~5 tests
│   ├── 3.6.2-finalize.spec.ts             # ~7 tests
│   └── 3.6.3-results-audit.spec.ts        # ~10 tests
│
├── 3.7-payment/
│   ├── 3.7.1-create-payment.spec.ts       # ~16 tests
│   └── 3.7.2-verify-payment.spec.ts       # ~5 tests
│
├── 3.8-auction-costs/
│   ├── 3.8.1-create-get.spec.ts           # ~12 tests
│   └── 3.8.2-update-delete.spec.ts        # ~12 tests
│
├── 3.9-system-config/
│   ├── 3.9.1-system-variables.spec.ts     # ~20 tests
│   └── 3.9.2-cache.spec.ts                # ~4 tests
│
├── 3.10-locations/
│   └── 3.10.1-locations.spec.ts           # ~10 tests
│
├── 3.11-articles/
│   ├── 3.11.1-list-get-create.spec.ts     # ~18 tests
│   └── 3.11.2-update-delete.spec.ts       # ~11 tests
│
├── 3.12-contracts/
│   ├── 3.12.1-get-contract.spec.ts        # ~4 tests
│   ├── 3.12.2-export-pdf.spec.ts          # ~4 tests
│   └── 3.12.3-list-update.spec.ts         # ~6 tests
│
├── 4.1-security/
│   ├── 4.1.1-idor.spec.ts                 # ~4 tests
│   ├── 4.1.2-mass-assignment.spec.ts      # ~5 tests
│   ├── 4.1.3-jwt-security.spec.ts         # ~7 tests
│   ├── 4.1.4-sql-injection.spec.ts        # ~4 tests
│   ├── 4.1.5-bola-banned.spec.ts          # ~6 tests
│   └── 4.1.6-rate-limit-xss.spec.ts       # ~6 tests
│
└── 5.1-reliability/
    ├── 5.1.1-race-conditions.spec.ts      # ~3 tests
    ├── 5.1.2-idempotency.spec.ts          # ~3 tests
    ├── 5.1.3-concurrency.spec.ts          # ~7 tests
    └── 5.1.4-data-integrity.spec.ts       # ~8 tests
```

**Total: ~400 granular test cases across 47 test files**

## 🚀 Quick Start

### Running Tests

```bash
# Run ALL integration tests
npm run test:integration

# Run with verbose output
npm run test:integration:verbose

# Run with coverage report
npm run test:integration:coverage

# Watch mode (re-run on changes)
npm run test:integration:watch
```

### Running Specific Categories

```bash
# Run entire 3.1 User Management category
npm run test:3.1

# Run specific sub-category (granular)
npm run test:3.1.1    # Only User Registration
npm run test:3.1.2    # Only Get User Info
npm run test:3.1.3    # Only User Promotion

# Run entire 3.2 Authentication category
npm run test:3.2

# Run specific auth test
npm run test:3.2.1    # Only Login

# Run entire 3.5 Bidding category
npm run test:3.5

# Run specific bidding tests
npm run test:3.5.1    # Only Manual Bidding
npm run test:3.5.2    # Only Bid Denial
```

### Running via Jest Directly

```bash
# Run specific file
npx jest --config test/integration/jest.config.js --testPathPattern=3.1.1 --runInBand

# Run specific test case
npx jest --config test/integration/jest.config.js --testNamePattern="TC-3.1.1-01" --runInBand
```

## 🏗️ Test File Structure

Each test file follows this pattern:

```typescript
describe('3.X.Y Category Name', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Initialize NestJS app with ValidationPipe
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  beforeEach(async () => {
    await setupTestData();  // Reset data for isolation
  });

  describe('Sub-Category', () => {
    it('TC-3.X.Y-ZZ: Test description', async () => {
      // Arrange
      const payload = { ... };

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/endpoint')
        .set('Authorization', `Bearer ${token}`)
        .send(payload)
        .expect(201);

      // Assert Response
      expect(response.body.field).toBe('expected');

      // Assert Database State
      const record = await prisma.model.findUnique({ ... });
      expect(record).toBeTruthy();
    });
  });
});
```

## 🔧 Available NPM Scripts

| Script                      | Description                      |
| --------------------------- | -------------------------------- |
| `test:integration`          | Run all integration tests        |
| `test:integration:verbose`  | Run with detailed output         |
| `test:integration:coverage` | Run with coverage report         |
| `test:integration:watch`    | Watch mode                       |
| `test:3.1`                  | Run 3.1 User Management (all)    |
| `test:3.1.1`                | Run 3.1.1 User Registration only |
| `test:3.1.2`                | Run 3.1.2 Get User Info only     |
| `test:3.1.3`                | Run 3.1.3 User Promotion only    |
| `test:3.2`                  | Run 3.2 Authentication (all)     |
| `test:3.2.1`                | Run 3.2.1 Login only             |
| `test:3.5`                  | Run 3.5 Bidding System (all)     |
| `test:3.5.1`                | Run 3.5.1 Manual Bidding only    |
| `test:3.5.2`                | Run 3.5.2 Bid Denial only        |
| `test:4.1`                  | Run 4.1 Security tests           |
| `test:5.1`                  | Run 5.1 Reliability tests        |

## 📊 Test Coverage Matrix

| Category                    | Sub-Category             | Status  | Tests |
| --------------------------- | ------------------------ | ------- | ----- |
| **3.1 User Management**     |                          |         |
|                             | 3.1.1 User Registration  | ✅      | ~30   |
|                             | 3.1.2 Get User Info      | ✅      | ~8    |
|                             | 3.1.3 User Promotion     | ✅      | ~12   |
| **3.2 Authentication**      |                          |         |
|                             | 3.2.1 Login              | ✅      | ~10   |
|                             | 3.2.2 Forgot Password    | ✅      | ~4    |
|                             | 3.2.3 Email Verification | ✅      | ~12   |
| **3.5 Bidding System**      |                          |         |
|                             | 3.5.1 Manual Bidding     | ✅      | ~26   |
|                             | 3.5.2 Bid Denial         | ✅      | ~8    |
| **3.3, 3.4, 3.6, 4.1, 5.1** |                          | 📋 TODO | -     |

## 💡 Why "Integration" Not "E2E"?

| Aspect            | This Test Suite                   | True E2E Tests                          |
| ----------------- | --------------------------------- | --------------------------------------- |
| **What it tests** | API endpoints                     | Full user journey (UI → API → DB)       |
| **How**           | HTTP requests (`supertest`)       | Browser automation (Playwright/Cypress) |
| **Involves**      | Controllers + Services + Database | Frontend + Backend + Database           |
| **Speed**         | Fast (~1-5s per test)             | Slow (~10-30s per test)                 |
| **Flakiness**     | Low                               | Higher (browser timing issues)          |

This suite tests the **API integration layer** - ensuring controllers, services, and database work together correctly. It's equivalent to cURL commands in your terminal.

## 🔐 Environment Variables

```env
NODE_ENV=test
AUTH_MODE=test                   # Enables test mode in AuthGuard
JWT_SECRET=your-secret           # For token generation
DATABASE_URL=postgresql://...    # Test database
```

## 📝 Notes on Supabase

Several auth tests are marked with `NOTE:` comments because:

- Login requires Supabase password authentication
- Email verification requires real email tokens
- Password reset sends actual emails

To fully test these, you need either:

1. Real Supabase credentials for a test project
2. Mock the Supabase client in tests

---

**Last Updated**: December 2024
