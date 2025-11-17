# Auction Endpoints

## Base Path: `/auctions`

Public endpoints for browsing and viewing auctions.

### 1. Get All Auctions

**Endpoint**: `GET /auctions`
**Access**: Public
**Status**: 200 OK

**Query Parameters**:
```
{
  status?: "completed" | "now" | "upcoming",  // Filter by auction status
  page?: number,                               // Page number (default: 1)
  limit?: number,                              // Items per page (default: 10)
  sortBy?: string,                             // Field to sort by (default: "createdAt")
  sortOrder?: "asc" | "desc"                   // Sort direction (default: "desc")
}
```

**Status Filter Values**:
- `completed` - Auctions that have already ended
- `now` - Currently active/live auctions
- `upcoming` - Auctions scheduled for the future

**Response** (200):
```typescript
{
  data: Array<{
    id: string,
    name: string,
    code: string,
    description?: string,
    status: AuctionStatus,
    startingPrice: number,
    bidIncrement: number,
    reservePrice?: number,
    auctionStartAt: Date,
    auctionEndAt: Date,
    registrationOpenAt: Date,
    registrationCloseAt: Date,
    createdAt: Date,
    updatedAt: Date,
    totalParticipants?: number,
    totalBids?: number,
    currentHighestBid?: number
  }>,
  meta: {
    total: number,
    page: number,
    limit: number,
    totalPages: number
  }
}
```

**Example Requests**:
```
GET /auctions                                    // All auctions, page 1
GET /auctions?status=now                         // Currently active auctions
GET /auctions?status=upcoming&page=2&limit=20    // Upcoming auctions, page 2
GET /auctions?sortBy=auctionStartAt&sortOrder=asc // Sort by start time ascending
```

---

### 2. Get Single Auction

**Endpoint**: `GET /auctions/:id`
**Access**: Public
**Status**: 200 OK

**Path Parameters**:
- `id` (string, UUID) - Auction ID

**Response** (200):
```typescript
{
  id: string,
  name: string,
  code: string,
  description?: string,
  status: AuctionStatus,
  startingPrice: number,
  bidIncrement: number,
  reservePrice?: number,
  auctionStartAt: Date,
  auctionEndAt: Date,
  registrationOpenAt: Date,
  registrationCloseAt: Date,
  createdAt: Date,
  updatedAt: Date,

  // Additional detailed information
  asset?: {
    id: string,
    name: string,
    description: string,
    category: string,
    images?: Array<string>,
    documents?: Array<{type: string, url: string}>
  },

  // Statistics
  totalParticipants: number,
  totalBids: number,
  currentHighestBid?: number,

  // Policy information
  policy?: {
    depositType: "percentage" | "fixed",
    depositPercentage?: number,
    depositFixedAmount?: number,
    commissionRate?: number
  }
}
```

**Error Responses**:
- 404: Auction not found

**Use Cases**:
- View auction details before registration
- Check current auction status and bidding activity
- View asset information and documentation
- Determine deposit requirements

---

## Auction Status Values

The system uses the following auction status values:

- `draft` - Auction created but not published
- `scheduled` - Auction scheduled and published
- `registration_open` - Registration period active
- `registration_closed` - Registration period ended
- `live` - Auction is currently active and accepting bids
- `ended` - Auction time has expired
- `success` - Auction finalized successfully with winner
- `no_bid` - Auction ended without valid bids
- `cancelled` - Auction cancelled by admin

---

## Common Use Cases

### Browse Active Auctions
```
GET /auctions?status=now&sortBy=auctionEndAt&sortOrder=asc
```
Returns currently live auctions sorted by ending soonest first.

### Find Upcoming Auctions
```
GET /auctions?status=upcoming&sortBy=auctionStartAt&sortOrder=asc
```
Returns scheduled auctions sorted by start time.

### View Auction History
```
GET /auctions?status=completed&page=1&limit=50
```
Returns completed auctions for browsing past results.

### Get Auction Details
```
GET /auctions/{auctionId}
```
Returns full details of a specific auction including asset info, statistics, and policies.
