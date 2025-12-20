# Auction Finalization & Payment Endpoints

## Auction Finalization

### Base Path: `/auction-finalization`

#### 1. Evaluate Auction

**Endpoint**: `GET /auction-finalization/evaluate/:auctionId`
**Access**: Admin/Auctioneer/Super Admin

**Response** (200):

```
{
  auctionId: string,
  currentStatus: AuctionStatus,
  recommendedStatus: AuctionStatus,
  isAlreadyFinalized: boolean,
  meetsReservePrice: boolean,
  hasMinimumParticipants: boolean,
  hasValidBids: boolean,
  totalValidBids: number,
  totalParticipants: number,
  highestBidAmount?: string,
  canFinalize: boolean,
  evaluatedAt: Date
}
```

**Validation**: Checks end time, participants (min 2), bids, reserve price, bid increment compliance (95% threshold)

---

#### 2. Finalize Auction

**Endpoint**: `POST /auction-finalization/finalize`
**Access**: Admin/Auctioneer/Super Admin

**Request**:

```
{
  auctionId: string (REQUIRED),
  winningBidId?: string,
  notes?: string,
  skipAutoEvaluation?: boolean
}
```

**Final Statuses**:

- `success` - Meets all criteria
- `failed` - No valid bids, reserve not met, or cancelled
- `awaiting_result` - Evaluation pending (intermediate state)

**Note**: The old `no_bid` and `cancelled` statuses have been replaced with `failed` in the new schema.

**Actions**: Determines winner, sends notifications, creates transaction

---

#### 3. Override Status

**Endpoint**: `POST /auction-finalization/override`
**Access**: Super Admin ONLY

**Request**:

```
{
  auctionId: string,
  newStatus: AuctionStatus,
  reason: string
}
```

**Use Cases**: Fraudulent activity, payment failure, edge cases

---

#### 3a. Get Management Detail (NEW)

**Endpoint**: `GET /auction-finalization/management-detail/:auctionId`
**Access**: Admin/Super Admin ONLY

**Description**: Returns detailed internal view for admin override operations. Provides full bidding pool and participant status to enable manual winner selection.

**Use Cases**:

- Winner refuses to pay → Admin picks 2nd highest bidder
- Payment deadline expired → Admin reassigns winner
- Manual intervention needed for edge cases

**Response** (200):

```json
{
  "auctionId": "uuid",
  "auctionCode": "VNA-2024-001",
  "auctionName": "Auction Name",
  "status": "awaiting_result",
  "auctionStartAt": "2024-12-01T10:00:00Z",
  "auctionEndAt": "2024-12-01T12:00:00Z",
  "depositEndAt": "2024-11-30T12:00:00Z",
  "startingPrice": "1000000000",
  "reservePrice": "1200000000",
  "bidIncrement": "10000000",
  "currentHighestBid": "1500000000",
  "bids": [
    {
      "bidId": "bid-uuid-1",
      "participantId": "participant-uuid-1",
      "amount": "1500000000",
      "bidAt": "2024-12-01T11:55:00Z",
      "bidType": "manual",
      "isWinningBid": true,
      "isDenied": false,
      "isWithdrawn": false,
      "participant": {
        "userId": "user-uuid-1",
        "fullName": "Nguyen Van A",
        "email": "nguyenvana@example.com",
        "depositPaid": true,
        "checkedIn": true,
        "isDisqualified": false
      }
    },
    {
      "bidId": "bid-uuid-2",
      "participantId": "participant-uuid-2",
      "amount": "1400000000",
      "bidAt": "2024-12-01T11:50:00Z",
      "bidType": "manual",
      "isWinningBid": false,
      "isDenied": false,
      "isWithdrawn": false,
      "participant": {
        "userId": "user-uuid-2",
        "fullName": "Tran Thi B",
        "email": "tranthib@example.com",
        "depositPaid": true,
        "checkedIn": true,
        "isDisqualified": false
      }
    }
  ],
  "participants": [
    {
      "participantId": "participant-uuid-1",
      "userId": "user-uuid-1",
      "fullName": "Nguyen Van A",
      "email": "nguyenvana@example.com",
      "registeredAt": "2024-11-20T10:00:00Z",
      "confirmedAt": "2024-11-25T10:00:00Z",
      "checkedInAt": "2024-12-01T09:00:00Z",
      "depositPaidAt": "2024-11-22T10:00:00Z",
      "depositAmount": "100000000",
      "isDisqualified": false,
      "disqualifiedReason": null,
      "withdrawnAt": null,
      "totalBids": 5,
      "highestBidAmount": "1500000000"
    }
  ],
  "currentWinningBid": {
    /* Same as bids[0] if marked winning */
  },
  "evaluation": {
    "meetsReservePrice": true,
    "hasMinimumParticipants": true,
    "hasValidBids": true,
    "recommendedStatus": "success",
    "issues": []
  },
  "contract": {
    "contractId": "contract-uuid",
    "status": "draft",
    "createdAt": "2024-12-01T12:05:00Z"
  },
  "summary": {
    "totalBids": 15,
    "validBids": 14,
    "deniedBids": 1,
    "totalParticipants": 5,
    "checkedInParticipants": 4,
    "depositPaidParticipants": 5,
    "disqualifiedParticipants": 0
  }
}
```

**Error Responses**:

- 403: User is not admin or super_admin
- 404: Auction not found

**Usage with Override Endpoint**:

1. Call `GET /auction-finalization/management-detail/:auctionId` to get all bids
2. Select the desired bid from `bids[]` array (e.g., 2nd highest bidder)
3. Call `POST /auction-finalization/override` with:
   ```json
   {
     "auctionId": "uuid",
     "newStatus": "success",
     "winningBidId": "selected-bid-uuid",
     "reason": "Original winner refused to pay"
   }
   ```

---

#### 4. Get Results

**Endpoint**: `GET /auction-finalization/results/:auctionId`
**Access**: Any authenticated user

**Returns**: Auction results from user perspective
**Shows**: isWinner, winner details, user's bids

---

#### 5. Audit Logs

**Endpoint**: `GET /auction-finalization/audit-logs/:auctionId`
**Access**: Admin/Auctioneer/Super Admin

**Returns**: Complete audit trail of all auction actions

---

#### 6. Get Winner Payment Requirements

**Endpoint**: `GET /auction-finalization/winner-payment-requirements/:auctionId`
**Access**: Authenticated
**Status**: 200 OK

**Response** (200):

```
{
  auctionId: string,
  winningBidAmount: number,
  depositPaid: number,
  remainingAmount: number,
  totalAmount: number,
  commissionFee?: number,
  otherFees?: number,
  paymentDeadline: Date,
  paymentStatus: "pending" | "paid" | "overdue"
}
```

**Business Logic**:

- Returns payment breakdown for auction winner
- Shows deposit already paid and remaining balance
- Includes commission fees and other applicable charges
- Payment deadline typically 7-30 days after auction end

---

#### 7. Submit Winner Payment

**Endpoint**: `POST /auction-finalization/submit-winner-payment`
**Access**: Authenticated (Winner only)
**Status**: 201 Created

**Request**:

```
{
  auctionId: string (UUID, REQUIRED)
}
```

**Response** (201):

```
{
  paymentId: string (Stripe session ID),
  auctionId: string,
  amount: number,
  paymentUrl: string,
  qrCode: string (Data URL),
  deadline: Date,
  status: "pending",
  message: string
}
```

**Error Responses**:

- 403: User is not the winner or auction not finalized
- 404: Auction not found
- 409: Payment already completed

**Action**: Creates Stripe payment session for final winner payment
**Note**: User must complete payment via Stripe checkout page

---

#### 8. Verify Winner Payment

**Endpoint**: `POST /auction-finalization/verify-winner-payment`
**Access**: Authenticated (Winner or Admin/Auctioneer)
**Status**: 200 OK

**Request**:

```
{
  sessionId: string (Stripe session ID, REQUIRED),
  auctionId: string (UUID, REQUIRED)
}
```

**Response** (200):

```
{
  verified: true,
  paymentId: string,
  sessionId: string,
  auctionId: string,
  amount: number,
  status: "completed",
  paidAt: Date,
  message: "Winner payment verified successfully"
}
```

**Error Responses**:

- 400: Invalid session ID or payment not completed
- 403: User is not the winner or admin
- 404: Auction or payment not found

**Business Logic**:

- Verifies Stripe payment completion
- Updates auction transaction status to "paid"
- Triggers contract generation (if applicable)
- Sends payment confirmation email
- Can be called by winner or admin/auctioneer

---

## Complete Payment Flows

### Deposit Payment Flow

1. Admin verifies documents
2. User initiates deposit payment (POST /register-to-bid/submit-deposit)
3. User completes payment via Stripe/QR
4. User verifies payment (POST /register-to-bid/verify-deposit-payment)
5. Admin gives final approval

### Winning Payment Flow

1. Auction finalized with status: success
2. Winner queries payment requirements (GET /auction-finalization/winner-payment-requirements/:auctionId)
3. Winner initiates final payment (POST /auction-finalization/submit-winner-payment)
4. System creates Stripe payment session (remaining amount = winning bid - deposit)
5. Winner completes payment via Stripe checkout page
6. Winner or admin verifies payment (POST /auction-finalization/verify-winner-payment)
7. System confirms payment and triggers contract generation
8. Transaction status updated to "paid" and winner receives confirmation email
