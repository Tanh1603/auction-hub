# 🚀 Postman API Testing Guide - Auction Hub

## 📋 Prerequisites

- Server running on `http://localhost:3000` (or your configured port)
- PostgreSQL database connected
- Postman installed
- **Prisma Studio running** to get UUIDs for requests and verify data

## ⚠️ IMPORTANT: Setup Required Before Testing

### 🔍 Step 1: Start Prisma Studio

**ALWAYS run this first to get the UUIDs you need:**

```bash
npx prisma studio
```

This opens Prisma Studio at `http://localhost:5555` where you can:

- View existing users and get their UUIDs
- View existing auctions and get their UUIDs for request bodies
- View participants, bids, and other data relationships
- Manually promote users to admin role (for bootstrapping first admin)

### 🔑 Step 2: Required Headers for Most Requests

**Most API requests require:**

1. **JWT Token**: `Authorization: Bearer YOUR_JWT_TOKEN`

⚠️ **Note**: The `x-test-user-id` header is NOT required in production. Use proper JWT authentication.

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
- **Production**: Use production `.env` configuration (with caution)

## ⚠️ IMPORTANT: API Base URL

**All API endpoints use `/api` prefix!**

---

# 📖 Complete Testing Flow Guide

This guide follows the **complete user journey** from signup to final payment:

1. **User Signup** → Register a new user account
2. **Promote to Admin** → Bootstrap first admin (manual DB update), then promote others via API
3. **User Login** → Authenticate and get JWT token
4. **Register to Bid** → User registers for an auction with documents
5. **Admin: Verify or Reject Documents** → Tier 1 approval (admin reviews documents)
6. **User: Re-apply if Rejected** → User can resubmit after rejection
7. **User: Pay Deposit** → After documents verified, user pays deposit
8. **Admin: Final Approval** → Tier 2 approval after deposit paid
9. **User: Check In** → User checks in before auction starts (required to bid)
10. **User: Place Bids** → User can now bid on auction
11. **Admin: Evaluate Auction** → Check auction status and determine winner
12. **Admin: Finalize Auction** → Close auction and declare winner
13. **Winner: Pay Final Amount** → Winner completes payment within 7 days
14. **System: Verify Winner Payment** → Contract ready after payment verification

---

## 🔐 Authentication Flow

### 1. Register New User (Signup)

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
- `identity_number`: Vietnamese CCCD format (12 digits)
- `user_type`: "individual" or "business"

**Expected Response**:

```json
{
  "user_id": "uuid-string",
  "email": "testuser@example.com",
  "verification_required": true
}
```

**Note**: By default, new users get the **"bidder"** role.

### 2. Promote User to Admin (Bootstrap First Admin)

**For the FIRST admin**, you must manually update the database:

**Using Prisma Studio** (Recommended):

1. Open Prisma Studio: `npx prisma studio`
2. Navigate to the `users` table
3. Find your user by email
4. Edit the `role` field to `"admin"` or `"super_admin"`
5. Save changes

**Using SQL** (Alternative):

```sql
UPDATE users SET role = 'super_admin' WHERE email = 'testuser@example.com';
```

**For subsequent admins**, use the API endpoint below (must be logged in as admin):

**Method**: `PUT`  
**URL**: `http://localhost:3000/api/auth/admin/users/:userId/promote`  
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
  "role": "auctioneer",
  "reason": "Verified credentials and granted auctioneer privileges"
}
```

**Available Roles**:

- `bidder` - Regular user who can bid (default)
- `auctioneer` - Can manage auctions, approve registrations
- `admin` - Can promote users to bidder/auctioneer, manage system
- `super_admin` - Can promote to any role including admin

**Role Hierarchy Rules**:

- **Super Admin**: Can promote to any role
- **Admin**: Can promote to bidder/auctioneer only (NOT to admin/super_admin)
- **Auctioneer**: Cannot promote users
- **Bidder**: Cannot promote users

**Expected Response**:

```json
{
  "message": "User promoted to auctioneer successfully",
  "user": {
    "id": "user-uuid",
    "email": "anotheruser@example.com",
    "fullName": "Jane Smith",
    "role": "auctioneer"
  }
}
```

### 3. Login User

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
    "fullName": "John Doe",
    "role": "bidder"
  }
}
```

**⚠️ Important**: Save the `access_token` - you'll need it for all subsequent authenticated requests!

### 4. Get Current User Info

**Method**: `GET`  
**URL**: `http://localhost:3000/api/auth/me`  
**Headers**:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
}
```

**Expected Response**:

```json
{
  "id": "uuid-string",
  "email": "testuser@example.com",
  "fullName": "John Doe",
  "role": "bidder",
  "phoneNumber": "0123456789",
  "isVerified": true,
  "isBanned": false
}
```

## 🏠 Auction Registration Flow (Two-Tier Approval System)

### Overview of Two-Tier Approval Process

The auction registration follows a **two-tier approval system** with automated email notifications at each step:

**Complete Flow:**

1. **User Registration with Documents** → User registers and submits documents in one request
2. **Tier 1: Document Verification** → Admin verifies documents ✉️ Email sent to user
3. **Deposit Payment** → User pays deposit within 24 hours ✉️ Email sent on verification
4. **Tier 2: Final Approval** → Admin gives final approval ✉️ Email sent to user
5. **User Check-In** → User checks in 24 hours before auction (required to bid)
6. **Ready to Bid** → User can now participate in auction

**Alternative Paths:**

- **Document Rejection** → Admin rejects → User can re-apply with updated documents
- **Registration Withdrawal** → User withdraws → Can re-apply later

**Email Notifications Sent:**

- 📧 After document verification (Tier 1) - user receives payment instructions
- 📧 After deposit payment confirmation - user + admins notified
- 📧 After final approval (Tier 2) - user can now bid
- 📧 Payment failure/deadline warnings

### 5. Register to Bid on Auction (with Documents & Media Upload)

**Method**: `POST`
**URL**: `http://localhost:3000/api/register-to-bid`
**Headers**:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
}
```

**Body** (form-data):

This endpoint uses `multipart/form-data` for file uploads. Configure in Postman:

1. Select **Body** tab
2. Select **form-data** radio button
3. Add the following fields:

| Key         | Type | Value                                  |
| ----------- | ---- | -------------------------------------- |
| `auctionId` | Text | `auction-uuid-here`                    |
| `documents` | File | Select PDF/DOC file (identity card)    |
| `documents` | File | Select PDF/DOC file (financial proof)  |
| `documents` | File | Select PDF/DOC file (business license) |
| `media`     | File | Select image/video file (optional)     |
| `media`     | File | Select image/video file (optional)     |

**File Requirements**:

- **Documents**: PDF, DOC, DOCX formats
- **Media**: Images (JPG, PNG) or Videos
- **Max file size**: 10MB per file
- **Max count**: 10 files per field (documents and media each)

**Document Types** (recommended):

- Identity card/National ID or passport
- Financial proof (bank statements or financial documents)
- Business license (for business entities)
- Address proof (utility bills or residence documents)

**Expected Response**:

```json
{
  "success": true,
  "message": "Request successful",
  "data": {
    "id": "participant-uuid",
    "auctionId": "auction-uuid",
    "userId": "user-uuid",
    "registeredAt": "2025-11-14T10:00:00.000Z",
    "submittedAt": "2025-11-14T10:00:00.000Z",
    "currentState": "PENDING_DOCUMENT_REVIEW",
    "documents": [
      {
        "url": "https://res.cloudinary.com/your-cloud/documents/abc123.pdf",
        "publicId": "auction-hub/documents/abc123",
        "sortOrder": 0
      },
      {
        "url": "https://res.cloudinary.com/your-cloud/documents/def456.pdf",
        "publicId": "auction-hub/documents/def456",
        "sortOrder": 1
      }
    ],
    "media": [
      {
        "url": "https://res.cloudinary.com/your-cloud/media/xyz789.jpg",
        "publicId": "auction-hub/media/xyz789",
        "sortOrder": 0
      }
    ]
  },
  "meta": {},
  "timestamp": "2025-11-14T10:00:00.000Z",
  "path": "/api/register-to-bid"
}
```

**Notes**:

- Files are automatically uploaded to Cloudinary
- Documents and media are stored as JSONB in the database
- Documents are submitted immediately with registration
- Registration enters `PENDING_DOCUMENT_REVIEW` state automatically
- User cannot bid until final approval is received
- If upload fails, the entire registration will fail
- Both documents and media fields are optional but at least one is recommended for document verification

### 6. Withdraw Registration (User)

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
    "withdrawnAt": "2025-11-14T11:00:00.000Z",
    "withdrawalReason": "Changed my mind about participating",
    "currentState": "WITHDRAWN"
  },
  "meta": {},
  "timestamp": "2025-11-14T11:00:00.000Z",
  "path": "/api/register-to-bid/withdraw"
}
```

**Note**: User can re-apply after withdrawal by submitting a new registration.

### 7. Verify Documents - Tier 1 Approval (Admin/Auctioneer Only)

**Method**: `POST`
**URL**: `http://localhost:3000/api/register-to-bid/admin/verify-documents`
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
  "registrationId": "registration-uuid-here"
}
```

**⚠️ Note**: `registrationId` is the **registration ID** (from the AuctionParticipant table), not the user ID. Get this ID from the registration list or from the registration response when a user registers.

**Expected Response**:

```json
{
  "success": true,
  "message": "Documents verified successfully",
  "data": {
    "id": "participant-uuid",
    "documentsVerifiedAt": "2025-11-14T10:30:00.000Z",
    "documentsVerifiedBy": "admin-uuid",
    "currentState": "DOCUMENTS_VERIFIED"
  }
}
```

**📧 Email Sent**: User receives "Documents Verified" email with deposit payment instructions and 24-hour deadline.

### 8. Reject Documents - Tier 1 Rejection (Admin/Auctioneer Only)

**Method**: `POST`
**URL**: `http://localhost:3000/api/register-to-bid/admin/reject-documents`
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
  "registrationId": "registration-uuid-here",
  "reason": "Documents are incomplete or unclear. Please provide: clear ID photo, bank statement from last 3 months"
}
```

**⚠️ Note**: `registrationId` is the **registration ID** (from the AuctionParticipant table), not the user ID.

**Expected Response**:

```json
{
  "success": true,
  "message": "Documents rejected",
  "data": {
    "id": "participant-uuid",
    "documentsRejectedAt": "2025-11-14T10:30:00.000Z",
    "documentsRejectedReason": "Documents are incomplete or unclear. Please provide: clear ID photo, bank statement from last 3 months",
    "currentState": "DOCUMENTS_REJECTED"
  }
}
```

**Note**: After rejection, user can re-apply by submitting a new registration with updated documents.

### 9. Re-Apply After Rejection (User)

**Method**: `POST`
**URL**: `http://localhost:3000/api/register-to-bid`
**Headers**:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
}
```

**Body** (form-data):

This endpoint uses the same format as the initial registration. Configure in Postman:

1. Select **Body** tab
2. Select **form-data** radio button
3. Add the following fields:

| Key         | Type | Value                                 |
| ----------- | ---- | ------------------------------------- |
| `auctionId` | Text | `auction-uuid-here`                   |
| `documents` | File | Select updated PDF/DOC file           |
| `documents` | File | Select updated PDF/DOC file           |
| `media`     | File | Select updated image/video (optional) |

**Expected Response**:

```json
{
  "success": true,
  "message": "Documents resubmitted successfully",
  "data": {
    "id": "participant-uuid",
    "submittedAt": "2025-11-14T12:00:00.000Z",
    "currentState": "PENDING_DOCUMENT_REVIEW",
    "documentsRejectedAt": null,
    "documentsRejectedReason": null,
    "documents": [
      {
        "url": "https://res.cloudinary.com/your-cloud/documents/new123.pdf",
        "publicId": "auction-hub/documents/new123",
        "sortOrder": 0
      }
    ],
    "media": []
  }
}
```

**Note**: The system automatically detects this is a re-submission and clears the rejection data. New files will be uploaded to Cloudinary.

### 10. Initiate Deposit Payment (User)

**After documents are verified, user initiates deposit payment.**

**Method**: `POST`
**URL**: `http://localhost:3000/api/register-to-bid/submit-deposit`
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
  "registrationId": "registration-uuid-here",
  "auctionId": "auction-uuid-here",
  "amount": 50000000
}
```

**⚠️ Note**: `registrationId` is the **registration ID** (from the AuctionParticipant table), not the user ID.

**Expected Response**:

```json
{
  "paymentId": "cs_test_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0",
  "amount": 50000000,
  "paymentUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "bankInfo": {
    "bank_name": "Stripe",
    "account_number": "Stripe",
    "account_name": "Auction Hub",
    "transfer_content": "Payment for deposit"
  },
  "deadline": "2025-11-17T14:00:00.000Z",
  "status": "pending",
  "message": "Deposit payment initiated. Please complete payment within deadline."
}
```

**Next Steps**:

1. Open `paymentUrl` in browser or scan `qrCode`
2. Complete payment using Stripe test card: `4242 4242 4242 4242`
3. After payment, call verify endpoint (see next section)

**📧 Emails Sent**:

- User receives "Deposit Payment Initiated" email with payment link

**⚠️ Important**: User must complete payment within 24 hours or registration will be automatically cancelled.

### 10a. Verify Deposit Payment (User)

**After completing Stripe payment, verify the payment.**

**Method**: `POST`
**URL**: `http://localhost:3000/api/register-to-bid/verify-deposit-payment`
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
  "sessionId": "cs_test_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0",
  "registrationId": "registration-uuid-here"
}
```

**⚠️ Note**: `sessionId` is the `paymentId` returned from the initiate deposit payment endpoint.

**Expected Response**:

```json
{
  "verified": true,
  "paymentId": "payment-uuid",
  "sessionId": "cs_test_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0",
  "amount": 50000000,
  "status": "completed",
  "message": "Deposit payment verified successfully. Awaiting final admin approval."
}
```

**📧 Emails Sent**:

- User receives "Deposit Confirmed" email
- All admins receive "New Deposit Payment" notification for final approval

### 11. Final Approval - Tier 2 Approval (Admin/Auctioneer Only)

**After deposit is paid, admin gives final approval.**

**Method**: `POST`
**URL**: `http://localhost:3000/api/register-to-bid/admin/final-approval`
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
  "registrationId": "registration-uuid-here"
}
```

**⚠️ Note**: `registrationId` is the **registration ID** (from the AuctionParticipant table), not the user ID.

**Expected Response**:

```json
{
  "success": true,
  "message": "Registration finally approved",
  "data": {
    "id": "participant-uuid",
    "userId": "user-uuid",
    "auctionId": "auction-uuid",
    "confirmedAt": "2025-11-14T12:00:00.000Z",
    "currentState": "CONFIRMED"
  }
}
```

**📧 Email Sent**: User receives "Registration Approved - Ready to Bid" email with auction start time and bidding guidelines.

**✅ User is now eligible to place bids!**

### 12. Check In for Auction (User)

**User must check in before placing bids. Check-in window opens 24 hours before auction starts.**

**Method**: `POST`
**URL**: `http://localhost:3000/api/register-to-bid/check-in`
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
    "userId": "user-uuid",
    "auctionId": "auction-uuid",
    "checkedInAt": "2025-11-14T12:30:00.000Z",
    "currentState": "CHECKED_IN"
  },
  "meta": {},
  "timestamp": "2025-11-14T12:30:00.000Z",
  "path": "/api/register-to-bid/check-in"
}
```

**Business Rules**:

- ✅ Registration must be CONFIRMED (final approval received)
- ✅ Check-in window: 24 hours before auction starts → auction ends
- ✅ Cannot check in if registration rejected or withdrawn
- ✅ Cannot check in twice
- ✅ **Required before placing any bids**

**Error Scenarios**:

```json
{
  "statusCode": 403,
  "message": "Check-in window has not opened yet. You can check in starting 24 hours before the auction."
}
```

```json
{
  "statusCode": 403,
  "message": "Your registration must be confirmed before check-in"
}
```

```json
{
  "statusCode": 409,
  "message": "You have already checked in"
}
```

**💡 Tip**: Check in as close to auction start as possible to ensure you're ready to bid!

### 13. List All Registrations with Pagination (Admin/Auctioneer Only)

**Method**: `GET`  
**URL**: `http://localhost:3000/api/register-to-bid/admin/registrations`  
**Headers**:

```json
{
  "Authorization": "Bearer ADMIN_JWT_TOKEN_HERE"
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

**🔍 Use this endpoint to get Registration IDs**: The `id` field in each registration object is the `registrationId` you need for approval/rejection endpoints.

**Expected Response**:

```json
{
  "data": [
    {
      "id": "registration-uuid-12345",
      "userId": "user-uuid",
      "auctionId": "auction-uuid",
      "registeredAt": "2025-11-14T10:00:00.000Z",
      "submittedAt": "2025-11-14T10:05:00.000Z",
      "confirmedAt": null,
      "documentsVerifiedAt": null,
      "documentsRejectedAt": null,
      "depositPaidAt": null,
      "currentState": "PENDING_DOCUMENT_REVIEW",
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

**💡 Key Fields**:

- `id`: **This is the registration ID** (use as `registrationId` in approval/rejection requests)
- `userId`: The user who made this registration
- `currentState`: Current registration status

### 14. Get User's Registrations

**Method**: `GET`  
**URL**: `http://localhost:3000/api/register-to-bid/users/{userId}/registrations`  
**Headers**:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
}
```

**Expected Response**: Array of registration objects for the specified user.
**Note**: Admins can view any user's registrations. Users can only view their own.

### 14a. Get Registration for Auction

**Method**: `GET`
**URL**: `http://localhost:3000/api/register-to-bid/auctions/{auctionId}/registration`
**Headers**:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
}
```

**Expected Response**: Registration object for the specified auction.

## 💰 Manual Bidding Flow

### 15. Place Manual Bid

**Only users with CONFIRMED registration AND who have CHECKED IN can place bids.**

**Method**: `POST`  
**URL**: `http://localhost:3000/api/manual-bid`  
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
    "bidAt": "2025-11-14T12:00:00.000Z",
    "bidType": "manual",
    "isWinningBid": true
  },
  "meta": {},
  "timestamp": "2025-11-14T12:00:00.000Z",
  "path": "/api/manual-bid"
}
```

**Notes**:

- Bid amount must meet the minimum increment rules
- User must have a CONFIRMED registration
- User must have CHECKED IN before placing bids
- `isWinningBid` indicates if this is currently the highest bid

**⚠️ Common Error**:

```json
{
  "statusCode": 403,
  "message": "You must check in before placing a bid"
}
```

**Solution**: Call the check-in endpoint (Section 12) before attempting to bid.

### 16. Deny Bid (Auctioneer, Admin)

**Admin/Auctioneer can deny suspicious or fraudulent bids.**

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
  "message": "Bid denied successfully",
  "data": {
    "bidId": "bid-uuid",
    "isDenied": true,
    "deniedReason": "Fraudulent activity detected",
    "isWinningBid": false,
    "deniedAt": "2025-11-14T13:00:00.000Z"
  },
  "meta": {},
  "timestamp": "2025-11-14T13:00:00.000Z",
  "path": "/api/manual-bid/deny"
}
```

## 🏁 Auction Finalization & Winner Payment Flow

### Overview of Winner Payment Process

The auction finalization process has been updated to ensure payment security. **The winner must complete payment BEFORE the auction can be finalized and the contract created.**

**Correct Flow:**

1. **Evaluate Auction** → Admin checks auction status and winner
2. **Finalize Auction** → Owner/Admin finalizes and declares winner
3. **Winner Receives Email** → Payment breakdown and deadline (7 days) ✉️
4. **Winner Submits Payment** → Via payment gateway
5. **Verify Winner Payment** → System verifies payment
6. **Payment Success** → Contract ready for signatures ✉️ Emails to winner, seller, admins
7. **Payment Failure** → Auto-retry or deposit forfeiture if deadline expires

**Payment Failure Handling:**

- If payment fails: Winner receives failure email with retry link
- If 7-day deadline expires:
  - Winner's deposit is forfeited
  - Property offered to 2nd highest bidder
  - If no 2nd bidder: Auction marked as "failed"

### 17. Evaluate Auction Status (Admin/Auctioneer Only)

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
  "timestamp": "2025-11-14T13:00:00.000Z",
  "path": "/api/auction-finalization/evaluate/{auctionId}"
}
```

### 18. Get Winner Payment Requirements

**Winner checks payment breakdown and deadline.**

**Method**: `GET`
**URL**: `http://localhost:3000/api/auction-finalization/winner-payment-requirements/{auctionId}`
**Headers**:

```json
{
  "Authorization": "Bearer WINNER_JWT_TOKEN_HERE"
}
```

**Expected Response**:

```json
{
  "success": true,
  "data": {
    "auctionId": "auction-uuid",
    "winner": {
      "userId": "winner-user-uuid",
      "fullName": "Winner Name",
      "email": "winner@example.com"
    },
    "paymentBreakdown": {
      "winningAmount": 1200000000,
      "depositAlreadyPaid": 50000000,
      "dossierFee": 10000000,
      "remainingAmount": 1150000000,
      "totalDue": 1160000000
    },
    "paymentDeadline": "2025-11-21T14:00:00.000Z",
    "daysRemaining": 7
  }
}
```

### 19. Initiate Winner Payment

**Winner initiates payment for the remaining amount.**

**Method**: `POST`
**URL**: `http://localhost:3000/api/auction-finalization/submit-winner-payment`
**Headers**:

```json
{
  "Authorization": "Bearer WINNER_JWT_TOKEN_HERE",
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
  "paymentId": "cs_test_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0",
  "amount": 1160000000,
  "breakdown": {
    "winningAmount": 1200000000,
    "depositAlreadyPaid": 50000000,
    "dossierFee": 10000000,
    "remainingAmount": 1150000000,
    "totalDue": 1160000000
  },
  "paymentUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
  "qrCode": "data:image/png;base64,...",
  "bankInfo": {
    "bank_name": "Stripe",
    "account_number": "Stripe",
    "account_name": "Auction Hub",
    "transfer_content": "Payment for winning_payment"
  },
  "deadline": "2025-11-23T14:00:00.000Z",
  "message": "Please complete payment to finalize the contract. Contract will be ready for signatures after payment confirmation."
}
```

### 20. Verify Winner Payment

**Winner verifies the payment after completion.**

**Method**: `POST`
**URL**: `http://localhost:3000/api/auction-finalization/verify-winner-payment`
**Headers**:

```json
{
  "Authorization": "Bearer WINNER_JWT_TOKEN_HERE",
  "Content-Type": "application/json"
}
```

**Body** (JSON):

```json
{
  "sessionId": "cs_test_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0",
  "auctionId": "auction-uuid-here"
}
```

**Expected Response**:

```json
{
  "success": true,
  "paymentVerified": true,
  "paymentId": "cs_test_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0",
  "amount": 1160000000,
  "contractId": "contract-uuid",
  "contractStatus": "signed",
  "contractReady": true,
  "message": "Payment verified successfully. Contract is ready for final signatures from both parties.",
  "nextSteps": ["1. Winner reviews and signs the contract", "2. Seller reviews and signs the contract", "3. Auctioneer reviews and finalizes", "4. Final contract document generated"]
}
```

**📧 Emails Sent**:

- Winner receives "Payment Confirmed - Contract Ready" email
- Seller receives "Winner Payment Received - Contract Ready" email
- All admins receive payment notification

**Payment Failure Scenarios**:

- If payment verification fails before deadline: Winner receives failure email with retry link
- If 7-day deadline expires without payment:
  - Winner's deposit (50M VND) is **forfeited**
  - Property automatically offered to 2nd highest bidder
  - 2nd bidder receives winner payment request email
  - If no 2nd bidder exists: Auction status changes to "failed"

### 22. Override Auction Status (Admin Only)

**Admin can manually override auction status for special cases.**

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
  "newStatus": "failed",
  "reason": "Fraud detected during investigation"
}
```

**Note**: Valid status values are `scheduled`, `live`, `awaiting_result`, `success`, or `failed`.

**Expected Response**:

```json
{
  "success": true,
  "message": "Auction status overridden successfully",
  "data": {
    "auctionId": "auction-uuid",
    "previousStatus": "live",
    "newStatus": "failed",
    "reason": "Fraud detected during investigation",
    "overriddenAt": "2025-11-14T14:00:00.000Z",
    "performedBy": "admin-user-uuid"
  },
  "meta": {},
  "timestamp": "2025-11-14T14:00:00.000Z",
  "path": "/api/auction-finalization/override"
}
```

### 23. Get Auction Results

**Anyone can view the final results of a completed auction.**

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
  "timestamp": "2025-11-14T15:00:00.000Z",
  "path": "/api/auction-finalization/results/{auctionId}"
}
```

### 24. Get Audit Logs (Admin/Auctioneer)

**View complete audit trail for an auction.**

**Method**: `GET`  
**URL**: `http://localhost:3000/api/auction-finalization/audit-logs/{auctionId}`  
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
  "data": [
    {
      "id": "log-uuid",
      "auctionId": "auction-uuid",
      "action": "AUCTION_FINALIZED",
      "performedBy": "user-uuid",
      "performedAt": "2025-11-14T15:00:00.000Z",
      "reason": null,
      "metadata": {}
    }
  ],
  "meta": {},
  "timestamp": "2025-11-14T15:00:00.000Z",
  "path": "/api/auction-finalization/audit-logs/{auctionId}"
}
```

---

## 📜 Contract Management Flow

### 25. View Contract Details

**Method**: `GET`  
**URL**: `http://localhost:3000/api/contracts/{contractId}`  
**Headers**:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
}
```

**Note**: Available to Admin, Seller, and Buyer only.

### 26. Export Contract PDF (Vietnamese)

**Method**: `GET`  
**URL**: `http://localhost:3000/api/contracts/{contractId}/pdf/vi`  
**Headers**:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
}
```

**Result**: Downloads a PDF file for the Vietnamese contract.

### 27. Export Contract PDF (English)

**Method**: `GET`  
**URL**: `http://localhost:3000/api/contracts/{contractId}/pdf/en`  
**Headers**:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
}
```

**Result**: Downloads a PDF file for the English contract.

### 28. Sign Contract

**Once satisfied with the PDF, parties can sign the contract.**

**Method**: `POST`  
**URL**: `http://localhost:3000/api/contracts/{contractId}/sign`  
**Headers**:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE",
  "Content-Type": "application/json"
}
```

**Body**:

```json
{
  "docUrl": "https://url-to-signed-document.pdf" // Optional: URL to uploaded signed doc
}
```

**Expected Response**:

```json
{
  "message": "Contract signed successfully",
  "data": {
    "id": "contract-uuid",
    "status": "signed",
    "signedAt": "2025-11-14T16:00:00.000Z"
  }
}
```

---

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

**Future Auctioneer** (promote after signup):

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

**Future Admin** (promote after signup):

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

**Note**: All users start as "bidder" role. Use the admin promotion endpoint or manual database update to change roles.

---

## ⚠️ Important Notes

### Registration Management States (Two-Tier System):

- **REGISTERED**: User initiated registration (registeredAt set)
- **PENDING_DOCUMENT_REVIEW**: Documents submitted, awaiting Tier 1 approval (submittedAt set)
- **DOCUMENTS_VERIFIED**: Admin verified documents (documentsVerifiedAt set)
- **DOCUMENTS_REJECTED**: Admin rejected documents (documentsRejectedAt set + reason)
- **DEPOSIT_PAID**: User paid deposit (depositPaidAt set)
- **CONFIRMED**: Admin gave final Tier 2 approval (confirmedAt set) - **User can now check in**
- **CHECKED_IN**: User checked in for auction (checkedInAt set) - **User can now bid**
- **WITHDRAWN**: User withdrew (withdrawnAt set + reason)

### Email Notification Points:

✉️ **User Emails:**

1. After document verification (Tier 1)
2. After deposit payment confirmation
3. After final approval (Tier 2)
4. Payment failure/deadline warnings
5. Winner payment request (after auction finalization)
6. Winner payment confirmation

✉️ **Admin Emails:**

1. New deposit payment received (needs Tier 2 approval)
2. Winner payment received

✉️ **Seller Emails:**

1. Winner payment received (contract ready)

### Field Names to Remember:

- Use `registrationId` (not `id`) in admin approval/rejection requests
  - **⚠️ Important**: `registrationId` = **Registration ID** (from AuctionParticipant table), NOT user ID
  - Get this from admin registration list endpoint or user's registration response
- Use `bidId` (not `id`) in bid responses
- Use `withdrawalReason` (not `reason`) in withdrawal requests
- Use `reason` in admin document rejection requests
- Documents are submitted as array of objects with `type` and `url` fields

### Authorization Matrix:

- **Regular Users (Bidder)**: Can register, withdraw, bid, view results
- **Auctioneers**: Can approve/reject registrations, verify documents, deny bids, finalize auctions
- **Admins**: All auctioneer permissions + evaluate, override status, promote users
- **Super Admins**: All permissions + can promote to any role including admin

### API Response Notes:

- **Auth endpoints** return direct response (tokens at root level)
- **All other endpoints** use the response wrapper format with `success`, `data`, `meta`, etc.
- JWT authentication is required for all protected endpoints
- Role-based authorization is enforced via guards

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

```json
{
  "statusCode": 404,
  "message": "Resource not found"
}
```

---

## 🧪 Complete Testing Sequence

### Phase 1: Setup & Authentication (Signup → Promote → Login)

1. **Register users** (endpoint 1)
   - Regular user (bidder@test.com)
   - Future admin (admin@test.com)
   - Future auctioneer (auctioneer@test.com)
2. **Promote first admin manually**
   - Open Prisma Studio: `npx prisma studio`
   - Find admin@test.com user
   - Change `role` field to `"super_admin"`
3. **Login as admin** (endpoint 3) to get admin JWT token
4. **Promote other users via API** (endpoint 2)
   - Promote auctioneer@test.com to "auctioneer"
   - Keep bidder@test.com as "bidder"
5. **Login all users** (endpoint 3) to get their JWT tokens
6. **Verify authentication** with GET /api/auth/me (endpoint 4)

### Phase 2: Registration to Bid Flow (with Approval/Rejection)

1. **User**: Register to bid with documents (endpoint 5)
2. **Admin**: Reject documents (endpoint 8) - Test rejection flow
3. **User**: Re-apply with updated documents (endpoint 9)
4. **Admin**: Verify documents - Tier 1 (endpoint 7) ✉️
   - Check user receives "Documents Verified" email
5. **User**: Initiate deposit payment (endpoint 10)
   - Receives Stripe payment URL and session ID
   - Opens payment URL in browser
   - Completes payment with test card: 4242 4242 4242 4242
6. **User**: Verify deposit payment (endpoint 10a)
   - Provides session ID from step 5
   - Payment status updated to completed ✉️
   - Check user receives "Deposit Confirmed" email
   - Check admins receive deposit notification
7. **Admin**: Final approval - Tier 2 (endpoint 11) ✉️
   - Check user receives "Registration Approved" email
8. **Admin**: List all registrations (endpoint 13) - Verify states

### Phase 3: Check-In

1. **User**: Check in for auction (endpoint 12)
   - Wait until check-in window opens (24 hours before auction)
   - Call check-in endpoint with auctionId
   - Required before placing any bids
2. **Verify**: Registration status is now "CHECKED_IN"
3. **Test error**: Try to check in twice (should fail with 409)
4. **Test error**: Try to check in before window opens (should fail with 403)

### Phase 4: Bidding

1. **User**: Place manual bids (endpoint 15)
   - Ensure user has checked in first
   - Place multiple bids to test increments
   - Test with different users
2. **Admin**: Monitor bids
3. **Admin**: Deny suspicious bid if needed (endpoint 16)
4. **Test bid validations**:
   - Minimum increment requirement
   - Registration must be confirmed
   - **Must have checked in** (most common error)

### Phase 5: Auction Finalization & Contract

1. **Admin**: Evaluate auction (endpoint 17)
2. **Winner**: Get payment requirements (endpoint 18)
3. **Winner**: Initiate payment (endpoint 19)
4. **Winner**: Verify payment (endpoint 20)
5. **Admin**: Finalize auction (endpoint 21) ✉️
   - **Critical**: Must happen AFTER payment verification
   - **Result**: Contract created
6. **User/Admin**: Export Contract PDF (endpoint 26/27)
7. **User**: Sign Contract (endpoint 28)
8. **Any User**: View auction results (endpoint 23)
9. **Admin**: View audit logs (endpoint 24)

### Phase 6: Edge Cases & Alternative Flows

1. **Test document rejection and re-submission**
   - User submits incomplete documents
   - Admin rejects with reason
   - User re-applies with correct documents
2. **Test withdrawal flow**
   - User withdraws registration
   - User re-applies after withdrawal
3. **Test deposit payment deadline** (24 hours)
   - Simulate delayed payment
4. **Test winner payment deadline** (7 days)
   - Simulate payment failure
   - Test 2nd bidder fallback
5. **Test admin override** (endpoint 22)
   - Override auction status for fraud case
6. **Test check-in flow**
   - Try to bid without checking in (should fail)
   - Check in successfully
   - Try to withdraw after check-in (should fail)

### Phase 7: Role-Based Access Testing

1. **Test bidder permissions**
   - Can register, bid, withdraw
   - Cannot approve registrations
   - Cannot finalize auctions
2. **Test auctioneer permissions**
   - Can approve/reject registrations
   - Can verify documents
   - Can finalize auctions
   - Cannot promote users to admin
3. **Test admin permissions**
   - All auctioneer permissions
   - Can promote users (except to admin)
   - Can override auction status
4. **Test super admin permissions**
   - Can promote to any role including admin

---

## 🆕 Two-Tier Approval System Details

### Complete Registration Flow:

1. **REGISTERED + PENDING_DOCUMENT_REVIEW** → User registers with documents in one step
2. **Tier 1: DOCUMENTS_VERIFIED** → Admin verifies documents ✉️
3. **DEPOSIT_PAID** → User pays deposit within 24 hours ✉️
4. **Tier 2: CONFIRMED** → Admin gives final approval ✉️
5. **CHECKED_IN** → User checks in 24 hours before auction (required to bid)
6. **READY TO BID** → User can place bids

### Alternative/Failure Paths:

- **DOCUMENTS_REJECTED** → Admin rejects documents → User can re-apply with updated documents
- **Auto-Cancelled** → If deposit not paid within 24 hours
- **WITHDRAWN** → User withdraws at any stage (cannot withdraw after check-in) → Can re-apply later

### Key Differences from Previous Flow:

- ✅ **Documents submitted with registration** - No separate submit documents endpoint
- ✅ **Re-apply automatically detected** - System handles rejection/withdrawal state transitions
- ✅ **Streamlined user experience** - Fewer steps for the user

### Key Deadlines:

- **Deposit Payment**: 24 hours from document verification
- **Check-In Window**: Opens 24 hours before auction, closes when auction ends
- **Winner Payment**: 7 days from auction finalization
- **Auto-Actions**:
  - Registration cancelled if deposit deadline missed
  - Deposit forfeited if winner payment deadline missed
  - Property offered to 2nd bidder if winner doesn't pay

---

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

**Problem**: User doesn't have required role
**Solution**:

1. Verify user has ADMIN, AUCTIONEER, or SUPER_ADMIN role
2. Use correct JWT token for the admin user
3. For first admin: Manually update database via Prisma Studio or SQL

#### 4. "User not found" or JWT Issues

**Problem**: Token invalid or expired, or Supabase authentication issue
**Solution**:

1. Re-login to get fresh JWT token
2. Ensure token is included in `Authorization: Bearer <token>` header
3. Check Supabase authentication is properly configured
4. Verify user exists in local database

#### 5. Registration Fails "Already confirmed" or "Under review"

**Problem**: User already has active registration
**Solution**:

1. Check registration status via admin list endpoint
2. If withdrawn, you can re-apply
3. If rejected, you can re-apply with updated documents
4. If under review, wait for admin decision
5. If confirmed, you're already registered

#### 6. Cannot Place Bid

**Problem**: Registration not in CONFIRMED state or user hasn't checked in
**Solution**:

1. Check registration status (endpoint 13)
2. Ensure documents are verified (Tier 1)
3. Ensure deposit is paid
4. Ensure final approval received (Tier 2)
5. **Ensure user has checked in** (endpoint 12)
6. Only CONFIRMED + CHECKED_IN participants can bid

**Common Error**:

```json
{
  "statusCode": 403,
  "message": "You must check in before placing a bid"
}
```

**Solution**: Call check-in endpoint first (Section 12)

#### 7. Server Not Running

**Check**:

```bash
# Start the server
npm run start:dev
# or
npx nx serve server
```

#### 8. Database Connection Issues

**Check**:

- PostgreSQL is running on port 5432
- Environment variables are set correctly in `.env`
- Database exists and migrations are run: `npx prisma migrate dev`
- Prisma client is generated: `npx prisma generate`

#### 9. CORS Issues

If testing from browser/frontend:

- Check `CORS_ORIGIN` in `.env` file
- Ensure your frontend URL is whitelisted
- Server should have CORS enabled for your domain

### Quick Verification:

**1. Test server is running:**

```
GET: http://localhost:3000/api/health
```

Should return health status.

**2. Test authentication:**

```
POST: http://localhost:3000/api/auth/login
```

Should return JWT tokens.

**3. Check database connection:**

```bash
npx prisma studio
```

Should open Prisma Studio successfully.

**4. Verify roles:**

Open Prisma Studio → Users table → Check `role` column values

---

## 🚨 Critical Validation Notes

### Registration DTO Validation:

- ✅ **phone_number**: Must be Vietnamese format: `"0987654321"` (NOT `"+84987654321"`)
- ✅ **identity_number**: Must be Vietnamese CCCD: `"001234567890"` (12 digits)
- ✅ **password**: Must contain uppercase, lowercase, and number (min 8 chars)
- ✅ **user_type**: Only `"individual"` or `"business"`
- ✅ **email**: Must be valid email format

### Document Submission:

- ✅ **documentUrls**: Array of objects with `type` and `url` fields
- ✅ **type**: String describing document type (e.g., "identity_card", "financial_proof")
- ✅ **url**: Valid URL to uploaded document

### Bid Amount:

- ✅ **amount**: Must be number (not string): `1000000000`
- ✅ Must meet minimum increment rules for the auction
- ✅ **auctionId**: Must be valid UUID

### Field Names (Critical):

- ✅ Use `registrationId` in admin operations (not `id`)
- ✅ Use `bidId` in bid responses (not `id`)
- ✅ Use `withdrawalReason` in withdrawal requests
- ✅ Use `reason` in document rejection requests
- ✅ Response uses `currentState` to indicate registration status

### Available Auction Statuses:

- `"scheduled"`, `"live"`, `"awaiting_result"`, `"success"`, `"failed"`

> **Note**: Old statuses `no_bid` and `cancelled` have been replaced with `failed`.

### Available User Roles:

- `"bidder"` (default)
- `"auctioneer"`
- `"admin"`
- `"super_admin"`

---

## 📊 API Response Structure

### Standard Success Response:

```json
{
  "success": true,
  "message": "Request successful",
  "data": {
    /* actual response data */
  },
  "meta": {},
  "timestamp": "2025-11-14T10:00:00.000Z",
  "path": "/api/endpoint"
}
```

### Auth Endpoints (Direct Response):

```json
{
  "access_token": "jwt-token",
  "user": {
    /* user data */
  }
}
```

### Error Response:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

---

Happy Testing! 🚀
