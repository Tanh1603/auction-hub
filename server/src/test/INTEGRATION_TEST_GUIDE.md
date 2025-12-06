# Integration Test Setup and Execution Guide

## Overview

This integration test suite covers the complete auction flow from authentication to email notifications, using seeded account data and JWT authentication compatible with Supabase.

## Files Created

### 1. `auction-flow-simplified.integration.spec.ts`

Comprehensive integration test suite covering:

- **Authentication Flow**: Register, login, JWT validation
- **Registration to Bid**: User registration for auctions
- **Manual Bidding**: Real-time bidding with validation
- **Auction Finalization**: Winner determination and contract creation
- **Email Notifications**: Automated email sending after finalization
- **Error Handling**: Edge cases and security validation

## Setup Instructions

### 1. Install Dependencies

```bash
cd server
npm install --save-dev supertest @types/supertest
```

### 2. Environment Setup

### 3. Database Setup

Make sure your test database is running and accessible. The tests will automatically clean and seed data.

## Running the Tests

### Option 1: Run Specific Integration Tests

```bash
# Run the integration test suite
npm test -- src/test/integration/auction-flow-simplified.integration.spec.ts

# Run with coverage
npm run test:cov -- src/test/integration/auction-flow-simplified.integration.spec.ts

# Run in watch mode for development
npm test -- --watch src/test/integration/auction-flow-simplified.integration.spec.ts
```

### Option 2: Run All Tests

```bash
# Run all tests including integration tests
npm test

# Run with verbose output
npm test -- --verbose
```

### Option 3: Docker-based Testing

```bash
# Start your services
docker-compose up -d

# Run seed data first (use our comprehensive seed)
docker exec -it auction-hub-server-1 node prisma/comprehensive-seed.js

# Run tests against Docker environment
npm test -- src/test/integration/auction-flow-simplified.integration.spec.ts
```

## Test Scenarios Covered

### 1. Complete User Journey

```
Registration → Login → Register for Auction → Place Bids → Win/Lose → Email Notification
```

### 2. Authentication Security

- JWT token validation with Supabase-compatible secrets
- Expired token handling
- Invalid token rejection
- Missing authorization headers

### 3. Auction Registration Flow

- User registration for auction participation
- Verification requirements
- Duplicate registration prevention
- Withdrawal capabilities

### 4. Bidding Mechanics

- Bid increment validation
- Starting price enforcement
- Real-time bid updates
- Winner determination
- Concurrent bid handling

### 5. Finalization Process

- Auction status evaluation
- Winner contract creation
- Email notification generation
- Audit log creation

### 6. Email System Integration

- Email template generation
- Winner vs. loser notifications
- Bulk email sending
- Error handling for email failures

## Test Data Structure

The tests automatically create:

### Users (5 total)

- **Auctioneer**: Property owner/seller
- **3 Bidders**: Verified participants with different profiles
- **Admin**: System administrator for finalization

### Auctions

- **Test auction** with realistic Vietnamese data
- Multiple states: scheduled, live, completed
- Proper timeline and pricing setup

### Bids

- Sequential bidding with proper increments
- Winner/loser determination
- Realistic timestamps and amounts

### Expected Outcomes

- Contract generation for winners
- Email notifications to all participants
- Proper audit trail creation
- Status updates throughout flow

## Debugging and Troubleshooting

### Common Issues

1. **JWT Secret Mismatch**

   ```
   Error: JWT_SECRET not found
   ```

   Solution: Ensure JWT_SECRET is set in environment

2. **Database Connection Issues**

   ```
   Error: connect ECONNREFUSED
   ```

   Solution: Check DATABASE_URL and ensure database is running

3. **Email Service Failures**

   ```
   SMTP connection failed
   ```

   Solution: Tests mock email service, but verify SMTP configuration

4. **Supabase Integration Issues**
   ```
   Error: Supabase auth failed
   ```
   Solution: Tests mock Supabase service for isolation

### Debugging Tips

```bash
# Run with debug output
DEBUG=* npm test -- src/test/integration/auction-flow-simplified.integration.spec.ts

# Run single test case
npm test -- --testNamePattern="should allow verified user to register for auction"

# Verbose logging
npm test -- --verbose --no-cache
```

## Test Configuration

### Jest Configuration

The tests use the existing Jest configuration with:

- Node.js test environment
- TypeScript transformation
- Database cleanup between tests
- Mocked external services

### Database Handling

- **Clean slate**: Each test starts with empty database
- **Seeded data**: Realistic test users and auctions
- **Transaction isolation**: Tests don't interfere with each other
- **Proper cleanup**: No data leakage between tests

### Mocking Strategy

- **Supabase Auth**: Mocked for isolation
- **Email Service**: Mocked to prevent actual emails
- **JWT Tokens**: Real tokens with test secrets
- **Database**: Real database with test data

## Integration Points Tested

1. **Auth Service** ↔ **Supabase Auth**
2. **Registration Service** ↔ **Database**
3. **Bidding Service** ↔ **Real-time validation**
4. **Finalization Service** ↔ **Email Service**
5. **Email Service** ↔ **SMTP/Brevo integration**
6. **JWT Guards** ↔ **Route protection**

## Performance Considerations

- Tests run in ~30-60 seconds total
- Database operations are optimized
- Parallel test execution where possible
- Efficient cleanup strategies
- Minimal external service calls

## Security Testing

- **JWT expiration** handling
- **Authorization** boundary testing
- **Input validation** on all endpoints
- **Authentication bypass** prevention
- **Rate limiting** behavior (future enhancement)

## Future Enhancements

1. **Load Testing**: Add performance tests for concurrent bidding
2. **WebSocket Testing**: Real-time bid notifications
3. **Payment Integration**: Test payment processing flows
4. **File Upload**: Test document upload for registration
5. **Admin Panel**: Test administrative functions

## Monitoring and Reporting

The tests generate:

- **Coverage reports** showing code coverage
- **Test results** with pass/fail status
- **Performance metrics** for response times
- **Error logs** for debugging failures
- **Audit trails** for compliance verification

This comprehensive test suite ensures your auction system works correctly from user registration through final email notifications, with realistic data and proper security validation.
