# 🚀 Postman API Testing Guide - Auction Hub

## 📋 Prerequisites

- Server running on `http://localhost:3000` (or your configured port)
- PostgreSQL database connected
- Postman installed
- **Prisma Studio running** to get UUIDs for requests and verify register emails

## ⚠️ IMPORTANT: Setup Required Before Testing

### 🔍 Step 1: Start Prisma Studio

**ALWAYS run this first to get the UUIDs you need:**

```bash
npx prisma studio
```

This opens Prisma Studio at `http://localhost:5555` where you can:

- View existing users and get their UUIDs for `x-test-user-id` header
- View existing auctions and get their UUIDs for request bodies
- View participants, bids, and other data relationships

### 🔑 Step 2: Required Headers for ALL Requests

**Every API request (except registration) requires BOTH:**

1. **JWT Token**: `Authorization: Bearer YOUR_JWT_TOKEN`
2. **User ID Header**: `x-test-user-id: USER_UUID_FROM_PRISMA_STUDIO`

⚠️ **Note**: The `x-test-user-id` header is kept for fast testing even after JWT fix. You can get user UUIDs from Prisma Studio.

## 🔧 Environment Configuration

**Use your `.env` file to configure the server and testing setup:**

Reference the `.env.example` file for all available environment variables.

**Key variables for API testing:**

- `PORT` - Server port (default: 3000)
- `DATABASE_URL` - Database connection
- `JWT_SECRET` - For token verification
- `CORS_ORIGIN` - For cross-origin requests

**Testing with Different Environments:**

- **Development**: `http://localhost:3000/api` (or your configured port)
- **Staging**: Update your `.env` to point to staging database/settings
- **Production**: Use production `.env` configuration (with caution)## ⚠️ IMPORTANT: API Base URL

**All API endpoints use `/api` prefix!**

## 🔐 Authentication Flow

### 1. Register New User

**Method**: `POST`  
**URL**: `http://localhost:3000/api/auth/register`  
**Headers**:

```json
{
  "Content-Type": "application/json"
}
```

**Body** (JSON):

```json
{
  "email": "testuser@example.com",
  "password": "SecurePassword123!",
  "full_name": "John Doe",
  "phone_number": "0123456789",
  "identity_number": "001234567890",
  "user_type": "individual"
}
```

**Field Requirements**:

- `password`: Min 8 chars, must have uppercase, lowercase, and number
- `phone_number`: Vietnamese format starting with 0 (10 digits)
- `identity_number`: Vietnamese CCCD format
- `user_type`: "individual" or "business"

**Expected Response**:

```json
{
  "user_id": "uuid-string",
  "email": "testuser@example.com",
  "verification_required": true
}
```

### 2. Login User

**Method**: `POST`  
**URL**: `http://localhost:3000/api/auth/login`  
**Headers**:

```json
{
  "Content-Type": "application/json"
}
```

**Body** (JSON):

```json
{
  "email": "testuser@example.com",
  "password": "SecurePassword123!"
}
```

**Expected Response**:

```json
{
  "access_token": "jwt-token-string",
  "refresh_token": "refresh-token-string",
  "expires_in": 3600,
  "user": {
    "id": "uuid-string",
    "email": "testuser@example.com",
    "fullName": "John Doe"
  }
}
```

### 3. Get User Info

**Method**: `GET`  
**URL**: `http://localhost:3000/api/auth`  
**Headers**:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
}
```

## 🏠 Auction Registration Flow

### 4. Register to Bid on Auction

**Method**: `POST`  
**URL**: `http://localhost:3000/api/register-to-bid`  
**Headers**:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE",
  "x-test-user-id": "USER_UUID_FROM_PRISMA_STUDIO",
  "Content-Type": "application/json"
}
```

**Body** (JSON):

```json
{
  "auctionId": "auction-uuid-here"
}
```

**Expected Response**:

```json
{
  "success": true,
  "message": "Request successful",
  "data": {
    "id": "participant-uuid",
    "auctionId": "auction-uuid",
    "userId": "user-uuid",
    "registeredAt": "2025-11-13T10:00:00.000Z"
  },
  "meta": {},
  "timestamp": "2025-11-13T10:00:00.000Z",
  "path": "/api/register-to-bid"
}
```

### 5. Withdraw Registration

**Method**: `POST`  
**URL**: `http://localhost:3000/api/register-to-bid/withdraw`  
**Headers**:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE",
  "Content-Type": "application/json"
}
```

**Body** (JSON):

```json
{
  "auctionId": "auction-uuid-here",
  "withdrawalReason": "Changed my mind about participating"
}
```

**Expected Response**:

```json
{
  "success": true,
  "message": "Request successful",
  "data": {
    "id": "participant-uuid",
    "withdrawnAt": "2025-11-13T11:00:00.000Z",
    "withdrawalReason": "Changed my mind about participating"
  },
  "meta": {},
  "timestamp": "2025-11-13T11:00:00.000Z",
  "path": "/api/register-to-bid/withdraw"
}
```

### 6. Approve Registration (Admin/Auctioneer Only)

**Method**: `POST`  
**URL**: `http://localhost:3000/api/register-to-bid/admin/approve`  
**Headers**:

```json
{
  "Authorization": "Bearer ADMIN_JWT_TOKEN_HERE",
  "x-test-user-id": "ADMIN_USER_UUID",
  "Content-Type": "application/json"
}
```

**Body** (JSON):

```json
{
  "participantId": "participant-uuid-here"
}
```

**Expected Response**:

```json
{
  "id": "participant-uuid",
  "userId": "user-uuid",
  "auctionId": "auction-uuid",
  "registeredAt": "2025-11-13T10:00:00.000Z",
  "submittedAt": "2025-11-13T10:05:00.000Z",
  "confirmedAt": "2025-11-13T15:30:00.000Z",
  "rejectedAt": null,
  "rejectedReason": null,
  "checkedInAt": null,
  "withdrawnAt": null,
  "withdrawalReason": null,
  "currentState": "CONFIRMED"
}
```

### 8. List All Registrations with Pagination (Admin/Auctioneer Only)

**Method**: `GET`  
**URL**: `http://localhost:3000/api/register-to-bid/admin/registrations`  
**Headers**:

```json
{
  "Authorization": "Bearer ADMIN_JWT_TOKEN_HERE",
  "x-test-user-id": "admin-user-uuid"
}
```

**Query Parameters** (optional):

- `page` (default: 1) - Page number
- `limit` (default: 10) - Items per page
- `status` - Filter by status: `all`, `pending_review`, `confirmed`, `rejected`, `withdrawn`
- `auctionId` - Filter by specific auction UUID

**Example URL with params**:

```
http://localhost:3000/api/register-to-bid/admin/registrations?page=1&limit=20&status=pending_review&auctionId=auction-uuid-here
```

**Expected Response**:

```json
{
  "data": [
    {
      "id": "participant-uuid",
      "userId": "user-uuid",
      "auctionId": "auction-uuid",
      "registeredAt": "2025-11-13T10:00:00.000Z",
      "submittedAt": "2025-11-13T10:05:00.000Z",
      "confirmedAt": null,
      "rejectedAt": null,
      "rejectedReason": null,
      "checkedInAt": null,
      "withdrawnAt": null,
      "withdrawalReason": null,
      "currentState": "PENDING_REVIEW",
      "user": {
        "email": "user@example.com",
        "fullName": "John Doe",
        "phoneNumber": "0123456789"
      },
      "auction": {
        "name": "Test Auction",
        "code": "AUC001"
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### 9. Reject Registration (Admin/Auctioneer Only)

**Method**: `POST`  
**URL**: `http://localhost:3000/api/register-to-bid/admin/reject`  
**Headers**:

```json
{
  "Authorization": "Bearer ADMIN_JWT_TOKEN_HERE",
  "x-test-user-id": "admin-user-uuid",
  "Content-Type": "application/json"
}
```

**Body** (JSON):

```json
{
  "participantId": "participant-uuid-here",
  "rejectionReason": "Incomplete documentation or fraud detected"
}
```

**Expected Response**:

```json
{
  "id": "participant-uuid",
  "userId": "user-uuid",
  "auctionId": "auction-uuid",
  "registeredAt": "2025-11-13T10:00:00.000Z",
  "submittedAt": "2025-11-13T10:05:00.000Z",
  "confirmedAt": null,
  "rejectedAt": "2025-11-13T16:00:00.000Z",
  "rejectedReason": "Incomplete documentation or fraud detected",
  "checkedInAt": null,
  "withdrawnAt": null,
  "withdrawalReason": null,
  "currentState": "REJECTED"
}
```

**Method**: `GET`  
**URL**: `http://localhost:3000/api/register-to-bid/admin/users/{userId}/registrations`  
**Headers**:

```json
{
  "Authorization": "Bearer ADMIN_JWT_TOKEN_HERE",
  "x-test-user-id": "admin-user-uuid"
}
```

## 💰 Manual Bidding Flow

### 10. Place Manual Bid

**Method**: `POST`  
**URL**: `http://localhost:3000/api/manual-bid`  
**Headers**:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE",
  "x-test-user-id": "user-uuid",
  "Content-Type": "application/json"
}
```

**Body** (JSON):

```json
{
  "auctionId": "auction-uuid-here",
  "amount": 1000000000
}
```

**Expected Response**:

```json
{
  "success": true,
  "message": "Request successful",
  "data": {
    "bidId": "bid-uuid",
    "auctionId": "auction-uuid",
    "participantId": "participant-uuid",
    "userId": "user-uuid",
    "amount": "1000000000",
    "bidAt": "2025-11-13T12:00:00.000Z",
    "bidType": "manual",
    "isWinningBid": true
  },
  "meta": {},
  "timestamp": "2025-11-13T12:00:00.000Z",
  "path": "/api/manual-bid"
}
```

### 11. Deny Bid (Auctioneer Only)

**Method**: `POST`  
**URL**: `http://localhost:3000/api/manual-bid/deny`  
**Headers**:

```json
{
  "Authorization": "Bearer ADMIN_JWT_TOKEN_HERE",
  "Content-Type": "application/json"
}
```

**Body** (JSON):

```json
{
  "bidId": "bid-uuid-here",
  "reason": "Fraudulent activity detected"
}
```

**Expected Response**:

```json
{
  "success": true,
  "message": "Request successful",
  "data": {
    "bidId": "bid-uuid",
    "isDenied": true,
    "deniedReason": "Fraudulent activity detected",
    "isWinningBid": false,
    "deniedAt": "2025-11-13T13:00:00.000Z"
  },
  "meta": {},
  "timestamp": "2025-11-13T13:00:00.000Z",
  "path": "/api/manual-bid/deny"
}
```

## 🏁 Auction Finalization Flow

### 12. Evaluate Auction Status (Admin Only)

**Method**: `GET`  
**URL**: `http://localhost:3000/api/auction-finalization/evaluate/{auctionId}`  
**Headers**:

```json
{
  "Authorization": "Bearer ADMIN_JWT_TOKEN_HERE"
}
```

**Expected Response**:

```json
{
  "success": true,
  "message": "Request successful",
  "data": {
    "currentStatus": "live",
    "recommendedStatus": "success",
    "hasWinner": true,
    "totalBids": 5,
    "winningAmount": "1200000000",
    "winner": {
      "userId": "winner-user-uuid",
      "participantId": "winner-participant-uuid",
      "bidAmount": "1200000000"
    }
  },
  "meta": {},
  "timestamp": "2025-11-13T13:00:00.000Z",
  "path": "/api/auction-finalization/evaluate/{auctionId}"
}
```

### 13. Finalize Auction (Auction Owner Only)

**Method**: `POST`  
**URL**: `http://localhost:3000/api/auction-finalization/finalize`  
**Headers**:

```json
{
  "Authorization": "Bearer AUCTION_OWNER_JWT_TOKEN_HERE",
  "Content-Type": "application/json"
}
```

**Body** (JSON):

```json
{
  "auctionId": "auction-uuid-here",
  "notes": "Auction completed successfully",
  "skipAutoEvaluation": false
}
```

**Optional Fields**:

- `winningBidId`: Override winner selection
- `notes`: Additional notes for finalization
- `skipAutoEvaluation`: Skip automatic evaluation

**Expected Response**:

```json
{
  "success": true,
  "message": "Request successful",
  "data": {
    "auctionId": "auction-uuid",
    "finalStatus": "success",
    "winner": {
      "userId": "winner-user-uuid",
      "participantId": "winner-participant-uuid",
      "winningAmount": "1200000000"
    },
    "contract": {
      "id": "contract-uuid",
      "buyerUserId": "winner-user-uuid",
      "sellerUserId": "auction-owner-uuid",
      "price": "1200000000",
      "status": "draft"
    },
    "notes": "Auction completed successfully"
  },
  "meta": {},
  "timestamp": "2025-11-13T14:00:00.000Z",
  "path": "/api/auction-finalization/finalize"
}
```

### 14. Override Auction Status (Admin Only)

**Method**: `POST`  
**URL**: `http://localhost:3000/api/auction-finalization/override`  
**Headers**:

```json
{
  "Authorization": "Bearer ADMIN_JWT_TOKEN_HERE",
  "Content-Type": "application/json"
}
```

**Body** (JSON):

```json
{
  "auctionId": "auction-uuid-here",
  "newStatus": "cancelled",
  "reason": "Fraud detected during investigation"
}
```

**Expected Response**:

```json
{
  "success": true,
  "message": "Request successful",
  "data": {
    "auctionId": "auction-uuid",
    "previousStatus": "live",
    "newStatus": "cancelled",
    "reason": "Fraud detected during investigation",
    "overriddenAt": "2025-11-13T14:00:00.000Z",
    "performedBy": "admin-user-uuid"
  },
  "meta": {},
  "timestamp": "2025-11-13T14:00:00.000Z",
  "path": "/api/auction-finalization/override"
}
```

### 15. Get Auction Results

**Method**: `GET`  
**URL**: `http://localhost:3000/api/auction-finalization/results/{auctionId}`  
**Headers**:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
}
```

**Expected Response**:

```json
{
  "success": true,
  "message": "Request successful",
  "data": {
    "auction": {
      "id": "auction-uuid",
      "code": "AUC001",
      "name": "Test Auction",
      "status": "success"
    },
    "winner": {
      "userId": "winner-user-uuid",
      "fullName": "Winner Name",
      "winningAmount": "1200000000"
    },
    "allBids": [],
    "userBids": [],
    "contract": {
      "id": "contract-uuid",
      "status": "draft",
      "price": "1200000000"
    }
  },
  "meta": {},
  "timestamp": "2025-11-13T15:00:00.000Z",
  "path": "/api/auction-finalization/results/{auctionId}"
}
```

### 16. Get Audit Logs (Auction Owner)

**Method**: `GET`  
**URL**: `http://localhost:3000/api/auction-finalization/audit-logs/{auctionId}`  
**Headers**:

```json
{
  "Authorization": "Bearer AUCTION_OWNER_JWT_TOKEN_HERE"
}
```

**Expected Response**:

```json
{
  "success": true,
  "message": "Request successful",
  "data": [
    {
      "id": "log-uuid",
      "auctionId": "auction-uuid",
      "action": "AUCTION_FINALIZED",
      "performedBy": "user-uuid",
      "performedAt": "2025-11-13T15:00:00.000Z",
      "reason": null,
      "metadata": {}
    }
  ],
  "meta": {},
  "timestamp": "2025-11-13T15:00:00.000Z",
  "path": "/api/auction-finalization/audit-logs/{auctionId}"
}
```

## 📝 Test User Types

### Create Test Users with Different Roles:

**Regular User** (for bidding):

```json
{
  "email": "bidder@test.com",
  "password": "Password123!",
  "full_name": "Test Bidder",
  "phone_number": "0987654321",
  "identity_number": "001987654321",
  "user_type": "individual"
}
```

**Auctioneer** (for finalizing auctions):

```json
{
  "email": "auctioneer@test.com",
  "password": "Password123!",
  "full_name": "Test Auctioneer",
  "phone_number": "0123456789",
  "identity_number": "001234567890",
  "user_type": "business"
}
```

**Admin** (for admin operations):

```json
{
  "email": "admin@test.com",
  "password": "Password123!",
  "full_name": "Test Admin",
  "phone_number": "0555666777",
  "identity_number": "001555666777",
  "user_type": "business"
}
```

## ⚠️ Important Notes

### Registration Management States:

- **REGISTERED**: User initiated registration (registeredAt set)
- **PENDING_REVIEW**: Documents submitted (submittedAt set)
- **CONFIRMED**: Admin approved (confirmedAt set)
- **REJECTED**: Admin rejected (rejectedAt set + reason)
- **WITHDRAWN**: User withdrew (withdrawnAt set + reason)

### Field Names to Remember:

- Use `participantId` (not `id`) in admin approval/rejection requests
- Use `bidId` (not `id`) in bid responses
- Use `withdrawalReason` (not `reason`) in withdrawal requests
- Use `rejectionReason` in admin rejection requests

### Authorization Matrix:

- **Regular Users**: Can register, withdraw, bid
- **Auction Owners**: Can finalize their own auctions
- **Auctioneers**: Can approve/reject registrations, deny bids, finalize auctions
- **Admins**: All auctioneer permissions + evaluate, override status

### API Response Notes:

- **Auth endpoints** return direct response (tokens at root level)
- **All other endpoints** use the response wrapper format with `success`, `data`, `meta`, etc.
- **x-test-user-id header** is maintained for fast testing alongside JWT

### Common Error Responses:

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "details": "Validation error details"
}
```

```json
{
  "statusCode": 403,
  "message": "Forbidden - Insufficient permissions"
}
```

## 🧪 Testing Sequence

1. **Setup**: Register users → Login → Get tokens
2. **Registration**: Register to bid on auction
3. **Admin Review**:
   - List all registrations (endpoint 8)
   - Get specific user registrations (endpoint 7)
   - Approve registrations (endpoint 6) OR Reject registrations (endpoint 9)
4. **Bidding**: Place bids → Test increments
5. **Admin**: Evaluate auction → Deny bids if needed
6. **Finalization**: Owner finalizes → Check results
7. **Cleanup**: Withdraw registrations if needed

## 🆕 New Admin Registration Management Workflow

### Registration States Flow:

1. **REGISTERED** - User initiates registration
2. **PENDING_REVIEW** - Documents submitted, awaiting admin approval
3. **CONFIRMED** - Admin approved, user can bid
4. **REJECTED** - Admin rejected, user can re-apply
5. **WITHDRAWN** - User withdrew registration

### Admin Testing Steps:

1. User registers for auction (creates PENDING_REVIEW state)
2. Admin lists all pending registrations
3. Admin either approves or rejects with reason
4. If rejected, user can re-register (creates new submission)
5. If approved, user can proceed to bidding

## 🔧 Troubleshooting

### Common Issues:

#### 1. "Cannot POST /auth/register" (404 Error)

**Problem**: Missing `/api` prefix
**Solution**: Use `http://localhost:3000/api/auth/register` instead of `http://localhost:3000/auth/register`

#### 2. Server Port Issues

**Problem**: Server running on different port
**Solution**:

1. Check your `.env` file for `PORT` variable
2. Look for server startup log: `🚀 Application is running on: http://localhost:{PORT}/api`
3. Update all URLs accordingly

#### 3. Admin Operations Failing (403 Forbidden)

**Problem**: Wrong token or missing roles
**Solution**:

1. Ensure user has ADMIN, AUCTIONEER, or SUPER_ADMIN role
2. Use admin user's JWT token instead of regular user token
3. Check `x-test-user-id` points to admin user UUID

#### 2. Login Returns Wrapped Response Instead of Tokens

**Problem**: Response interceptor wrapping auth responses
**Symptoms**: Getting `{"success": true, "data": "", ...}` instead of JWT tokens
**Solution**: Updated response interceptor to exclude auth endpoints

#### 3. Server Not Running

**Check**:

```bash
# Start the server
npm run start:dev
# or
npx nx serve server
```

#### 4. Database Connection Issues

**Check**:

- PostgreSQL is running on port 5432
- Environment variables are set correctly
- Database exists and migrations are run

#### 5. Port Issues

**Check**: Server might be running on different port

- Look for log: `🚀 Application is running on: http://localhost:{PORT}/api`
- Update base URL accordingly

#### 6. CORS Issues

If testing from browser/frontend:

```bash
# Add CORS configuration to main.ts
app.enableCors();
```

### Quick Verification:

**1. Test server is running:**

```
GET: http://localhost:3000/api/
```

Should return basic app info.

**2. Test health endpoint:**

```
GET: http://localhost:3000/api/health
```

Should return health status.

## 🚨 Critical Validation Notes

### Registration DTO Validation:

- ✅ **phone_number**: Must be Vietnamese format: `"0987654321"` (NOT `"+84987654321"`)
- ✅ **identity_number**: Must be Vietnamese CCCD: `"001234567890"` (12 digits starting with specific codes)
- ✅ **password**: Must contain uppercase, lowercase, and number
- ✅ **user_type**: Only `"individual"` or `"business"`

### Bid Amount:

- ✅ **amount**: Must be number (not string): `1000000000`
- ✅ **auctionId**: Must be valid UUID

### Field Names (Critical):

- ✅ Use `bidId` in responses (not `id`)
- ✅ Use `withdrawalReason` in withdrawal requests (not `reason`)

### Available Auction Statuses:

- `"scheduled"`, `"live"`, `"success"`, `"no_bid"`, `"cancelled"`

Happy Testing! 🚀
