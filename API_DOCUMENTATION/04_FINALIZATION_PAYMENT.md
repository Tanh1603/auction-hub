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
- success - Meets all criteria
- no_bid - No valid bids
- cancelled - Insufficient participants

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

## Payment Endpoints

### Base Path: `/payments`

#### 1. Create Payment
**Endpoint**: `POST /payments`
**Status**: 201 Created
**Access**: Authenticated

**Request**:
```
{
  auctionId: string,
  registrationId: string,
  paymentType: deposit | participation_fee | winning_payment | refund,
  amount: number (> 0),
  paymentMethod: bank_transfer | e_wallet | cash
}
```

**Response**:
```
{
  payment_id: string (Stripe session ID),
  amount: number,
  currency: "USD",
  status: "unpaid" | "paid" | "pending",
  payment_url: string,
  qr_code: string (Data URL),
  bank_info: {...},
  payment_deadline: string (24 hours)
}
```

**Creates**: Stripe session, generates QR code, stores payment record

---

#### 2. Verify Payment
**Endpoint**: `GET /payments/verify?session_id=<id>`
**Status**: 200 OK
**Access**: Authenticated

**Returns**: Current payment status from Stripe

---

## Complete Payment Flows

### Deposit Payment Flow
1. Admin verifies documents
2. User initiates deposit payment (POST /payments)
3. User completes payment via Stripe/QR
4. User submits deposit (POST /register-to-bid/submit-deposit)
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

