# Auction Finalization Service Architecture

## Overview

The auction finalization service has been refactored into multiple specialized services based on **actor context** for better maintainability, coherence, and separation of concerns.

## Service Structure

### 1. **AuctionFinalizationService** (Main Orchestrator)

- **Location**: `auction-finalization.service.ts`
- **Role**: Main facade that delegates to specialized services
- **Responsibilities**:
  - Routes requests to appropriate context-specific services
  - Maintains backward compatibility with existing API
  - Acts as a single entry point for the module

### 2. **AuctionEvaluationService** (System/Automated Context)

- **Location**: `services/auction-evaluation.service.ts`
- **Actor**: System/Automated Processes
- **Responsibilities**:
  - Evaluate auction status based on business rules
  - Check minimum participants, bid compliance, reserve prices
  - Calculate bid increment compliance
  - Determine recommended auction status
  - Provide evaluation metadata for decision-making

### 3. **AuctionOwnerService** (Owner/Auctioneer Context)

- **Location**: `services/auction-owner.service.ts`
- **Actor**: Auction Owner/Auctioneer
- **Responsibilities**:
  - Finalize auctions with or without auto-evaluation
  - Override auction status manually (admin privilege)
  - Create contracts for winning bids
  - Calculate financial summaries
  - Manage audit logs
  - Send result notifications to participants
  - Emit WebSocket updates for real-time notifications

### 4. **WinnerPaymentService** (Winner Context)

- **Location**: `services/winner-payment.service.ts`
- **Actor**: Auction Winner
- **Responsibilities**:
  - Calculate winner payment requirements
  - Initiate winner payments via payment gateway
  - Verify payment completion
  - Handle payment failures and deadline expirations
  - Forfeit deposits and offer to 2nd highest bidder
  - Prepare contracts after successful payment
  - Send payment-related notifications

### 5. **AuctionResultsService** (Participant/Viewer Context)

- **Location**: `services/auction-results.service.ts`
- **Actor**: Participants and Result Viewers
- **Responsibilities**:
  - Provide auction results to authorized users
  - Include winning bid information
  - Include contract status
  - Include financial summary
  - Include evaluation metadata
  - Enforce access control (participants and owners only)

## Benefits of This Architecture

### 1. **Separation of Concerns**

Each service handles operations for a specific actor context, making the codebase easier to understand and maintain.

### 2. **Single Responsibility Principle**

Each service has a clear, focused responsibility aligned with a specific user role or system function.

### 3. **Better Testability**

Services can be tested independently with their specific contexts and dependencies.

### 4. **Easier Maintenance**

- Changes to winner payment logic only affect `WinnerPaymentService`
- Changes to evaluation rules only affect `AuctionEvaluationService`
- Easier to locate and fix bugs related to specific actors

### 5. **Scalability**

New actor-specific features can be added to the appropriate service without affecting others.

### 6. **Clear API Surface**

The main orchestrator service provides a clean, simple API while delegating to specialized services internally.

## Module Configuration

### Dependencies

The module imports:

- `PrismaModule` - Database access
- `AuctionPolicyModule` - Policy calculations
- `PaymentModule` - Payment processing

### Providers

All services are registered as providers:

```typescript
providers: [
  AuctionFinalizationService, // Main orchestrator
  AuctionEvaluationService, // System evaluation
  AuctionOwnerService, // Owner operations
  WinnerPaymentService, // Winner payments
  AuctionResultsService, // Results viewing
  BiddingGateway, // WebSocket events
];
```

### Exports

Only the main orchestrator is exported to maintain encapsulation:

```typescript
exports: [AuctionFinalizationService];
```

## Usage Examples

### For Controllers

Controllers only interact with the main orchestrator:

```typescript
constructor(
  private readonly finalizationService: AuctionFinalizationService
) {}

// Evaluation
await this.finalizationService.evaluateAuction(auctionId);

// Owner operations
await this.finalizationService.finalizeAuction(dto, userId);
await this.finalizationService.overrideAuctionStatus(dto, adminId);

// Winner operations
await this.finalizationService.initiateWinnerPayment(auctionId, winnerId);
await this.finalizationService.verifyWinnerPayment(sessionId, auctionId, userId);

// Results viewing
await this.finalizationService.getAuctionResults(auctionId, userId);
```

## Actor-Based Design Benefits

### Clear Boundaries

Each actor (evaluator, owner, winner, viewer) has their own service with clear boundaries.

### Access Control

Services enforce role-based access control naturally through their design.

### Audit Trail

Owner operations maintain comprehensive audit logs for compliance.

### Payment Isolation

Winner payment logic is completely isolated from other concerns, making it easier to integrate with different payment providers.

## Future Enhancements

### Potential Additional Services

- **SellerService**: Handle seller-specific post-auction operations
- **NotificationService**: Centralize all email/notification logic
- **AuditService**: Dedicated audit log management
- **FinancialService**: Handle all financial calculations and reporting

### Extensibility

The architecture makes it easy to:

- Add new actor contexts
- Integrate additional payment methods
- Implement different evaluation strategies
- Add role-specific features

## Migration Guide

### Before (Single Service)

```typescript
// All operations in one large service
class AuctionFinalizationService {
  evaluateAuction() {}
  finalizeAuction() {}
  overrideStatus() {}
  getWinnerPayment() {}
  verifyPayment() {}
  getResults() {}
  // 1500+ lines of mixed concerns
}
```

### After (Actor-Based Services)

```typescript
// Orchestrator
class AuctionFinalizationService {
  constructor(evaluation: AuctionEvaluationService, owner: AuctionOwnerService, winner: WinnerPaymentService, results: AuctionResultsService) {}

  // Delegates to appropriate service
}

// Specialized services (~200-300 lines each)
class AuctionEvaluationService {} // System operations
class AuctionOwnerService {} // Owner operations
class WinnerPaymentService {} // Winner operations
class AuctionResultsService {} // Viewer operations
```

## Testing Strategy

### Unit Tests

- Test each service independently with mocked dependencies
- Test actor-specific business rules in isolation
- Mock the orchestrator's delegations

### Integration Tests

- Test the full flow through the orchestrator
- Test cross-service interactions
- Test access control enforcement

### Example Test Structure

```typescript
describe('AuctionEvaluationService', () => {
  it('should evaluate auction with minimum participants');
  it('should check bid increment compliance');
  it('should recommend correct status');
});

describe('AuctionOwnerService', () => {
  it('should finalize auction with winning bid');
  it('should create audit log entries');
  it('should enforce owner-only access');
});

describe('WinnerPaymentService', () => {
  it('should calculate payment requirements');
  it('should handle payment verification');
  it('should forfeit deposit on deadline expiry');
});
```

## Conclusion

This refactored architecture provides:

- ✅ Clear separation by actor context
- ✅ Improved maintainability and readability
- ✅ Better testability
- ✅ Easier debugging and troubleshooting
- ✅ Foundation for future enhancements
- ✅ Backward compatibility through the orchestrator pattern
