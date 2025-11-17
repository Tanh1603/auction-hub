# Auction Policy Feature - Technical Documentation

**Version:** 2.0  
**Last Updated:** November 17, 2024  
**Status:** ✅ Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Core Modules](#core-modules)
5. [API Reference](#api-reference)
6. [Usage Examples](#usage-examples)
7. [Legal Compliance](#legal-compliance)
8. [Testing Guide](#testing-guide)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)

---

## Overview

The **Auction Policy** feature is the central configuration system for all auction fees, commissions, deposits, and costs in the Auction Hub platform. It implements Vietnamese legal regulations and provides a flexible, rule-based system for managing financial policies across different auction types.

### Key Capabilities

- **Commission Calculation** - Progressive tiered calculation based on final sale price (Circular 45/2017, 108/2020)
- **Dossier Fee Validation** - Maximum fee validation based on starting price (Circular 48/2017)
- **Deposit Policy Management** - Support for both percentage-based and fixed-amount deposits
- **Auction Cost Tracking** - Track variable costs like advertising, venue rental, appraisal, etc.
- **Financial Summary Generation** - Automatic calculation of complete financial breakdown after auction finalization

### Business Value

- ✅ **Regulatory Compliance** - Ensures all auctions comply with Vietnamese legal requirements
- ✅ **Transparency** - Provides clear breakdown of all fees and calculations
- ✅ **Flexibility** - Supports multiple policy configurations for different asset types
- ✅ **Automation** - Eliminates manual fee calculations and reduces errors
- ✅ **Auditability** - Complete tracking of policy usage and financial calculations

---

## Architecture

### High-Level Design

```
┌──────────────────────────────────────────────────────────┐
│                   AUCTION POLICY HUB                      │
│                 (Central Configuration)                   │
└──────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Module 1 │    │ Module 2 │    │ Module 3 │
    │Commission│    │ Dossier  │    │ Deposit  │
    │          │    │ Fee      │    │ Policy   │
    └──────────┘    └──────────┘    └──────────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Module 4   │
                    │ Auction Costs│
                    └──────────────┘
                           │
                           ▼
                ┌────────────────────────┐
                │  Financial Summary     │
                │  (Auto-Generated)      │
                └────────────────────────┘
```

### Module Structure

```
auction-policy/
├── auction-policy.module.ts          # Module definition
├── auction-policy.service.ts         # CRUD operations for policies
├── auction-policy.controller.ts      # Policy API endpoints
├── policy-calculation.service.ts     # Business logic & calculations
├── auction-cost.service.ts           # Cost tracking operations
├── auction-cost.controller.ts        # Cost API endpoints
└── dto/
    ├── create-auction-policy.dto.ts  # Policy creation DTOs
    ├── update-auction-policy.dto.ts  # Policy update DTOs
    ├── create-auction-cost.dto.ts    # Cost creation DTOs
    ├── update-auction-cost.dto.ts    # Cost update DTOs
    └── validate-fees.dto.ts          # Validation & calculation DTOs
```

### Service Responsibilities

| Service                      | Responsibility                                                     |
| ---------------------------- | ------------------------------------------------------------------ |
| **AuctionPolicyService**     | CRUD operations for auction policies and configurations            |
| **PolicyCalculationService** | All business logic: calculations, validations, financial summaries |
| **AuctionCostService**       | Track and manage variable auction costs                            |

---

## Database Schema

### Core Models

#### 1. AuctionPolicy

The main policy entity that groups all configuration modules.

```prisma
model AuctionPolicy {
  id                String          @id @db.Uuid
  name              String          @db.VarChar(255)
  description       String?         @db.Text
  assetOwnership    AssetOwnership  // state_owned | private
  isActive          Boolean         @default(true)
  isDefault         Boolean         @default(false)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  // Module configurations
  commissionConfig  CommissionPolicyConfig?
  dossierConfig     DossierFeePolicyConfig?
  depositConfig     DepositPolicyConfig?

  // Relations
  auctions          Auction[]
}
```

**Key Fields:**

- `assetOwnership` - Determines which asset types this policy applies to (state-owned vs private)
- `isActive` - Controls whether the policy can be used for new auctions
- `isDefault` - Marks this as the default policy for its asset ownership type

#### 2. CommissionPolicyConfig (Module 1)

Defines progressive tiered commission calculation.

```prisma
model CommissionPolicyConfig {
  id                String        @id @db.Uuid
  policyId          String        @unique @db.Uuid
  assetCategory     String        @default("general") // "general" | "land_use_right"
  tiers             Json          // Array of tier definitions
  minCommission     Decimal       @default(1000000)
  maxCommission     Decimal       @default(400000000)
  createdAt         DateTime
  updatedAt         DateTime

  policy            AuctionPolicy @relation(fields: [policyId], references: [id], onDelete: Cascade)
}
```

**Tier Structure (JSON):**

```typescript
[
  {
    from: 0,
    to: 50000000,
    rate: 0.05, // 5%
    baseAmount: 0,
  },
  {
    from: 50000000,
    to: 100000000,
    rate: 0.035, // 3.5%
    baseAmount: 2500000,
  },
  // ... more tiers
];
```

#### 3. DossierFeePolicyConfig (Module 2)

Validates maximum dossier fees based on starting price.

```prisma
model DossierFeePolicyConfig {
  id                String        @id @db.Uuid
  policyId          String        @unique @db.Uuid
  feeTiers          Json          // Array of validation rules
  createdAt         DateTime
  updatedAt         DateTime

  policy            AuctionPolicy @relation(fields: [policyId], references: [id], onDelete: Cascade)
}
```

**Fee Tier Structure (JSON):**

```typescript
[
  {
    startPriceFrom: 0,
    startPriceTo: 200000000,
    maxFee: 100000,
  },
  {
    startPriceFrom: 200000000,
    startPriceTo: 500000000,
    maxFee: 200000,
  },
  // ... more tiers
];
```

#### 4. DepositPolicyConfig (Module 3)

Supports both percentage-based and fixed-amount deposits.

```prisma
model DepositPolicyConfig {
  id                    String        @id @db.Uuid
  policyId              String        @unique @db.Uuid

  // Type configuration
  depositType           String        @default("percentage") // "percentage" | "fixed"

  // Percentage-based config
  assetCategory         String        @default("general")
  minPercentage         Decimal       @default(5)
  maxPercentage         Decimal       @default(20)

  // Fixed-amount config
  fixedAmount           Decimal?

  // Constraints (both types)
  minDepositAmount      Decimal?
  maxDepositAmount      Decimal?

  // Administrative rules
  depositDeadlineHours  Int           @default(24)
  requiresDocuments     Boolean       @default(true)
  requiredDocumentTypes Json?
  refundDeadlineDays    Int           @default(3)

  createdAt             DateTime
  updatedAt             DateTime

  policy                AuctionPolicy @relation(fields: [policyId], references: [id], onDelete: Cascade)
}
```

#### 5. AuctionCost (Module 4)

Tracks variable costs per auction.

```prisma
model AuctionCost {
  id                String    @id @db.Uuid
  auctionId         String    @unique @db.Uuid

  // Cost categories
  advertisingCost   Decimal?  @default(0)
  venueRentalCost   Decimal?  @default(0)
  appraisalCost     Decimal?  @default(0)
  assetViewingCost  Decimal?  @default(0)
  otherCosts        Json?     // Array of custom costs

  // Total
  totalCosts        Decimal   @default(0)
  documents         Json?     // Supporting documents

  createdAt         DateTime
  updatedAt         DateTime

  auction           Auction   @relation(fields: [auctionId], references: [id], onDelete: Cascade)
}
```

**Other Costs Structure (JSON):**

```typescript
[
  {
    description: 'Security personnel for 3 days',
    amount: 5000000,
    documentUrl: 'https://...',
  },
];
```

#### 6. AuctionFinancialSummary

Auto-generated after auction finalization.

```prisma
model AuctionFinancialSummary {
  id                    String    @id @db.Uuid
  auctionId             String    @unique @db.Uuid

  // Sale information
  finalSalePrice        Decimal
  startingPrice         Decimal

  // Calculated fees
  commissionFee         Decimal
  dossierFee            Decimal
  depositAmount         Decimal

  // Costs
  totalAuctionCosts     Decimal

  // Totals
  totalFeesToSeller     Decimal   // Commission + Costs
  netAmountToSeller     Decimal   // FinalPrice - TotalFees

  // Calculation breakdown (JSON for transparency)
  calculationDetails    Json

  createdAt             DateTime
  updatedAt             DateTime

  auction               Auction   @relation(fields: [auctionId], references: [id], onDelete: Cascade)
}
```

---

## Core Modules

### Module 1: Commission Calculation

**Purpose:** Calculate commission/remuneration fee based on final sale price using progressive tiered rates.

**Legal Reference:** Circular 45/2017, Circular 108/2020

#### Calculation Logic

**For General Assets:**

| Price Range (VND) | Rate | Base Amount (VND) |
| ----------------- | ---- | ----------------- |
| 0 - 50M           | 5%   | 0                 |
| 50M - 100M        | 3.5% | 2,500,000         |
| 100M - 500M       | 3%   | 4,250,000         |
| 500M - 1B         | 2.5% | 16,250,000        |
| 1B - 5B           | 1.5% | 26,250,000        |
| 5B - 10B          | 0.2% | 86,250,000        |
| 10B+              | 0.1% | 96,250,000        |

**For Land Use Rights:**

| Price Range (VND) | Rate  | Base Amount (VND) |
| ----------------- | ----- | ----------------- |
| 0 - 5B            | 0.45% | 50,000,000        |
| 5B - 10B          | 0.15% | 72,500,000        |
| 10B+              | 0.1%  | 80,000,000        |

**Constraints:**

- Minimum: 1,000,000 VND
- Maximum: 400,000,000 VND

#### Implementation

```typescript
// PolicyCalculationService
calculateCommission(
  finalPrice: number,
  assetCategory: 'general' | 'land_use_right' = 'general'
): number
```

**Example:**

```typescript
// General asset sold for 2.5B VND
const commission = policyCalc.calculateCommission(2500000000, 'general');
// Result: 26,250,000 + (2,500,000,000 - 1,000,000,000) * 0.015 = 48,750,000 VND
```

---

### Module 2: Dossier Fee Validation

**Purpose:** Validate that dossier fees don't exceed legal maximum based on starting price.

**Legal Reference:** Circular 48/2017

#### Validation Rules

| Starting Price Range (VND) | Maximum Fee (VND) |
| -------------------------- | ----------------- |
| 0 - 200M                   | 100,000           |
| 200M - 500M                | 200,000           |
| 500M+                      | 500,000           |

#### Implementation

```typescript
// PolicyCalculationService
validateDossierFee(
  dossierFee: number,
  startingPrice: number
): {
  valid: boolean;
  message?: string;
  maxAllowed?: number;
}
```

**Example:**

```typescript
const result = policyCalc.validateDossierFee(150000, 180000000);
// Result: { valid: false, message: "...", maxAllowed: 100000 }
```

---

### Module 3: Deposit Policy

**Purpose:** Calculate and validate deposit amounts using either percentage-based or fixed-amount methods.

**Legal Reference:** Circular 48/2017

#### Two Deposit Types

**1. Percentage-Based Deposit**

Rules by asset category:

- **General Assets:** 5% - 20%
- **Land Use Rights:** 10% - 20%

```typescript
// PolicyCalculationService
validateDepositPercentage(
  percentage: number,
  assetCategory: 'general' | 'land_use_right'
): {
  valid: boolean;
  message?: string;
  range?: { min: number; max: number };
}
```

**Example:**

```typescript
const result = policyCalc.validateDepositPercentage(15, 'general');
// Result: { valid: true }
```

**2. Fixed-Amount Deposit**

Exact VND amount specified, with optional min/max constraints.

```typescript
// PolicyCalculationService
calculateDepositAmount(
  depositType: 'percentage' | 'fixed',
  startingPrice: number,
  percentage?: number,
  fixedAmount?: number,
  constraints?: {
    minDepositAmount?: number;
    maxDepositAmount?: number;
  }
): number
```

**Example - Percentage:**

```typescript
const deposit = policyCalc.calculateDepositAmount(
  'percentage',
  100000000, // 100M starting price
  10, // 10%
  undefined,
  { minDepositAmount: 5000000, maxDepositAmount: 50000000 }
);
// Result: 10,000,000 VND
```

**Example - Fixed:**

```typescript
const deposit = policyCalc.calculateDepositAmount(
  'fixed',
  100000000, // Starting price (not used for fixed)
  undefined,
  15000000, // 15M fixed deposit
  { minDepositAmount: 5000000, maxDepositAmount: 50000000 }
);
// Result: 15,000,000 VND
```

#### Deposit Configuration Fields

```typescript
interface DepositConfig {
  depositType: 'percentage' | 'fixed';

  // For percentage deposits
  assetCategory?: string;
  minPercentage?: number;
  maxPercentage?: number;

  // For fixed deposits
  fixedAmount?: number;

  // Constraints (both types)
  minDepositAmount?: number;
  maxDepositAmount?: number;

  // Administrative rules
  depositDeadlineHours: number; // Default: 24
  requiresDocuments: boolean; // Default: true
  requiredDocumentTypes?: string[];
  refundDeadlineDays: number; // Default: 3
}
```

---

### Module 4: Auction Costs

**Purpose:** Track all variable costs associated with running an auction.

#### Cost Categories

1. **Advertising Cost** - Publication and promotional expenses
2. **Venue Rental Cost** - Physical or virtual venue costs
3. **Appraisal Cost** - Professional asset valuation
4. **Asset Viewing Cost** - Inspection and viewing arrangements
5. **Other Costs** - Flexible category for custom expenses

#### Implementation

```typescript
// PolicyCalculationService
calculateTotalCosts(costs: {
  advertisingCost?: number;
  venueRentalCost?: number;
  appraisalCost?: number;
  assetViewingCost?: number;
  otherCosts?: Array<{ description: string; amount: number }>;
}): number
```

**Example:**

```typescript
const totalCosts = policyCalc.calculateTotalCosts({
  advertisingCost: 2000000,
  venueRentalCost: 5000000,
  appraisalCost: 10000000,
  assetViewingCost: 1000000,
  otherCosts: [
    { description: 'Security personnel', amount: 5000000 },
    { description: 'Insurance', amount: 3000000 },
  ],
});
// Result: 26,000,000 VND
```

---

### Financial Summary Generation

**Purpose:** Automatically calculate complete financial breakdown after auction finalization.

#### Summary Components

```typescript
interface FinancialSummary {
  // Sale information
  finalSalePrice: number;
  startingPrice: number;

  // Calculated fees
  commissionFee: number;
  dossierFee: number;
  depositAmount: number;

  // Costs
  totalAuctionCosts: number;

  // Totals
  totalFeesToSeller: number;  // commission + costs
  netAmountToSeller: number;  // finalPrice - totalFees

  // Detailed breakdown
  details: {
    commission: {...},
    dossierFee: {...},
    deposit: {...},
    costs: {...}
  }
}
```

#### Implementation

```typescript
// PolicyCalculationService
async calculateAuctionFinancialSummary(
  auctionId: string,
  finalSalePrice: number
)
```

**Calculation Steps:**

1. Fetch auction with policy and costs
2. Calculate commission fee based on final price
3. Get dossier fee (already validated)
4. Calculate deposit amount from policy
5. Sum all auction costs
6. Calculate totals:
   - `totalFeesToSeller = commission + costs`
   - `netAmountToSeller = finalPrice - totalFeesToSeller`
7. Store in `AuctionFinancialSummary` table
8. Return complete breakdown

**Example Output:**

```json
{
  "finalSalePrice": 2500000000,
  "commissionFee": 48750000,
  "dossierFee": 200000,
  "depositAmount": 125000000,
  "totalAuctionCosts": 26000000,
  "totalFeesToSeller": 74750000,
  "netAmountToSeller": 2425250000,
  "details": {
    "commission": {
      "assetCategory": "general",
      "finalSalePrice": 2500000000,
      "commissionFee": 48750000,
      "calculation": "26,250,000 + (2,500,000,000 - 1,000,000,000) * 1.5%"
    },
    "dossierFee": {
      "amount": 200000,
      "startingPrice": 2000000000
    },
    "deposit": {
      "type": "percentage",
      "percentage": 5,
      "startingPrice": 2500000000,
      "amount": 125000000
    },
    "costs": {
      "advertisingCost": 2000000,
      "venueRentalCost": 5000000,
      "appraisalCost": 10000000,
      "assetViewingCost": 1000000,
      "otherCosts": [
        { "description": "Security", "amount": 5000000 },
        { "description": "Insurance", "amount": 3000000 }
      ],
      "total": 26000000
    }
  }
}
```

---

## API Reference

### Policy Management

#### Create Auction Policy

```http
POST /auction-policy
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Standard State-Owned Policy (Circular 45/2017)",
  "description": "Policy compliant with Vietnamese regulations",
  "assetOwnership": "state_owned",
  "isActive": true,
  "isDefault": true,
  "commissionConfig": {
    "assetCategory": "general",
    "tiers": [
      {
        "from": 0,
        "to": 50000000,
        "rate": 0.05,
        "baseAmount": 0
      },
      {
        "from": 50000000,
        "to": 100000000,
        "rate": 0.035,
        "baseAmount": 2500000
      }
    ],
    "minCommission": 1000000,
    "maxCommission": 400000000
  },
  "dossierConfig": {
    "feeTiers": [
      {
        "startPriceFrom": 0,
        "startPriceTo": 200000000,
        "maxFee": 100000
      },
      {
        "startPriceFrom": 200000000,
        "startPriceTo": 500000000,
        "maxFee": 200000
      }
    ]
  },
  "depositConfig": {
    "depositType": "percentage",
    "assetCategory": "general",
    "minPercentage": 5,
    "maxPercentage": 20,
    "depositDeadlineHours": 24,
    "requiresDocuments": true,
    "refundDeadlineDays": 3
  }
}
```

**Response:** `201 Created`

```json
{
  "id": "policy_abc123",
  "name": "Standard State-Owned Policy (Circular 45/2017)",
  "assetOwnership": "state_owned",
  "isActive": true,
  "isDefault": true,
  "commissionConfig": {...},
  "dossierConfig": {...},
  "depositConfig": {...},
  "createdAt": "2024-11-17T10:00:00Z",
  "updatedAt": "2024-11-17T10:00:00Z"
}
```

**Access:** Admin only

---

#### Get All Policies

```http
GET /auction-policy?assetOwnership=state_owned&isActive=true
Authorization: Bearer {token}
```

**Query Parameters:**

- `assetOwnership` (optional): `state_owned` | `private`
- `isActive` (optional): `true` | `false`
- `isDefault` (optional): `true` | `false`

**Response:** `200 OK`

```json
[
  {
    "id": "policy_abc123",
    "name": "Standard State-Owned Policy",
    "assetOwnership": "state_owned",
    "isActive": true,
    "isDefault": true,
    "usageCount": 15,
    "commissionConfig": {...},
    "dossierConfig": {...},
    "depositConfig": {...}
  }
]
```

---

#### Get Default Policy

```http
GET /auction-policy/default/{assetOwnership}
Authorization: Bearer {token}
```

**Parameters:**

- `assetOwnership`: `state_owned` | `private`

**Response:** `200 OK` or `404 Not Found`

---

#### Update Policy

```http
PATCH /auction-policy/{id}
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:** (all fields optional)

```json
{
  "name": "Updated Policy Name",
  "isActive": false,
  "commissionConfig": {...}
}
```

**Response:** `200 OK`

**Access:** Admin only

---

#### Delete Policy

```http
DELETE /auction-policy/{id}
Authorization: Bearer {token}
```

**Response:** `204 No Content` or `409 Conflict` (if policy in use)

**Access:** Admin only

---

### Validation & Calculation Endpoints

#### Validate Dossier Fee

```http
POST /auction-policy/validate/dossier-fee
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "dossierFee": 150000,
  "startingPrice": 180000000
}
```

**Response:** `200 OK`

```json
{
  "valid": false,
  "message": "Dossier fee (150,000 VND) exceeds maximum allowed (100,000 VND)...",
  "maxAllowed": 100000
}
```

---

#### Validate Deposit Percentage

```http
POST /auction-policy/validate/deposit-percentage
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "percentage": 15,
  "assetCategory": "general"
}
```

**Response:** `200 OK`

```json
{
  "valid": true
}
```

---

#### Calculate Commission

```http
POST /auction-policy/calculate/commission
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "finalPrice": 2500000000,
  "assetCategory": "general"
}
```

**Response:** `200 OK`

```json
{
  "finalPrice": 2500000000,
  "assetCategory": "general",
  "commissionFee": 48750000,
  "calculation": {
    "min": 1000000,
    "max": 400000000,
    "appliedFee": 48750000
  }
}
```

---

#### Calculate Deposit

```http
POST /auction-policy/calculate/deposit
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body (Percentage):**

```json
{
  "depositType": "percentage",
  "startingPrice": 100000000,
  "percentage": 10,
  "assetCategory": "general"
}
```

**Request Body (Fixed):**

```json
{
  "depositType": "fixed",
  "startingPrice": 100000000,
  "fixedAmount": 15000000
}
```

**Response:** `200 OK`

```json
{
  "valid": true,
  "depositType": "percentage",
  "startingPrice": 100000000,
  "percentage": 10,
  "assetCategory": "general",
  "depositAmount": 10000000
}
```

---

### Auction Costs Management

#### Create/Update Auction Costs

```http
POST /auction-costs/auction/{auctionId}
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

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
      "description": "Insurance coverage",
      "amount": 3000000
    }
  ]
}
```

**Response:** `201 Created`

```json
{
  "id": "cost_xyz789",
  "auctionId": "auction_123",
  "advertisingCost": 2000000,
  "venueRentalCost": 5000000,
  "appraisalCost": 10000000,
  "assetViewingCost": 1000000,
  "otherCosts": [
    {
      "description": "Security personnel for 3 days",
      "amount": 5000000
    }
  ],
  "totalCosts": 26000000,
  "createdAt": "2024-11-17T10:00:00Z",
  "updatedAt": "2024-11-17T10:00:00Z"
}
```

**Access:** Admin, Auctioneer

---

#### Get Auction Costs

```http
GET /auction-costs/auction/{auctionId}
Authorization: Bearer {token}
```

**Response:** `200 OK` or `404 Not Found`

---

#### Update Specific Cost Fields

```http
PATCH /auction-costs/auction/{auctionId}
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:** (all fields optional)

```json
{
  "advertisingCost": 3000000,
  "venueRentalCost": 6000000
}
```

**Response:** `200 OK`

**Access:** Admin, Auctioneer

---

#### Add Individual Other Cost

```http
POST /auction-costs/auction/{auctionId}/other-cost
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "description": "Emergency repairs",
  "amount": 2000000
}
```

**Response:** `201 Created`

**Access:** Admin, Auctioneer

---

#### Delete Auction Costs

```http
DELETE /auction-costs/auction/{auctionId}
Authorization: Bearer {token}
```

**Response:** `204 No Content`

**Access:** Admin only

---

## Usage Examples

### Example 1: Create Standard State-Owned Policy

```typescript
// Create a complete policy for state-owned assets
const policy = await auctionPolicyService.create({
  name: 'Standard State-Owned General Assets',
  description: 'Compliant with Circular 45/2017 and 108/2020',
  assetOwnership: 'state_owned',
  isActive: true,
  isDefault: true,

  // Commission configuration
  commissionConfig: {
    assetCategory: 'general',
    tiers: [
      { from: 0, to: 50000000, rate: 0.05, baseAmount: 0 },
      { from: 50000000, to: 100000000, rate: 0.035, baseAmount: 2500000 },
      { from: 100000000, to: 500000000, rate: 0.03, baseAmount: 4250000 },
      { from: 500000000, to: 1000000000, rate: 0.025, baseAmount: 16250000 },
      { from: 1000000000, to: 5000000000, rate: 0.015, baseAmount: 26250000 },
      { from: 5000000000, to: 10000000000, rate: 0.002, baseAmount: 86250000 },
      { from: 10000000000, to: Infinity, rate: 0.001, baseAmount: 96250000 },
    ],
    minCommission: 1000000,
    maxCommission: 400000000,
  },

  // Dossier fee limits
  dossierConfig: {
    feeTiers: [
      { startPriceFrom: 0, startPriceTo: 200000000, maxFee: 100000 },
      { startPriceFrom: 200000000, startPriceTo: 500000000, maxFee: 200000 },
      { startPriceFrom: 500000000, startPriceTo: Infinity, maxFee: 500000 },
    ],
  },

  // Deposit configuration
  depositConfig: {
    depositType: 'percentage',
    assetCategory: 'general',
    minPercentage: 5,
    maxPercentage: 20,
    minDepositAmount: 1000000,
    depositDeadlineHours: 24,
    requiresDocuments: true,
    requiredDocumentTypes: ['identity_card', 'bank_statement'],
    refundDeadlineDays: 3,
  },
});
```

---

### Example 2: Calculate Complete Financial Summary

```typescript
// After auction finalization
const summary = await policyCalculationService.calculateAuctionFinancialSummary(
  'auction_123',
  2500000000 // Final sale price
);

console.log(summary);
// Output:
// {
//   finalSalePrice: 2500000000,
//   commissionFee: 48750000,
//   dossierFee: 200000,
//   depositAmount: 125000000,
//   totalAuctionCosts: 26000000,
//   totalFeesToSeller: 74750000,
//   netAmountToSeller: 2425250000,
//   details: {...}
// }
```

---

### Example 3: Validate Fees Before Auction Creation

```typescript
// Validate dossier fee
const dossierValidation = policyCalc.validateDossierFee(
  150000, // Proposed fee
  180000000 // Starting price
);

if (!dossierValidation.valid) {
  throw new Error(dossierValidation.message);
}

// Validate deposit percentage
const depositValidation = policyCalc.validateDepositPercentage(
  15, // 15%
  'general'
);

if (!depositValidation.valid) {
  throw new Error(depositValidation.message);
}
```

---

### Example 4: Track Auction Costs

```typescript
// Create cost record when planning auction
await auctionCostService.upsert('auction_123', {
  advertisingCost: 2000000,
  venueRentalCost: 5000000,
  appraisalCost: 10000000,
  assetViewingCost: 1000000,
  otherCosts: [],
});

// Later, add additional costs
await auctionCostService.addOtherCost('auction_123', 'Security personnel', 5000000);

// Get total costs
const costs = await auctionCostService.findByAuction('auction_123');
console.log(costs.totalCosts); // 23,000,000
```

---

### Example 5: Get Appropriate Policy for Auction

```typescript
// Fetch default policy for asset type
const policy = await auctionPolicyService.findDefault('state_owned');

// Use policy configurations in auction creation
const auction = await auctionService.create({
  name: 'State-Owned Vehicle Auction',
  auctionPolicyId: policy.id,
  startingPrice: 100000000,
  depositPercentage: policy.depositConfig.minPercentage,
  dossierFee: 100000,
  // ... other fields
});
```

---

## Legal Compliance

### Vietnamese Legal Circulars

#### Circular 45/2017 (Updated by 108/2020)

**Subject:** Commission/Remuneration for Auction Services

**Key Points:**

- Progressive tiered calculation based on final sale price
- Different rates for general assets vs land use rights
- Minimum commission: 1,000,000 VND
- Maximum commission: 400,000,000 VND

**Implementation:** Module 1 (Commission Calculation)

---

#### Circular 48/2017

**Subject:** Dossier Fees and Deposit Requirements

**Key Points:**

- Maximum dossier fees based on starting price tiers
- Deposit requirements: 5-20% for general, 10-20% for land
- 24-hour deposit payment deadline
- 3-day refund processing period

**Implementation:**

- Module 2 (Dossier Fee Validation)
- Module 3 (Deposit Policy)

---

### Compliance Checklist

When creating a new auction policy:

- [ ] Commission tiers match legal requirements
- [ ] Min/max commission constraints set correctly
- [ ] Dossier fee limits align with circular specifications
- [ ] Deposit percentages within legal ranges
- [ ] Deposit deadline hours configured (default: 24)
- [ ] Refund deadline days configured (default: 3)
- [ ] Asset ownership type correctly specified
- [ ] Asset category matches policy configuration

---

## Testing Guide

### Unit Tests

Test files location: `auction-policy.service.spec.ts`, `policy-calculation.service.spec.ts`

#### Test Commission Calculation

```typescript
describe('Commission Calculation', () => {
  it('should calculate commission for general assets', () => {
    const commission = policyCalc.calculateCommission(2500000000, 'general');
    expect(commission).toBe(48750000);
  });

  it('should apply minimum commission', () => {
    const commission = policyCalc.calculateCommission(10000, 'general');
    expect(commission).toBe(1000000); // Minimum
  });

  it('should apply maximum commission', () => {
    const commission = policyCalc.calculateCommission(100000000000, 'general');
    expect(commission).toBe(400000000); // Maximum
  });
});
```

#### Test Dossier Fee Validation

```typescript
describe('Dossier Fee Validation', () => {
  it('should reject fee exceeding maximum', () => {
    const result = policyCalc.validateDossierFee(150000, 180000000);
    expect(result.valid).toBe(false);
    expect(result.maxAllowed).toBe(100000);
  });

  it('should accept fee within limit', () => {
    const result = policyCalc.validateDossierFee(80000, 180000000);
    expect(result.valid).toBe(true);
  });
});
```

#### Test Deposit Calculations

```typescript
describe('Deposit Calculation', () => {
  it('should calculate percentage deposit', () => {
    const deposit = policyCalc.calculateDepositAmount('percentage', 100000000, 10);
    expect(deposit).toBe(10000000);
  });

  it('should apply min constraint', () => {
    const deposit = policyCalc.calculateDepositAmount('percentage', 10000000, 5, undefined, { minDepositAmount: 5000000 });
    expect(deposit).toBe(5000000); // Min applied
  });

  it('should use fixed amount', () => {
    const deposit = policyCalc.calculateDepositAmount('fixed', 100000000, undefined, 15000000);
    expect(deposit).toBe(15000000);
  });
});
```

---

### Integration Tests

#### Test Policy CRUD Operations

```typescript
describe('Policy Management', () => {
  let policyId: string;

  it('should create policy with all configs', async () => {
    const policy = await request(app.getHttpServer())
      .post('/auction-policy')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: "Test Policy",
        assetOwnership: "state_owned",
        isDefault: true,
        commissionConfig: {...},
        dossierConfig: {...},
        depositConfig: {...}
      })
      .expect(201);

    policyId = policy.body.id;
    expect(policy.body.commissionConfig).toBeDefined();
  });

  it('should set new policy as default and unset old', async () => {
    const policies = await request(app.getHttpServer())
      .get('/auction-policy?assetOwnership=state_owned&isDefault=true')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(policies.body.length).toBe(1);
    expect(policies.body[0].id).toBe(policyId);
  });

  it('should prevent deletion of policy in use', async () => {
    // Create auction using policy
    await createAuction({ auctionPolicyId: policyId });

    // Try to delete
    await request(app.getHttpServer())
      .delete(`/auction-policy/${policyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
  });
});
```

---

### Postman Collection

Example requests for testing:

**1. Create Standard State-Owned Policy**

```
POST {{baseUrl}}/auction-policy
Authorization: Bearer {{adminToken}}

Body: (see Example 1 in Usage Examples)
```

**2. Calculate Commission**

```
POST {{baseUrl}}/auction-policy/calculate/commission
Authorization: Bearer {{token}}

{
  "finalPrice": 2500000000,
  "assetCategory": "general"
}
```

**3. Add Auction Costs**

```
POST {{baseUrl}}/auction-costs/auction/{{auctionId}}
Authorization: Bearer {{adminToken}}

{
  "advertisingCost": 2000000,
  "venueRentalCost": 5000000,
  "appraisalCost": 10000000
}
```

---

## Error Handling

### Common Errors

#### Policy Not Found

```json
{
  "statusCode": 404,
  "message": "Auction policy with ID policy_123 not found",
  "error": "Not Found"
}
```

#### Cannot Delete Policy In Use

```json
{
  "statusCode": 409,
  "message": "Cannot delete policy policy_123. It is being used by 5 auction(s)",
  "error": "Conflict"
}
```

#### Invalid Dossier Fee

```json
{
  "statusCode": 400,
  "message": "Dossier fee (150,000 VND) exceeds maximum allowed (100,000 VND) for starting price of 180,000,000 VND",
  "error": "Bad Request"
}
```

#### Invalid Deposit Percentage

```json
{
  "statusCode": 400,
  "message": "Deposit percentage (3%) must be between 5% and 20% for general assets",
  "error": "Bad Request"
}
```

#### Unauthorized Access

```json
{
  "statusCode": 403,
  "message": "Forbidden - Admin access required",
  "error": "Forbidden"
}
```

---

## Best Practices

### 1. Policy Configuration

✅ **DO:**

- Create separate policies for state-owned and private assets
- Set one policy as default for each asset ownership type
- Use descriptive names that reference legal circulars
- Test calculations before marking policy as active
- Document custom tier configurations

❌ **DON'T:**

- Modify active policies used by ongoing auctions
- Create policies with overlapping tier ranges
- Skip min/max commission constraints
- Use deposit percentages outside legal limits

---

### 2. Cost Tracking

✅ **DO:**

- Record costs as they are incurred
- Use descriptive names for other costs
- Keep supporting documents
- Update total costs promptly
- Review costs before finalization

❌ **DON'T:**

- Wait until finalization to record costs
- Use vague cost descriptions
- Forget to include all cost categories
- Modify costs after finalization

---

### 3. Financial Calculations

✅ **DO:**

- Always validate fees before auction creation
- Use `calculateAuctionFinancialSummary` for complete breakdown
- Store calculation details for transparency
- Review financial summary before winner payment
- Audit calculations for compliance

❌ **DON'T:**

- Manually calculate fees
- Skip validation steps
- Modify financial summary after generation
- Use hardcoded rates instead of policy configuration

---

### 4. Error Handling

✅ **DO:**

- Validate all inputs before calculations
- Return detailed error messages
- Log policy changes and calculations
- Handle edge cases (very low/high prices)
- Provide fallback values where appropriate

❌ **DON'T:**

- Silently fail validations
- Return generic error messages
- Skip logging for audit trails
- Assume policies always exist

---

### 5. Performance

✅ **DO:**

- Cache default policies
- Use database indexes on policy lookups
- Batch-calculate financial summaries
- Limit JSON field sizes
- Archive old policies

❌ **DON'T:**

- Re-fetch policy for each calculation
- Store large documents in JSON fields
- Calculate summaries multiple times
- Keep all historical policies active

---

## Maintenance & Updates

### Adding New Commission Tiers

1. Update legal reference documentation
2. Modify commission tier arrays in policy DTOs
3. Update calculation tests
4. Create migration if schema changes needed
5. Update default policies
6. Notify admins of changes

### Changing Legal Requirements

1. Document legal circular reference
2. Create new policy version (don't modify existing)
3. Mark old policies as inactive
4. Set new policy as default
5. Migrate existing auctions if needed
6. Update validation rules
7. Update API documentation

### Schema Migrations

When database schema changes are needed:

```bash
# Create migration
npx prisma migrate dev --name add_new_policy_field

# Review generated migration
# Apply to staging
npx prisma migrate deploy

# Test thoroughly
# Apply to production
```

---

## Troubleshooting

### Issue: Commission calculation seems incorrect

**Check:**

1. Asset category matches auction type
2. Final price is correct
3. Tier ranges don't overlap
4. Min/max constraints are applied
5. Policy is active and has commission config

**Solution:**

```typescript
// Debug calculation
const steps = policyCalc.getCommissionCalculationSteps(finalPrice, assetCategory);
console.log(steps);
```

---

### Issue: Deposit validation fails unexpectedly

**Check:**

1. Asset category matches deposit config
2. Percentage is within range for category
3. Min/max constraints don't conflict
4. Policy has deposit config defined

**Solution:**

```typescript
// Validate configuration
const validation = policyCalc.validateDepositConfig(depositType, assetCategory, percentage, fixedAmount);
console.log(validation);
```

---

### Issue: Financial summary not generating

**Check:**

1. Auction exists and is finalized
2. Auction has valid policy assigned
3. Final sale price is provided
4. Policy has all required configs

**Solution:**

```typescript
// Manual calculation
try {
  const summary = await policyCalc.calculateAuctionFinancialSummary(auctionId, finalPrice);
  console.log(summary);
} catch (error) {
  console.error('Summary generation failed:', error.message);
}
```

---

### Issue: Policy cannot be deleted

**Check:**

1. No auctions are using the policy
2. Policy is not marked as default

**Solution:**

```typescript
// Find auctions using policy
const auctions = await prisma.auction.findMany({
  where: { auctionPolicyId: policyId },
});

if (auctions.length > 0) {
  // Reassign auctions or mark policy as inactive instead
  await auctionPolicyService.update(policyId, { isActive: false });
}
```

---

## Future Enhancements

### Planned Features

- [ ] **Policy Versioning** - Track changes to policies over time
- [ ] **Policy Templates** - Pre-configured templates for common scenarios
- [ ] **Automated Policy Updates** - Apply legal changes automatically
- [ ] **Multi-Currency Support** - Support for foreign currency auctions
- [ ] **Tax Calculation** - Integrate VAT and other tax calculations
- [ ] **Policy Comparison** - Compare different policies side-by-side
- [ ] **Audit Reports** - Detailed compliance and usage reports
- [ ] **Policy Preview** - Simulate calculations before creating auction

### Potential Improvements

- **Performance:** Caching layer for frequently-used policies
- **Scalability:** Separate read/write models for high-volume scenarios
- **Analytics:** Dashboard for policy usage and financial metrics
- **Automation:** Auto-select best policy based on auction parameters
- **Integration:** Export to accounting systems

---

## Related Documentation

- **System Architecture:** `SYSTEM_ARCHITECTURE.md`
- **API Testing Guide:** `POSTMAN_API_TESTING_GUIDE.md`
- **Database Schema:** `server/prisma/schema.prisma`
- **Payment Integration:** `PAYMENT_INTEGRATION_SIMPLIFIED.md`
- **Auction Finalization:** `server/src/feature/auction-finalization/`

---

## Support & Contact

For questions or issues:

1. Check this documentation first
2. Review API examples and test cases
3. Consult legal references
4. Contact development team

---

**Document Version:** 2.0  
**Last Updated:** November 17, 2024  
**Maintained By:** Auction Hub Development Team
