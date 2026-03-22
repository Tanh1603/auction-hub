# Auction Policy Endpoints

## ⚠️ DEPRECATED - Replaced by System Variables (v3.0)

**Status**: Policy CRUD endpoints have been removed and replaced with System Variables.

**Migration Guide**: See [System Variables API](#system-variables-api-new) below for the new configuration approach.

---

## Overview

The Auction Policy system has been **significantly simplified** in v3.0. The complex 5-table policy CRUD system has been replaced with a simple **System Variables** configuration store.

### What Changed (v3.0)

**REMOVED (Deprecated):**

- ❌ All policy CRUD endpoints (`POST/GET/PATCH/DELETE /auction-policy`)
- ❌ Complex nested policy configurations
- ❌ AuctionPolicy, CommissionPolicyConfig, DossierFeePolicyConfig, DepositPolicyConfig tables

**NEW:**

- ✨ System Variables API - Simple admin-only configuration
- ✨ Key-value configuration store with caching
- ✨ All policy calculations now use system variables internally

**KEPT (Still Available):**

- ✅ Auction Costs endpoints (unchanged)
- ✅ All calculation logic (commission, deposit, dossier validation)
- ✅ Legal compliance with Vietnamese circulars (hardcoded tiers)

---

## System Variables API (NEW)

### Base Path: `/system-variables`

**Access**: Admin/Super Admin only  
**Purpose**: Configure system-wide settings that drive policy calculations

All system variable endpoints require admin authentication and are secured with role-based guards.

### 1. Get All System Variables

**Endpoint**: `GET /system-variables`
**Access**: Admin/Super Admin only
**Status**: 200 OK

**Query Parameters**:

```
category?: string    // Optional: Filter by category (e.g., "deposit", "commission")
```

**Response** (200):

```typescript
{
  "deposit": {
    "min_percentage_general": 5,
    "max_percentage_general": 20,
    "min_percentage_land": 10,
    "max_percentage_land": 20,
    "deadline_hours": 24,
    "refund_deadline_days": 3,
    "min_amount": 1000000
  },
  "commission": {
    "min_amount": 1000000,
    "max_amount": 400000000
  },
  "dossier": {
    "tier1_price_limit": 200000000,
    "tier1_max_fee": 100000,
    "tier2_price_limit": 500000000,
    "tier2_max_fee": 200000,
    "tier3_max_fee": 500000
  },
  "general": {
    "currency": "VND",
    "timezone": "Asia/Ho_Chi_Minh",
    "vat_rate": 10
  }
}
```

**Example with Category Filter**:

```
GET /system-variables?category=deposit
```

**Response**:

```json
{
  "category": "deposit",
  "variables": {
    "min_percentage_general": 5,
    "max_percentage_general": 20,
    "min_percentage_land": 10,
    "max_percentage_land": 20,
    "deadline_hours": 24,
    "refund_deadline_days": 3
  }
}
```

---

### 2. Get Single Variable

**Endpoint**: `GET /system-variables/:category/:key`
**Access**: Admin/Super Admin only
**Status**: 200 OK

**Path Parameters**:

- `category` (string) - Variable category (e.g., "deposit", "commission")
- `key` (string) - Variable key without category prefix (e.g., "min_percentage_general")

**Example Request**:

```
GET /system-variables/deposit/min_percentage_general
```

**Response** (200):

```json
{
  "category": "deposit",
  "key": "deposit.min_percentage_general",
  "value": 5
}
```

**Error Responses**:

- 404: Variable not found
- 403: Forbidden - Admin access required

---

### 3. Get Category Variables

**Endpoint**: `GET /system-variables/category/:category`
**Access**: Admin/Super Admin only
**Status**: 200 OK

**Path Parameters**:

- `category` (string) - Category name (e.g., "deposit", "commission", "dossier", "general")

**Example Request**:

```
GET /system-variables/category/commission
```

**Response** (200):

```json
{
  "min_amount": 1000000,
  "max_amount": 400000000
}
```

**Use Case**: Get all configuration values for a specific category

---

### 4. Update Variable

**Endpoint**: `PATCH /system-variables/:category/:key`
**Access**: Admin/Super Admin only
**Status**: 200 OK

**Path Parameters**:

- `category` (string) - Variable category
- `key` (string) - Variable key without category prefix

**Request Body**:

```json
{
  "value": "10",
  "description": "Updated minimum deposit percentage for general assets"
}
```

**Response** (200):

```json
{
  "message": "System variable updated successfully",
  "variable": {
    "id": "var_uuid",
    "category": "deposit",
    "key": "deposit.min_percentage_general",
    "value": "10",
    "dataType": "number",
    "description": "Updated minimum deposit percentage for general assets",
    "isActive": true,
    "updatedBy": "admin_user_id",
    "updatedAt": "2024-11-18T10:00:00.000Z"
  }
}
```

**Notes**:

- Updates automatically clear the cache
- Changes take effect immediately for new calculations
- Existing auctions/registrations are not affected

**Error Responses**:

- 404: Variable not found
- 403: Forbidden - Admin access required

---

### 5. Create Variable

**Endpoint**: `POST /system-variables`
**Access**: Admin/Super Admin only
**Status**: 201 Created

**Request Body**:

```json
{
  "category": "deposit",
  "key": "new_setting",
  "value": "15",
  "dataType": "number",
  "description": "New deposit configuration setting"
}
```

**Data Types**:

- `"number"` - Numeric values (parsed as float)
- `"boolean"` - True/false values
- `"string"` - Text values
- `"json"` - Complex JSON objects

**Response** (201):

```json
{
  "message": "System variable created successfully",
  "variable": {
    "id": "var_uuid",
    "category": "deposit",
    "key": "deposit.new_setting",
    "value": "15",
    "dataType": "number",
    "description": "New deposit configuration setting",
    "isActive": true,
    "createdAt": "2024-11-18T10:00:00.000Z"
  }
}
```

**Error Responses**:

- 400: Invalid input data
- 409: Variable already exists
- 403: Forbidden - Admin access required

---

### 6. Clear Cache

**Endpoint**: `POST /system-variables/cache/clear`
**Access**: Admin/Super Admin only
**Status**: 200 OK

**Query Parameters**:

```
category?: string    // Optional: Clear cache for specific category only
```

**Response** (200):

```json
{
  "message": "All system variables cache cleared"
}
```

**With Category**:

```
POST /system-variables/cache/clear?category=deposit
```

**Response**:

```json
{
  "message": "Cache cleared for category: deposit"
}
```

**Use Case**: Force cache refresh after bulk updates or when troubleshooting

---

### 7. Get Cache Statistics

**Endpoint**: `GET /system-variables/cache/stats`
**Access**: Admin/Super Admin only
**Status**: 200 OK

**Response** (200):

```json
{
  "totalEntries": 18,
  "validEntries": 15,
  "expiredEntries": 3,
  "cacheTTL": 300000
}
```

**Use Case**: Monitor cache performance and hit rates

---

## Available System Variables

### Deposit Configuration

| Variable Key                     | Default Value | Description                             |
| -------------------------------- | ------------- | --------------------------------------- |
| `deposit.min_percentage_general` | 5             | Minimum deposit % for general assets    |
| `deposit.max_percentage_general` | 20            | Maximum deposit % for general assets    |
| `deposit.min_percentage_land`    | 10            | Minimum deposit % for land use rights   |
| `deposit.max_percentage_land`    | 20            | Maximum deposit % for land use rights   |
| `deposit.deadline_hours`         | 24            | Hours to pay deposit after verification |
| `deposit.refund_deadline_days`   | 3             | Days to process deposit refund          |
| `deposit.min_amount`             | 1000000       | Absolute minimum deposit amount (VND)   |

### Commission Configuration

| Variable Key            | Default Value | Description                  |
| ----------------------- | ------------- | ---------------------------- |
| `commission.min_amount` | 1000000       | Minimum commission fee (VND) |
| `commission.max_amount` | 400000000     | Maximum commission fee (VND) |

**Note**: Commission tiers are **hardcoded by law** (Circular 45/2017, 108/2020) and cannot be changed via system variables.

### Dossier Fee Configuration

| Variable Key                | Default Value | Description                    |
| --------------------------- | ------------- | ------------------------------ |
| `dossier.tier1_price_limit` | 200000000     | Tier 1 upper price limit (VND) |
| `dossier.tier1_max_fee`     | 100000        | Max fee for Tier 1 (VND)       |
| `dossier.tier2_price_limit` | 500000000     | Tier 2 upper price limit (VND) |
| `dossier.tier2_max_fee`     | 200000        | Max fee for Tier 2 (VND)       |
| `dossier.tier3_max_fee`     | 500000        | Max fee for Tier 3+ (VND)      |

### General Configuration

| Variable Key       | Default Value    | Description         |
| ------------------ | ---------------- | ------------------- |
| `general.currency` | VND              | System currency     |
| `general.timezone` | Asia/Ho_Chi_Minh | System timezone     |
| `general.vat_rate` | 10               | VAT rate percentage |

---

## Policy Calculation Endpoints (Unchanged)

These endpoints continue to work but now use system variables internally instead of database policies.

### 8. Validate Dossier Fee

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

**Business Logic**:

- Uses system variables for tier limits
- Tiers dynamically loaded from `dossier.tier1_price_limit`, `dossier.tier2_price_limit`
- Max fees from `dossier.tier1_max_fee`, `dossier.tier2_max_fee`, `dossier.tier3_max_fee`

**Use Case**: Validate dossier fee against policy limits when creating an auction

---

### 9. Validate Deposit Percentage

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

**Business Logic**:

- Uses system variables for min/max ranges
- General assets: `deposit.min_percentage_general` to `deposit.max_percentage_general`
- Land use rights: `deposit.min_percentage_land` to `deposit.max_percentage_land`

**Use Case**: Validate deposit percentage when configuring auction deposit requirements

---

### 10. Calculate Commission

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

- Uses **hardcoded legal tiers** (Circular 45/2017, 108/2020)
- Enforces min/max from system variables: `commission.min_amount`, `commission.max_amount`
- Progressive tier calculation (see Legal Compliance section)
- Commonly used after auction finalization

---

### 11. Calculate Deposit

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

- Validates configuration using system variables
- Percentage type: deposit = startingPrice \* (percentage / 100)
- Fixed type: deposit = fixedAmount
- Min/max constraints from system variables
- Used when creating auction or during registration

---

## Auction Costs API (Unchanged)

The auction costs endpoints remain unchanged and continue to track variable expenses.

**Base Path**: `/auction-costs`

### 12. Create/Update Auction Costs

**Endpoint**: `POST /auction-costs/auction/:auctionId`
**Access**: Admin/Auctioneer only

**Request Body**:

```json
{
  "advertisingCost": 2000000,
  "venueRentalCost": 5000000,
  "appraisalCost": 10000000,
  "assetViewingCost": 1000000,
  "otherCosts": [
    {
      "description": "Security personnel",
      "amount": 5000000
    }
  ]
}
```

### 13. Get Auction Costs

**Endpoint**: `GET /auction-costs/auction/:auctionId`

### 14. Update Auction Costs

**Endpoint**: `PATCH /auction-costs/auction/:auctionId`

### 15. Delete Auction Costs

**Endpoint**: `DELETE /auction-costs/auction/:auctionId`

### 16. Add Other Cost

**Endpoint**: `POST /auction-costs/auction/:auctionId/other-cost`

See detailed documentation in the Auction Costs section.

---

## Asset Categories

- **general** - Standard assets (vehicles, equipment, real estate)
- **land_use_right** - Land use rights (specific regulations apply)

Different categories have different commission rates and deposit requirements configured via system variables.

---

## Legal Compliance

### Commission Calculation Tiers (Hardcoded by Law)

**Circular 45/2017, Updated by 108/2020**

Commission tiers are **hardcoded in code** and cannot be changed via system variables. Only min/max constraints are configurable.

**General Assets**:

- 0 - 50M: 5%
- 50M - 100M: 3.5% + 2.5M base
- 100M - 500M: 3% + 4.25M base
- 500M - 1B: 2.5% + 16.25M base
- 1B - 5B: 1.5% + 26.25M base
- 5B - 10B: 0.2% + 86.25M base
- 10B+: 0.1% + 96.25M base

**Land Use Rights**:

- 0 - 5B: 0.45% + 50M base
- 5B - 10B: 0.15% + 72.5M base
- 10B+: 0.1% + 80M base

**Constraints** (configurable via system variables):

- Min: `commission.min_amount` (1,000,000 VND)
- Max: `commission.max_amount` (400,000,000 VND)

---

## Migration from v2.0 to v3.0

### For API Consumers

**Old Approach (DEPRECATED)**:

```javascript
// Get default policy
const policy = await fetch('/auction-policy/default/state_owned');

// Use policy configuration
const depositPercentage = policy.depositConfig.minPercentage;
```

**New Approach (v3.0)**:

```javascript
// Policy calculations work the same way - no changes needed!
// System variables are used internally

// Validation still works
const validation = await fetch('/auction-policy/validate/deposit-percentage', {
  method: 'POST',
  body: JSON.stringify({
    percentage: 10,
    assetCategory: 'general',
  }),
});

// Calculations still work
const commission = await fetch('/auction-policy/calculate/commission', {
  method: 'POST',
  body: JSON.stringify({
    finalPrice: 2500000000,
    assetCategory: 'general',
  }),
});
```

### For Administrators

**Old Workflow**: Create/update policies via `/auction-policy` endpoints

**New Workflow**: Configure system variables via `/system-variables` endpoints

**Example**: Update minimum deposit percentage

```bash
# v3.0 approach
curl -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"10"}' \
  http://localhost:3000/system-variables/deposit/min_percentage_general
```

---

## Common Workflows

### Creating a New Auction (v3.0)

1. Validate dossier fee: `POST /auction-policy/validate/dossier-fee`
2. Calculate deposit: `POST /auction-policy/calculate/deposit`
3. Create auction (system uses variables internally)

### After Auction Finalization (v3.0)

1. Calculate commission: `POST /auction-policy/calculate/commission`
2. Generate invoice with commission fee
3. Process winner payment (winning bid + commission - deposit)

### System Configuration (Admin - v3.0)

1. View all variables: `GET /system-variables`
2. Update specific value: `PATCH /system-variables/:category/:key`
3. Clear cache after changes: `POST /system-variables/cache/clear`
4. Monitor cache stats: `GET /system-variables/cache/stats`
