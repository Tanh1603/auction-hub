# Auction Costs Endpoints

## Base Path: `/auction-costs`

Auction costs track specific expenses associated with conducting individual auctions. These costs are separate from policy-based fees and represent actual operational expenses.

All endpoints require authentication. Admin/Auctioneer-only endpoints are marked accordingly.

---

## Cost Management Operations

### 1. Create or Update Auction Costs

**Endpoint**: `POST /auction-costs/auction/:auctionId`
**Access**: Admin/Auctioneer/Super Admin only
**Status**: 201 Created
**Guards**: AuthGuard, RolesGuard
**Roles**: ADMIN, AUCTIONEER, SUPER_ADMIN

**Path Parameters**:
- `auctionId` (string, UUID) - Auction ID

**Request Body**:
```typescript
{
  advertisingCost?: number,        // Advertising and publication costs (min: 0)
  venueRentalCost?: number,        // Venue rental costs (min: 0)
  appraisalCost?: number,          // Asset appraisal costs (min: 0)
  assetViewingCost?: number,       // Asset viewing/inspection costs (min: 0)
  otherCosts?: Array<{
    description: string,            // Description of the cost item (REQUIRED)
    amount: number                  // Cost amount (REQUIRED, min: 0)
  }>
}
```

**Example Request**:
```json
{
  "advertisingCost": 2000000,
  "venueRentalCost": 5000000,
  "appraisalCost": 10000000,
  "assetViewingCost": 1000000,
  "otherCosts": [
    {
      "description": "Security personnel for 3 days",
      "amount": 5000000
    },
    {
      "description": "Photography and documentation",
      "amount": 1500000
    }
  ]
}
```

**Response** (201):
```typescript
{
  id: string,
  auctionId: string,
  advertisingCost: number,
  venueRentalCost: number,
  appraisalCost: number,
  assetViewingCost: number,
  otherCosts: Array<{
    description: string,
    amount: number
  }>,
  totalCost: number,                // Sum of all costs
  createdAt: Date,
  updatedAt: Date
}
```

**Business Logic**:
- Creates new cost record if none exists for the auction
- Updates existing record if one already exists (upsert operation)
- Automatically calculates totalCost by summing all cost fields
- All cost fields are optional, allowing partial updates

**Error Responses**:
- 404: Auction not found
- 403: Forbidden - Admin/Auctioneer access required
- 400: Invalid input (negative costs, invalid format)

---

### 2. Get Auction Costs

**Endpoint**: `GET /auction-costs/auction/:auctionId`
**Access**: Authenticated users
**Status**: 200 OK

**Path Parameters**:
- `auctionId` (string, UUID) - Auction ID

**Response** (200):
```typescript
{
  id: string,
  auctionId: string,
  advertisingCost: number,
  venueRentalCost: number,
  appraisalCost: number,
  assetViewingCost: number,
  otherCosts: Array<{
    description: string,
    amount: number
  }>,
  totalCost: number,
  createdAt: Date,
  updatedAt: Date
}
```

**Error Responses**:
- 404: Costs not found for this auction

**Use Case**: View cost breakdown for an auction

---

### 3. Update Specific Cost Fields

**Endpoint**: `PATCH /auction-costs/auction/:auctionId`
**Access**: Admin/Auctioneer/Super Admin only
**Status**: 200 OK
**Guards**: AuthGuard, RolesGuard
**Roles**: ADMIN, AUCTIONEER, SUPER_ADMIN

**Path Parameters**:
- `auctionId` (string, UUID) - Auction ID

**Request Body**: Partial cost object (all fields optional)
```typescript
{
  advertisingCost?: number,
  venueRentalCost?: number,
  appraisalCost?: number,
  assetViewingCost?: number,
  otherCosts?: Array<{
    description: string,
    amount: number
  }>
}
```

**Example Request** (Update only advertising cost):
```json
{
  "advertisingCost": 2500000
}
```

**Response** (200): Updated cost object (same structure as GET response)

**Business Logic**:
- Only updates the fields provided in request body
- Other fields remain unchanged
- Recalculates totalCost after update
- Replaces otherCosts array entirely if provided (not merged)

**Error Responses**:
- 404: Costs not found
- 403: Forbidden - Admin/Auctioneer access required

---

### 4. Delete Auction Costs

**Endpoint**: `DELETE /auction-costs/auction/:auctionId`
**Access**: Admin/Super Admin only
**Status**: 204 No Content
**Guards**: AuthGuard, RolesGuard
**Roles**: ADMIN, SUPER_ADMIN

**Path Parameters**:
- `auctionId` (string, UUID) - Auction ID

**Response**: 204 No Content (empty body on success)

**Error Responses**:
- 404: Costs not found
- 403: Forbidden - Admin access required

**Use Case**: Remove cost record if entered in error or auction cancelled

---

### 5. Add Individual Other Cost

**Endpoint**: `POST /auction-costs/auction/:auctionId/other-cost`
**Access**: Admin/Auctioneer/Super Admin only
**Status**: 201 Created
**Guards**: AuthGuard, RolesGuard
**Roles**: ADMIN, AUCTIONEER, SUPER_ADMIN

**Path Parameters**:
- `auctionId` (string, UUID) - Auction ID

**Request Body**:
```typescript
{
  description: string,              // REQUIRED, description of cost item
  amount: number                    // REQUIRED, cost amount (min: 0)
}
```

**Example Request**:
```json
{
  "description": "Emergency repairs to venue",
  "amount": 3000000
}
```

**Response** (201):
```typescript
{
  id: string,
  auctionId: string,
  advertisingCost: number,
  venueRentalCost: number,
  appraisalCost: number,
  assetViewingCost: number,
  otherCosts: Array<{
    description: string,
    amount: number
  }>,                               // New item appended to array
  totalCost: number,                // Recalculated to include new cost
  createdAt: Date,
  updatedAt: Date
}
```

**Business Logic**:
- Adds a single item to the otherCosts array
- Does not replace existing otherCosts items
- Automatically recalculates totalCost
- Creates cost record if none exists

**Error Responses**:
- 404: Costs not found
- 403: Forbidden - Admin/Auctioneer access required
- 400: Invalid input (missing fields, negative amount)

---

## Cost Categories Explained

### Standard Cost Fields

1. **advertisingCost**
   - Newspaper ads, online listings, promotional materials
   - Marketing and outreach expenses
   - Publication fees

2. **venueRentalCost**
   - Physical auction venue rental
   - Equipment rental (podium, microphone, seating)
   - Facility usage fees

3. **appraisalCost**
   - Professional asset valuation
   - Expert assessment fees
   - Market analysis costs

4. **assetViewingCost**
   - Open house arrangements
   - Guided tours and inspections
   - Security during viewing periods

5. **otherCosts** (Array)
   - Miscellaneous expenses not fitting other categories
   - Each item has description and amount
   - Examples:
     - Security personnel
     - Photography/videography
     - Legal fees
     - Document preparation
     - Transportation costs
     - Insurance

### Total Cost Calculation

`totalCost = advertisingCost + venueRentalCost + appraisalCost + assetViewingCost + sum(otherCosts)`

---

## Common Workflows

### Setting Up Costs for New Auction
```
1. POST /auction-costs/auction/{auctionId}
   Body: {
     "appraisalCost": 10000000,
     "advertisingCost": 2000000
   }
```

### Adding Cost as Auction Progresses
```
1. POST /auction-costs/auction/{auctionId}/other-cost
   Body: {
     "description": "Last-minute venue change",
     "amount": 3000000
   }
```

### Updating Existing Cost
```
1. PATCH /auction-costs/auction/{auctionId}
   Body: {
     "venueRentalCost": 6000000
   }
```

### Viewing Final Cost Breakdown
```
1. GET /auction-costs/auction/{auctionId}

   Returns complete breakdown with totalCost
```

### Cost Recovery After Auction
```
1. GET /auction-costs/auction/{auctionId}
2. Use totalCost in financial calculations
3. Costs typically recovered from:
   - Commission fees
   - Dossier fees
   - Winner payment
```

---

## Relationship with Other Modules

### Auction Policy vs Auction Costs

- **Auction Policy**: Template-based fees (commission %, deposit %, dossier fee tiers)
- **Auction Costs**: Actual operational expenses for specific auction

### Cost Recovery Flow

1. Auction costs recorded during auction setup and execution
2. Policy-based fees calculated at finalization
3. Commission and fees cover operational costs
4. Remaining amount is profit or goes to asset owner

### Financial Calculation Example

```
Winning Bid: 100,000,000 VND
Deposit Paid: 20,000,000 VND
Commission (from policy): 5,000,000 VND
Total Costs (from costs module): 18,000,000 VND

Winner Payment: 100,000,000 - 20,000,000 = 80,000,000 VND
Revenue: 5,000,000 VND (commission)
Net Profit: 5,000,000 - 18,000,000 = -13,000,000 VND (loss)
```

In this example, the auction operated at a loss. The platform would need to:
- Adjust commission rates in policy
- Reduce operational costs
- Increase dossier fees
- Review cost-effectiveness

---

## Best Practices

1. **Record costs as they occur** - Don't wait until auction end
2. **Be specific in descriptions** - Helps with accounting and audits
3. **Use PATCH for incremental updates** - Safer than replacing entire record
4. **Review totalCost regularly** - Ensure profitability
5. **Use otherCosts for unusual expenses** - Keep standard fields for common costs
6. **Delete costs only if truly needed** - Better to set to 0 for audit trail
