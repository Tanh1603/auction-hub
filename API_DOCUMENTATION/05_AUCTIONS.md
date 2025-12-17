# Auction Endpoints

## Base Path: `/auctions`

Endpoints for browsing, viewing, and managing auctions.

---

### 1. Get All Auctions

**Endpoint**: `GET /auctions`
**Access**: Public
**Status**: 200 OK

**Query Parameters**:

```
{
  status?: "completed" | "now" | "upcoming",  // Filter by auction status
  active?: boolean,                            // Filter by active status
  page?: number,                               // Page number (default: 1)
  limit?: number                               // Items per page (default: 10)
}
```

**Status Filter Values**:

- `completed` - Auctions that have already ended (auctionEndAt < now)
- `now` - Currently active/live auctions (auctionStartAt <= now < auctionEndAt)
- `upcoming` - Auctions scheduled for the future (auctionStartAt > now)

**Response** (200):

```typescript
{
  data: Array<{
    id: string,
    name: string,
    startingPrice: number,
    depositAmountRequired: number,
    auctionStartAt: Date
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
GET /auctions?active=true                        // Only active auctions
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
  data: {
    id: string,
    code: string,
    name: string,
    assetType: "secured_asset" | "land_use_rights" | "administrative_violation_asset" | "state_asset" | "enforcement_asset" | "other_asset",
    assetAddress: string,
    assetDescription: string,
    status: "scheduled" | "live" | "awaiting_result" | "success" | "failed",

    // Pricing
    startingPrice: number,
    bidIncrement: number,
    reservePrice?: number,
    depositAmountRequired: number,
    saleFee: number,

    // Policy fees (validated)
    dossierFee?: number,
    depositPercentage?: number,

    // Timeline
    saleStartAt: Date,           // Document sale begins
    saleEndAt: Date,             // Document sale ends
    auctionStartAt: Date,        // Bidding begins
    auctionEndAt: Date,          // Bidding ends
    depositEndAt: Date,          // Deposit deadline

    // Viewing & Check-in
    viewTime: string,
    validCheckInBeforeStartMinutes: number,
    validCheckInAfterStartMinutes: number,

    // Status & Activity
    isActive: boolean,
    numberOfFollow: number,

    // Media (stored as JSON)
    images?: Array<{
      publicId: string,
      url: string,
      sortOrder: number
    }>,
    attachments?: Array<{
      publicId: string,
      url: string
    }>,

    // Property Owner (stored as JSON snapshot)
    propertyOwner: {
      id: string,
      fullName: string,
      email: string,
      phoneNumber?: string,
      identityNumber?: string,
      userType?: string,
      avatarUrl?: string
    },

    // Related auctions
    relatedAuctions?: Array<{
      id: string,
      name: string,
      code: string,
      images: JsonValue,
      startingPrice: number,
      depositAmountRequired: number,
      saleStartAt: Date
    }>,

    createdAt: Date,
    updatedAt: Date
  }
}
```

**Error Responses**:

- 404: Auction not found

**Use Cases**:

- View auction details before registration
- Check current auction status
- View asset information and documentation
- Determine deposit requirements
- See related auctions

---

### 3. Create Auction

**Endpoint**: `POST /auctions`
**Access**: Admin, Auctioneer
**Authentication**: Required (Bearer token)
**Status**: 201 Created

**Request Body**:

```typescript
{
  code: string,                            // Unique auction code (required)
  name: string,                            // Auction name (required)
  assetType: "secured_asset" | "land_use_rights" | "administrative_violation_asset" | "state_asset" | "enforcement_asset" | "other_asset",
  assetAddress: string,
  assetDescription: string,

  // Timeline (all required)
  saleStartAt: Date,                       // Document sale start
  saleEndAt: Date,                         // Document sale end
  auctionStartAt: Date,                    // Bidding start
  auctionEndAt: Date,                      // Bidding end
  depositEndAt: Date,                      // Deposit deadline

  // Pricing (all required)
  startingPrice: number,
  bidIncrement: number,
  depositAmountRequired: number,
  saleFee: number,

  // Viewing & Check-in (required)
  viewTime: string,
  validCheckInBeforeStartMinutes: number,
  validCheckInAfterStartMinutes: number,

  // Property Owner (required - stored as JSON snapshot)
  propertyOwner: {
    id: string,              // UUID of property owner
    fullName: string,
    email: string,
    phoneNumber?: string,
    identityNumber?: string,
    userType?: string,
    avatarUrl?: string
  },

  // Location (required - new fields)
  assetProvinceId: number,             // Location ID for province
  assetWardId: number,                 // Location ID for ward

  // Optional
  relatedAuctions?: string[]               // Array of related auction IDs
}
```

**Response** (201):

```typescript
{
  data: {
    // Full auction object (see Get Single Auction)
  },
  message: "Create auction successfully!"
}
```

**Error Responses**:

- 400: Invalid input or validation error
- 401: Unauthorized (no token)
- 403: Forbidden (insufficient permissions)

**Notes**:

- Images and attachments are uploaded separately via PATCH /auctions/:id/resources
- `code` must be unique across all auctions
- Timeline dates must be in logical order: saleStartAt < saleEndAt < auctionStartAt < auctionEndAt
- Deposit deadline should typically be before auction start

---

### 4. Update Auction

**Endpoint**: `PUT /auctions/:id`
**Access**: Admin, Auctioneer
**Authentication**: Required (Bearer token)
**Status**: 200 OK

**Path Parameters**:

- `id` (string, UUID) - Auction ID

**Request Body** (all fields optional):

```typescript
{
  code?: string,
  name?: string,
  assetType?: "secured_asset" | "land_use_rights" | "administrative_violation_asset" | "state_asset" | "enforcement_asset" | "other_asset",
  assetAddress?: string,
  assetDescription?: string,
  saleStartAt?: Date,
  saleEndAt?: Date,
  auctionStartAt?: Date,
  auctionEndAt?: Date,
  depositEndAt?: Date,
  startingPrice?: number,
  bidIncrement?: number,
  depositAmountRequired?: number,
  saleFee?: number,
  viewTime?: string,
  validCheckInBeforeStartMinutes?: number,
  validCheckInAfterStartMinutes?: number,
  propertyOwner?: {                      // Property owner JSON snapshot
    id: string,
    fullName: string,
    email: string,
    phoneNumber?: string,
    identityNumber?: string,
    userType?: string,
    avatarUrl?: string
  },
  assetProvinceId?: number,              // Location ID for province
  assetWardId?: number,                  // Location ID for ward
  relatedAuctions?: string[]
}
```

**Response** (200):

```typescript
{
  data: {
    // Full updated auction object
  },
  message: "Update auction successfully!"
}
```

**Error Responses**:

- 400: Invalid input
- 401: Unauthorized
- 403: Forbidden
- 404: Auction not found

**Notes**:

- Partial updates supported - only send fields you want to change
- `isActive` can be used to temporarily disable an auction without deleting it
- Be cautious updating auctions that have active participants

---

### 5. Update Auction Resources

**Endpoint**: `PATCH /auctions/:id/resources`
**Access**: Admin, Auctioneer
**Authentication**: Required (Bearer token)
**Content-Type**: `multipart/form-data`
**Status**: 200 OK

**Path Parameters**:

- `id` (string, UUID) - Auction ID

**Request Body** (multipart/form-data):

```
{
  images?: File[],           // Max 10 files, max 10MB each
  attachments?: File[]       // Max 10 files, max 10MB each
}
```

**Accepted File Types**:

- Images: jpg, jpeg, png, gif, webp
- Attachments: pdf, doc, docx, xls, xlsx, txt

**Response** (200):

```typescript
{
  data: {
    // Full auction object with updated images/attachments
    images: Array<{
      publicId: string,      // Cloudinary public ID
      url: string,           // Cloudinary URL
      sortOrder: number
    }>,
    attachments: Array<{
      publicId: string,
      url: string
    }>
  },
  message: "Updated resource successfully!"
}
```

**Error Responses**:

- 400: Invalid file type or size
- 401: Unauthorized
- 403: Forbidden
- 404: Auction not found

**Notes**:

- Files are automatically uploaded to Cloudinary
- Previous files are deleted from Cloudinary when replaced
- If upload fails, changes are rolled back and old files are preserved
- Images maintain a `sortOrder` for display control

---

## Schema Changes (Important)

### Updated Fields:

- **`images`**: Now stored as JSON array (previously separate table)
  - Each image has: `publicId`, `url`, `sortOrder`
- **`attachments`**: Now stored as JSON array (previously separate table)
  - Each attachment has: `publicId`, `url`
- **`maxBidStep`**: REMOVED (no longer used)
- **New fields**:
  - `assetType`: Enum for asset classification
  - `assetAddress`: Physical location of asset
  - `assetDescription`: Detailed asset information
  - `saleStartAt`, `saleEndAt`: Document sale period
  - `depositEndAt`: Deposit payment deadline
  - `saleFee`: Document purchase fee
  - `viewTime`: Asset viewing schedule
  - `validCheckInBeforeStartMinutes`: Check-in window before start
  - `validCheckInAfterStartMinutes`: Check-in window after start
  - `isActive`: Toggle auction visibility
  - `numberOfFollow`: Follow/favorite count

### Asset Types:

```typescript
enum AssetType {
  secured_asset = 'secured_asset',
  land_use_rights = 'land_use_rights',
  administrative_violation_asset = 'administrative_violation_asset',
  state_asset = 'state_asset',
  enforcement_asset = 'enforcement_asset',
  other_asset = 'other_asset',
}
```

### Auction Status:

```typescript
enum AuctionStatus {
  scheduled = 'scheduled', // Created and scheduled
  live = 'live', // Currently accepting bids
  awaiting_result = 'awaiting_result', // Pending evaluation (new)
  success = 'success', // Completed with winner
  failed = 'failed', // Completed without winner or cancelled
}
```

**Note**: The old `no_bid` and `cancelled` statuses have been replaced with `failed`.

---

## Common Use Cases

### Browse Active Auctions

```
GET /auctions?status=now&active=true
```

Returns currently live auctions that are active.

### Find Upcoming Auctions by Asset Type

```
GET /auctions?status=upcoming
```

Returns scheduled auctions (filter by assetType client-side).

### View Auction History

```
GET /auctions?status=completed&page=1&limit=50
```

Returns completed auctions for browsing past results.

### Get Full Auction Details

```
GET /auctions/{auctionId}
```

Returns complete auction information including owner, media, and related auctions.

### Create Complete Auction

```
1. POST /auctions (with all required fields)
2. PATCH /auctions/{id}/resources (upload images/attachments)
```

Two-step process: create auction, then upload media.

### Update Auction Status

```
PUT /auctions/{id}
Body: { "isActive": false }
```

Temporarily disable an auction.

---

## Integration Notes

### With Registration System:

- Users view auctions before registering via `GET /auctions/:id`
- Auction details show deposit requirements and timeline
- Registration endpoints reference auction by ID

### With Bidding System:

- Only auctions with status `live` accept bids
- Check-in requirements validated against `validCheckInBeforeStartMinutes` and `validCheckInAfterStartMinutes`
- `bidIncrement` enforces minimum bid increases

### With Finalization System:

- Completed auctions transition to `success` or `failed` status
- Winner information derived from highest bid
- Financial summaries calculated using auction pricing fields

### PropertyOwner Changes:

- **Old Schema**: `propertyOwner` was a UUID foreign key referencing `User` table
- **New Schema**: `propertyOwner` is a JSON object containing a snapshot of owner data
- This denormalization ensures owner data is preserved even if the user is later modified
- The JSON object contains: `id`, `fullName`, `email`, and optional fields like `phoneNumber`, `userType`, etc.

### With Cloudinary:

- All media stored in Cloudinary
- Public IDs used for file management and deletion
- URLs are permanent and CDN-optimized
- Automatic cleanup on update/delete operations
