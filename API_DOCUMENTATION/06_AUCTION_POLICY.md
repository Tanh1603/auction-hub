# Auction Policy Endpoints

## Base Path: `/auction-policy`

Auction policies define the rules, fees, and configurations for different types of auctions. Policies can be customized based on asset ownership type (state-owned vs private) and asset category.

All endpoints require authentication. Admin-only endpoints are marked accordingly.

---

## Policy CRUD Operations

### 1. Create Auction Policy

**Endpoint**: `POST /auction-policy`
**Access**: Admin/Super Admin only
**Status**: 201 Created
**Guards**: AuthGuard, RolesGuard

**Request Body**:
```typescript
{
  name: string,                                 // REQUIRED, e.g., "Standard State-Owned Policy"
  description?: string,                         // Optional policy description
  assetOwnership: "state_owned" | "private",   // REQUIRED, asset ownership type
  isActive?: boolean,                           // Default: true
  isDefault?: boolean,                          // Set as default for this ownership type (default: false)

  // Commission configuration (optional)
  commissionConfig?: {
    assetCategory: "general" | "land_use_right",
    tiers: Array<{
      from: number,                             // Price range start
      to: number,                               // Price range end
      rate: number,                             // Commission rate (0.05 = 5%)
      baseAmount: number                        // Base commission amount
    }>,
    minCommission?: number,                     // Min commission (e.g., 1,000,000 VND)
    maxCommission?: number                      // Max commission (e.g., 400,000,000 VND)
  },

  // Dossier fee configuration (optional)
  dossierConfig?: {
    feeTiers: Array<{
      startPriceFrom: number,                   // Starting price range start
      startPriceTo: number,                     // Starting price range end
      maxFee: number                            // Maximum dossier fee for this range
    }>
  },

  // Deposit configuration (optional)
  depositConfig?: {
    depositType: "percentage" | "fixed",        // How deposit is calculated
    assetCategory?: string,                     // Required for percentage deposits
    minPercentage?: number,                     // Min % (0-100, for percentage type)
    maxPercentage?: number,                     // Max % (0-100, for percentage type)
    fixedAmount?: number,                       // Fixed amount (for fixed type)
    minDepositAmount?: number,                  // Absolute min deposit
    maxDepositAmount?: number,                  // Absolute max deposit
    depositDeadlineHours?: number,              // Hours before auction to pay (default: 24)
    requiresDocuments?: boolean,                // Whether documents required
    requiredDocumentTypes?: string[],           // List of required document types
    refundDeadlineDays?: number                 // Days to process refund (default: 3)
  }
}
```

**Response** (201):
```typescript
{
  id: string,
  name: string,
  description?: string,
  assetOwnership: string,
  isActive: boolean,
  isDefault: boolean,
  commissionConfig?: object,
  dossierConfig?: object,
  depositConfig?: object,
  createdAt: Date,
  updatedAt: Date
}
```

**Error Responses**:
- 400: Invalid input data (validation failed)
- 403: Forbidden - Admin access required

---

### 2. Get All Policies

**Endpoint**: `GET /auction-policy`
**Access**: Authenticated users
**Status**: 200 OK

**Query Parameters**:
```
assetOwnership?: "state_owned" | "private"    // Filter by ownership type
isActive?: boolean                             // Filter by active status
isDefault?: boolean                            // Filter by default status
```

**Example Requests**:
```
GET /auction-policy                            // All policies
GET /auction-policy?assetOwnership=state_owned // State-owned policies only
GET /auction-policy?isDefault=true             // Default policies only
GET /auction-policy?isActive=true              // Active policies only
```

**Response** (200):
```typescript
[
  {
    id: string,
    name: string,
    description?: string,
    assetOwnership: string,
    isActive: boolean,
    isDefault: boolean,
    commissionConfig?: object,
    dossierConfig?: object,
    depositConfig?: object,
    createdAt: Date,
    updatedAt: Date
  },
  ...
]
```

---

### 3. Get Default Policy

**Endpoint**: `GET /auction-policy/default/:assetOwnership`
**Access**: Authenticated users
**Status**: 200 OK

**Path Parameters**:
- `assetOwnership` - "state_owned" or "private"

**Example Request**:
```
GET /auction-policy/default/state_owned
```

**Response** (200): Policy object (same structure as above)

**Error Responses**:
- 404: No default policy found for this ownership type

**Use Case**: Get the default policy when creating a new auction

---

### 4. Get Single Policy

**Endpoint**: `GET /auction-policy/:id`
**Access**: Authenticated users
**Status**: 200 OK

**Path Parameters**:
- `id` (string, UUID) - Policy ID

**Response** (200): Policy object (same structure as above)

**Error Responses**:
- 404: Policy not found

---

### 5. Update Policy

**Endpoint**: `PATCH /auction-policy/:id`
**Access**: Admin/Super Admin only
**Status**: 200 OK
**Guards**: AuthGuard, RolesGuard

**Path Parameters**:
- `id` (string, UUID) - Policy ID

**Request Body**: Partial policy object (same as create, all fields optional)

**Response** (200): Updated policy object

**Error Responses**:
- 404: Policy not found
- 403: Forbidden - Admin access required

---

### 6. Delete Policy

**Endpoint**: `DELETE /auction-policy/:id`
**Access**: Admin/Super Admin only
**Status**: 204 No Content
**Guards**: AuthGuard, RolesGuard

**Path Parameters**:
- `id` (string, UUID) - Policy ID

**Business Logic**:
- Can only delete if no auctions are using this policy
- Returns 409 Conflict if policy is in use

**Error Responses**:
- 404: Policy not found
- 409: Cannot delete - policy is currently in use by auctions
- 403: Forbidden - Admin access required

---

## Validation Endpoints

### 7. Validate Dossier Fee

**Endpoint**: `POST /auction-policy/validate/dossier-fee`
**Access**: Authenticated users
**Status**: 200 OK

**Request Body**:
```typescript
{
  dossierFee: number,        // The fee to validate
  startingPrice: number      // Auction starting price
}
```

**Response** (200):
```typescript
{
  valid: boolean,
  maxAllowedFee: number,
  providedFee: number,
  message?: string
}
```

**Use Case**: Validate dossier fee against policy limits when creating an auction

---

### 8. Validate Deposit Percentage

**Endpoint**: `POST /auction-policy/validate/deposit-percentage`
**Access**: Authenticated users
**Status**: 200 OK

**Request Body**:
```typescript
{
  percentage: number,                          // Deposit % to validate (0-100)
  assetCategory: "general" | "land_use_right"  // Asset category
}
```

**Response** (200):
```typescript
{
  valid: boolean,
  minPercentage: number,
  maxPercentage: number,
  providedPercentage: number,
  message?: string
}
```

**Use Case**: Validate deposit percentage when configuring auction deposit requirements

---

## Calculation Endpoints

### 9. Calculate Commission

**Endpoint**: `POST /auction-policy/calculate/commission`
**Access**: Authenticated users
**Status**: 200 OK

**Request Body**:
```typescript
{
  finalPrice: number,                          // Final sale/winning price
  assetCategory: "general" | "land_use_right"  // Asset category
}
```

**Response** (200):
```typescript
{
  finalPrice: number,
  assetCategory: string,
  commissionFee: number,
  calculation: {
    min: number,                               // Min commission (1,000,000)
    max: number,                               // Max commission (400,000,000)
    appliedFee: number                         // Actual calculated fee
  }
}
```

**Business Logic**:
- Uses tiered commission structure
- Enforces min/max commission limits
- Commonly used after auction finalization

---

### 10. Calculate Deposit

**Endpoint**: `POST /auction-policy/calculate/deposit`
**Access**: Authenticated users
**Status**: 200 OK

**Request Body**:
```typescript
{
  depositType: "percentage" | "fixed",
  startingPrice: number,
  percentage?: number,                         // Required if depositType = "percentage"
  fixedAmount?: number,                        // Required if depositType = "fixed"
  assetCategory?: "general" | "land_use_right" // Required if depositType = "percentage"
}
```

**Response** (200):
```typescript
{
  valid: boolean,
  depositType: string,
  startingPrice: number,
  percentage?: number,                         // If percentage type
  assetCategory?: string,                      // If percentage type
  fixedAmount?: number,                        // If fixed type
  depositAmount: number,                       // Calculated deposit amount
  message?: string                             // If validation failed
}
```

**Error Response** (200 with valid: false):
```typescript
{
  valid: false,
  message: "Validation error message"
}
```

**Business Logic**:
- Validates configuration before calculating
- Percentage type: deposit = startingPrice * (percentage / 100)
- Fixed type: deposit = fixedAmount
- Used when creating auction or during registration

---

## Asset Ownership Types

- **state_owned** - Assets owned by the government or state entities
- **private** - Assets owned by private individuals or businesses

Each ownership type can have its own default policy with different rules and fee structures.

---

## Asset Categories

- **general** - Standard assets (vehicles, equipment, real estate)
- **land_use_right** - Land use rights (specific regulations apply)

Different categories may have different commission rates and deposit requirements.

---

## Common Workflows

### Creating a New Auction with Policy
1. Get default policy: `GET /auction-policy/default/state_owned`
2. Validate dossier fee: `POST /auction-policy/validate/dossier-fee`
3. Calculate deposit: `POST /auction-policy/calculate/deposit`
4. Create auction with policy ID

### After Auction Finalization
1. Calculate commission: `POST /auction-policy/calculate/commission`
2. Generate invoice with commission fee
3. Process winner payment (winning bid + commission - deposit)

### Policy Management (Admin)
1. Create new policy: `POST /auction-policy`
2. Set as default: `PATCH /auction-policy/:id` with `isDefault: true`
3. List all policies: `GET /auction-policy`
4. Update existing: `PATCH /auction-policy/:id`
5. Delete unused: `DELETE /auction-policy/:id`
