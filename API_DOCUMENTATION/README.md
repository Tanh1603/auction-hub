# Auction Hub API Documentation

Complete API documentation for the Auction Hub backend system.

**Base URL**: `http://localhost:3000/api` (or your configured domain)
**WebSocket URL**: `ws://localhost:3000/bidding`

---

## Table of Contents

### Core Features

1. **[Authentication](01_AUTHENTICATION.md)** - User registration, login, email verification, and role management
2. **[Registration to Bid](02_REGISTER_TO_BID.md)** - Two-tier approval system for auction participation
3. **[Bidding](03_BIDDING.md)** - Manual bidding and real-time WebSocket bidding
4. **[Finalization & Payment](04_FINALIZATION_PAYMENT.md)** - Auction finalization, winner payment, and results

### Auction Management

5. **[Auctions](05_AUCTIONS.md)** - Browse and view auction listings
6. **[Auction Policy](06_AUCTION_POLICY.md)** - Policy configuration, validation, and calculations
7. **[Auction Costs](07_AUCTION_COSTS.md)** - Track operational expenses per auction

---

## Quick Reference

### Public Endpoints (No Authentication Required)

| Module | Endpoint | Description |
|--------|----------|-------------|
| Auth | `POST /auth/register` | Register new user |
| Auth | `POST /auth/login` | User login |
| Auth | `POST /auth/verify-email` | Verify email with OTP |
| Auth | `POST /auth/forgot-password` | Request password reset |
| Auctions | `GET /auctions` | List all auctions with filters |
| Auctions | `GET /auctions/:id` | Get single auction details |

### User Endpoints (Authentication Required)

| Module | Endpoint | Description |
|--------|----------|-------------|
| Auth | `GET /auth/me` | Get current user info |
| Registration | `POST /register-to-bid` | Register for auction |
| Registration | `POST /register-to-bid/withdraw` | Withdraw from auction |
| Registration | `POST /register-to-bid/check-in` | Check in before auction |
| Registration | `POST /register-to-bid/submit-deposit` | Initiate deposit payment |
| Registration | `POST /register-to-bid/verify-deposit-payment` | Verify deposit payment |
| Bidding | `POST /manual-bid` | Place manual bid |
| Finalization | `GET /auction-finalization/results/:auctionId` | View auction results |
| Finalization | `POST /auction-finalization/submit-winner-payment` | Submit winner payment |
| Policy | `POST /auction-policy/calculate/*` | Calculate fees/deposits |
| Costs | `GET /auction-costs/auction/:auctionId` | View auction costs |

### Admin/Auctioneer Endpoints (Elevated Permissions)

| Module | Endpoint | Description |
|--------|----------|-------------|
| Auth | `PUT /auth/admin/users/:userId/promote` | Promote user role |
| Registration | `POST /register-to-bid/admin/verify-documents` | Verify documents (Tier 1) |
| Registration | `POST /register-to-bid/admin/final-approval` | Final approval (Tier 2) |
| Registration | `GET /register-to-bid/admin/registrations` | List all registrations |
| Bidding | `POST /manual-bid/deny` | Deny a bid |
| Finalization | `POST /auction-finalization/finalize` | Finalize auction |
| Finalization | `GET /auction-finalization/evaluate/:auctionId` | Evaluate auction status |
| Finalization | `POST /auction-finalization/override` | Override auction status |
| Auctions | `PATCH /auctions/:id/resources` | Update auction resources |
| SysVars | `GET /system-variables` | Manage system variables |
| SysVars | `PATCH /system-variables/:category/:key` | Update system variable |
| Costs | `POST /auction-costs/auction/:auctionId` | Create/update costs |
| Costs | `POST /auction-costs/auction/:auctionId/other-cost` | Add other cost item |

---

## Complete Auction Flow

### Phase 1: Setup
1. Admin creates auction policy (if needed)
2. Admin creates auction with policy
3. Admin sets auction costs

### Phase 2: Registration Period
1. User registers: `POST /register-to-bid`
2. Admin verifies documents: `POST /register-to-bid/admin/verify-documents`
3. User submits deposit: `POST /register-to-bid/submit-deposit`
4. User completes Stripe payment
5. User verifies payment: `POST /register-to-bid/verify-deposit-payment`
6. Admin gives final approval: `POST /register-to-bid/admin/final-approval`

### Phase 3: Pre-Auction
1. User checks in (24h before): `POST /register-to-bid/check-in`
2. User joins WebSocket: `WS /bidding` → `joinAuction`

### Phase 4: Live Auction
1. User places bids: `POST /manual-bid`
2. All participants receive real-time updates via WebSocket
3. Admin can deny invalid bids: `POST /manual-bid/deny`

### Phase 5: Finalization
1. Admin evaluates: `GET /auction-finalization/evaluate/:auctionId`
2. Admin finalizes: `POST /auction-finalization/finalize`
3. Users view results: `GET /auction-finalization/results/:auctionId`

### Phase 6: Winner Payment
1. Winner checks requirements: `GET /auction-finalization/winner-payment-requirements/:auctionId`
2. Winner initiates payment: `POST /auction-finalization/submit-winner-payment`
3. Winner completes Stripe payment
4. Winner verifies payment: `POST /auction-finalization/verify-winner-payment`

---

## WebSocket Events (Real-time Bidding)

**Namespace**: `/bidding`

### Client → Server
- `joinAuction` - Join auction room
- `leaveAuction` - Leave auction room

### Server → Client
- `auctionState` - Full auction state (on join)
- `newBid` - New bid placed
- `bidDenied` - Bid was denied by admin
- `timeUpdate` - Time remaining (every 1 second)
- `auctionUpdate` - General auction updates
- `error` - Error occurred

See [03_BIDDING.md](03_BIDDING.md) for complete WebSocket documentation.

---

## Authentication & Authorization

### Authentication Methods
- **JWT Bearer Token**: Include in `Authorization: Bearer <token>` header
- **Supabase Integration**: Dual auth system (Supabase + local DB)

### User Roles
- `bidder` - Default role, can bid on auctions
- `auctioneer` - Can manage auctions and registrations
- `admin` - Full access except super admin functions
- `super_admin` - Complete system access

### Guards
- `AuthGuard` - Requires valid JWT token
- `RolesGuard` - Requires specific role(s)

---

## Common Response Patterns

### Success Response
```json
{
  "data": { ... },
  "message": "Success message"
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

### Paginated Response
```json
{
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

---

## Stripe Payment Integration

The system uses Stripe for payment processing:

1. **Initiate Payment** - System creates Stripe checkout session
2. **Response** - Receive `paymentUrl` and `qrCode`
3. **User Pays** - User completes payment via Stripe
4. **Verify** - Call verify endpoint with `sessionId`

Payments are used for:
- Registration deposits
- Winner final payment

---

## Environment Setup

Required environment variables (server-side):
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
DATABASE_URL=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

---

## Testing with Postman

See [POSTMAN_API_TESTING_GUIDE.md](../POSTMAN_API_TESTING_GUIDE.md) in the root directory for:
- Collection setup
- Environment variables
- Test scenarios
- Example requests

---

## API Version

**Current Version**: v1
**Last Updated**: 2025-11-17

---

## Support & Feedback

For issues or questions about the API:
1. Check the specific module documentation
2. Review the Postman testing guide
3. Consult the codebase at `server/src/`

---

## Module Summaries

### [01_AUTHENTICATION.md](01_AUTHENTICATION.md)
7 endpoints for user management, registration, login, email verification, and role promotion.

### [02_REGISTER_TO_BID.md](02_REGISTER_TO_BID.md)
10 endpoints covering two-tier approval system (document verification + deposit payment) for auction participation.

### [03_BIDDING.md](03_BIDDING.md)
2 HTTP endpoints for manual bidding, plus complete WebSocket gateway for real-time bidding with 8 events.

### [04_FINALIZATION_PAYMENT.md](04_FINALIZATION_PAYMENT.md)
8 endpoints for auction finalization, results, audit logs, winner payment processing, and generic payment operations.

### [05_AUCTIONS.md](05_AUCTIONS.md)
5 public endpoints for browsing auctions, viewing details, and managing auction resources.

### [06_AUCTION_POLICY.md](06_AUCTION_POLICY.md)
11 endpoints for System Variables configuration and policy fee validation/calculations.

### [07_AUCTION_COSTS.md](07_AUCTION_COSTS.md)
5 endpoints for tracking and managing operational expenses per auction.

---

**Total API Surface**: 49 HTTP endpoints + 8 WebSocket events
