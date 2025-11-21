# Register to Bid Endpoints

## Base Path: `/register-to-bid`

Two-tier approval system with document verification and deposit payment.

### 1. Register for Auction

**Endpoint**: `POST /register-to-bid`
**Access**: Authenticated
**Status**: 201 Created
**Content-Type**: `multipart/form-data`

**Request Body** (form-data):

```
auctionId: string (UUID, REQUIRED)
documents?: File[] (max 10 files, 10MB each)
media?: File[] (max 10 files, 10MB each)
```

**Supported File Types**:
- **documents**: PDF, DOC, DOCX
- **media**: Images (JPG, PNG, GIF), Videos

**File Upload Process**:
- Files are uploaded to Cloudinary automatically
- Uploaded files are stored as JSONB in database
- Each file entry contains: url, publicId, sortOrder

**Response** (201):

```
{
  id: string,
  userId: string,
  auctionId: string,
  registeredAt: Date,
  submittedAt: Date,
  documents?: Array<{
    url: string,
    publicId: string,
    sortOrder: number
  }>,
  media?: Array<{
    url: string,
    publicId: string,
    sortOrder: number
  }>,
  documentsVerifiedAt?: Date,
  documentsVerifiedBy?: string,
  documentsRejectedAt?: Date,
  documentsRejectedReason?: string,
  depositPaidAt?: Date,
  depositAmount?: number,
  depositPaymentId?: string,
  confirmedAt?: Date,
  confirmedBy?: string,
  currentState: string
}
```

**State Values**: REGISTERED, PENDING_DOCUMENT_REVIEW, DOCUMENTS_VERIFIED, DOCUMENTS_REJECTED, DEPOSIT_PAID, CONFIRMED, WITHDRAWN, REJECTED, CHECKED_IN

**Errors**: 400, 403, 404, 409

---

### 2. Withdraw Registration

**Endpoint**: `POST /register-to-bid/withdraw`
**Access**: Authenticated
**Status**: 200 OK
**Constraints**: Before auction starts, not after check-in

---

### 3. Verify Documents (Tier 1)

**Endpoint**: `POST /register-to-bid/admin/verify-documents`
**Access**: Admin/Auctioneer
**Status**: 200 OK
**Roles**: ADMIN, AUCTIONEER, SUPER_ADMIN

**Sets**: documentsVerifiedAt, documentsVerifiedBy
**Email**: "Documents approved, pay deposit within 24 hours"

---

### 4. Reject Documents (Tier 1)

**Endpoint**: `POST /register-to-bid/admin/reject-documents`
**Access**: Admin/Auctioneer
**Status**: 200 OK
**Sets**: documentsRejectedAt, documentsRejectedReason
**State**: DOCUMENTS_REJECTED
**User Action**: Can resubmit documents

---

### 5. Submit Deposit (Tier 2)

**Endpoint**: `POST /register-to-bid/submit-deposit`
**Access**: Authenticated
**Status**: 200 OK

**Request**:

```
{
  registrationId: string (UUID),
  auctionId: string (UUID),
  amount: number
}
```

**Response**:

```
{
  paymentId: string,
  amount: number,
  paymentUrl: string,
  qrCode: string,
  bankInfo: object,
  deadline: string,
  status: "pending",
  message: string
}
```

**Action**: Creates Stripe payment session and returns payment URL/QR code
**Requires**: documentsVerifiedAt (Tier 1 complete)
**Note**: User must complete payment via Stripe checkout page

---

### 6. Verify Deposit Payment

**Endpoint**: `POST /register-to-bid/verify-deposit-payment`
**Access**: Authenticated
**Status**: 200 OK

**Request**:

```
{
  sessionId: string (Stripe session ID),
  registrationId: string (UUID)
}
```

**Response**:

```
{
  verified: true,
  paymentId: string,
  sessionId: string,
  amount: number,
  status: "completed",
  message: string
}
```

**Action**: Verifies Stripe payment completion and updates registration
**Sets**: depositPaidAt, depositAmount, depositPaymentId
**Note**: Call after user completes Stripe checkout

---

### 7. Final Approval

**Endpoint**: `POST /register-to-bid/admin/final-approval`
**Access**: Admin/Auctioneer
**Status**: 200 OK

**Sets**: confirmedAt, confirmedBy
**Requires**: documentsVerifiedAt AND depositPaidAt
**Email**: "You're approved! Check in and bid"

---

### 8. Check-In for Auction

**Endpoint**: `POST /register-to-bid/check-in`
**Access**: Authenticated
**Status**: 200 OK

**Request Body**:

```
{
  auctionId: string (UUID, REQUIRED)
}
```

**Response** (200):

```
{
  id: string,
  userId: string,
  auctionId: string,
  currentState: "CHECKED_IN",
  checkedInAt: Date,
  ... (other registration fields)
}
```

**Error Responses**:
- 403: Registration not confirmed, check-in window not open, or auction ended
- 404: Auction or registration not found
- 409: Already checked in

**Business Logic**:
- Check-in window opens 24 hours before auction starts
- User must have CONFIRMED status (Tier 1 + Tier 2 complete)
- User cannot check in after auction has ended
- Sets checkedInAt timestamp and updates state to CHECKED_IN
- Required before user can place bids

---

### 9. List Registrations (Paginated)

**Endpoint**: `GET /register-to-bid/admin/registrations`
**Access**: Admin/Auctioneer
**Query**: page, limit, status, auctionId
**Returns**: Paginated list with user and auction info

---

### 10. List User Registrations

**Endpoint**: `GET /register-to-bid/admin/users/:userId/registrations`
**Access**: Admin/Auctioneer
**Returns**: Array of user's registrations

---

## Two-Tier Approval Flow

1. User registers with document/media files (uploaded to Cloudinary)
2. Admin verifies documents (Tier 1)
3. User initiates deposit payment (receives Stripe payment URL)
4. User completes payment via Stripe checkout
5. User calls verify-deposit-payment to confirm payment
6. Admin gives final approval (Tier 2)
7. User checks in (24 hours before auction starts)
8. User can now bid

## File Upload & Storage

- All documents and media are uploaded via `multipart/form-data`
- Files are automatically uploaded to Cloudinary cloud storage
- File metadata (url, publicId, sortOrder) is stored as JSONB in PostgreSQL
- Max file size: 10MB per file
- Max file count: 10 files per field (documents and media)
