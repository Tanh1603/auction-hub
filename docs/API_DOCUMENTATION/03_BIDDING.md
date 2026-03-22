# Bidding Endpoints

## Manual Bidding

### Base Path: `/manual-bid`

#### 1. Place Bid
**Endpoint**: `POST /manual-bid`
**Access**: Authenticated + Bidder role
**Status**: 201 Created
**Guards**: AuthGuard, RolesGuard
**Roles**: BIDDER

**Request Body**:
```
{
  auctionId: string (UUID, REQUIRED),
  amount: number (REQUIRED, min 0.01, max 2 decimals)
}
```

**Response** (201):
```
{
  bidId: string,
  auctionId: string,
  participantId: string,
  userId: string,
  amount: string,
  bidAt: Date,
  bidType: "manual" | "auto",
  isWinningBid: boolean
}
```

**Error Responses**:
- 400: Auction not live, bid too low
- 403: Auction session inactive, user not confirmed
- 404: Auction not found
- 409: Bid below increment threshold

**Validation**:
- Auction status must be "live"
- Current time between auctionStartAt and auctionEndAt
- User must be confirmed participant
- User must have checked in
- User must not be rejected or withdrawn
- First bid: amount >= startingPrice
- Subsequent bids: amount >= (highestBid + bidIncrement)
- Bid increment compliance: 95% of bids must follow rules

**Business Logic**:
- Updates isWinningBid for previous highest bidder
- Broadcasts newBid event via WebSocket
- Tracks bid increment compliance
- Maintains complete bid history

---

#### 2. Deny Bid (Admin)
**Endpoint**: `POST /manual-bid/deny`
**Access**: Admin/Auctioneer/Super Admin
**Status**: 200 OK
**Guards**: AuthGuard, RolesGuard
**Roles**: ADMIN, AUCTIONEER, SUPER_ADMIN

**Request Body**:
```
{
  bidId: string (UUID, REQUIRED),
  reason?: string (optional)
}
```

**Response**:
```
{
  bidId: string,
  isDenied: boolean (true),
  deniedAt: Date,
  deniedReason?: string
}
```

**Business Logic**:
- Admin can reject bids after placement
- Sets isDenied and deniedAt
- Previous winning bid becomes current winner
- Broadcasts bidDenied event via WebSocket
- Preserves audit trail

---

## Real-Time Bidding (WebSocket)

### Base Path: `/bidding` (WebSocket namespace)

**Configuration**:
- Namespace: /bidding
- Room pattern: auction:{auctionId}
- CORS: Enabled for all origins
- Update frequency: 1 second (time updates)

---

### Connection Management

#### 1. Join Auction
**Event**: `joinAuction` (client → server)

**Payload**:
```
{
  auctionId: string
}
```

**Server Response**: `joinedAuction` event
```
{
  event: "joinedAuction",
  data: {
    auctionId: string,
    message: "Successfully joined auction"
  }
}
```

**Initial Data**: Server sends `auctionState` event
```
{
  event: "auctionState",
  data: {
    auctionId: string,
    name: string,
    code: string,
    status: AuctionStatus,
    startingPrice: number,
    bidIncrement: number,
    reservePrice?: number,
    auctionStartAt: Date,
    auctionEndAt: Date,
    timeRemaining: number (milliseconds),
    hasStarted: boolean,
    hasEnded: boolean,
    isActive: boolean,
    currentWinningBid?: {
      bidId: string,
      amount: number,
      bidAt: Date,
      participantId: string,
      bidderName: string,
      isWinningBid: boolean
    },
    nextMinimumBid: number,
    totalBids: number,
    totalParticipants: number,
    bidHistory: Array<{
      bidId: string,
      amount: number,
      bidAt: Date,
      bidderName: string
    }> (top 5 bids)
  }
}
```

**Business Logic**:
- Client joins `auction:{auctionId}` room
- Server sends current auction state
- Periodic updates start (1 second interval)
- Updates stop when last client leaves or auction ends

---

#### 2. Leave Auction
**Event**: `leaveAuction` (client → server)

**Payload**:
```
{
  auctionId: string
}
```

**Server Response**: `leftAuction` event
```
{
  event: "leftAuction",
  data: {
    auctionId: string
  }
}
```

---

### Server → Client Events

#### 1. Auction State
**Event**: `auctionState`
**Broadcast**: On join
**Frequency**: Once on join, then periodic updates
**Payload**: See "Join Auction" section above

---

#### 2. New Bid
**Event**: `newBid`
**Broadcast**: All clients in auction room
**Trigger**: After successful POST /manual-bid
**Payload**: Full auctionState object with updated winning bid

---

#### 3. Bid Denied
**Event**: `bidDenied`
**Broadcast**: All clients in auction room
**Trigger**: After POST /manual-bid/deny
**Payload**:
```
{
  event: "bidDenied",
  data: {
    bidId: string,
    reason?: string,
    ... (full auctionState)
  }
}
```

---

#### 4. Time Update
**Event**: `timeUpdate`
**Broadcast**: Every 1 second to all clients in room
**Payload**:
```
{
  event: "timeUpdate",
  data: {
    auctionId: string,
    timeRemaining: number (milliseconds),
    hasStarted: boolean,
    hasEnded: boolean
  }
}
```

**Business Logic**:
- Emitted every 1 second while clients connected
- Allows real-time countdown on client
- Stops when no clients remain in room

---

#### 5. Auction Update
**Event**: `auctionUpdate`
**Broadcast**: When auction status changes
**Triggers**:
- Auction ends (timeRemaining = 0)
- Status manually changed
- Finalization actions
**Payload**:
```
{
  event: "auctionUpdate",
  data: {
    type: "AUCTION_ENDED" | "STATUS_CHANGED" | ...,
    ... (full auctionState)
  }
}
```

---

## Complete Bidding Flow

```
1. User registers and gets approved
   Status: CONFIRMED

2. User checks in to auction
   Timestamp: checkedInAt set

3. Join WebSocket room
   WS: /bidding
   Event: joinAuction {auctionId}
   Receive: auctionState event

4. Auction starts
   Event: auctionState with hasStarted: true
   Event: timeUpdate every 1 second

5. User places bid
   HTTP: POST /manual-bid {auctionId, amount}
   isWinningBid: true
   All WS clients: newBid event (full state)

6. Another bidder places higher bid
   All WS clients: newBid event
   First bidder's isWinningBid: false

7. First bidder places counter bid
   All WS clients: newBid event
   First bidder's isWinningBid: true again

8. Admin denies a bid (rule violation)
   HTTP: POST /manual-bid/deny {bidId, reason}
   All WS clients: bidDenied event
   Previous winner becomes current winner

9. Auction ends
   timeRemaining: 0
   All WS clients: auctionUpdate {type: AUCTION_ENDED}
   Updates stop

10. Results available
    HTTP: GET /auction-finalization/results/:auctionId
    User sees if they won
```

