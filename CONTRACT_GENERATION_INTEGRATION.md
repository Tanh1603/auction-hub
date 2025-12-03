# 📄 Contract Generation Feature - Integration Guide

## Overview

This document provides complete information for integrating the **Contract Generation Feature** with the existing Auction Finalization flow. After Phase 4 (Auction Finalization & Winner Payment), the system generates a financial summary and prepares contract data for document generation.

---

## 🔄 Complete Flow

### Phase 1-3: Registration → Bidding

(Standard flow - not covered here)

### Phase 4: Auction Finalization & Winner Payment

1. **Auction Finalized** → Contract created in `draft` status
2. **Financial Summary Generated** → All fees and costs calculated
3. **Winner Submits Payment** → Payment initiated via Stripe
4. **Winner Payment Verified** → Contract status updated to `signed`
5. **Contract Data Ready** → All data available for document generation

---

## 📊 Financial Summary Generation

### When It's Generated

The financial summary is automatically generated in **TWO places**:

#### 1. During Auction Finalization (Step 17)

**Location**: `auction-finalization.service.ts` → `finalizeAuction()` method

**When**: Immediately after contract creation for successful auctions

```typescript
// After creating contract
contract = await tx.contract.create({
  data: {
    auctionId: auction.id,
    winningBidId: winningBid.id,
    sellerUserId: auction.propertyOwner,
    buyerUserId: winningBid.participant.userId,
    createdBy: userId,
    price: winningBid.amount,
    status: ContractStatus.draft, // Initial status
  },
});

// Immediately calculate financial summary
const financialSummary = await this.policyCalc.calculateAuctionFinancialSummary(auction.id, parseFloat(winningBid.amount.toString()));
```

**What It Calculates**:

- Commission fee (based on tiered policy)
- Dossier fee (admin-set)
- Deposit amount (percentage or fixed)
- Total auction costs (advertising, venue, appraisal, etc.)
- Net amount to seller (final price - fees)

#### 2. During Admin Override (Step 21)

**Location**: `auction-finalization.service.ts` → `overrideAuctionStatus()` method

**When**: When admin manually changes auction to `success` status

---

## 💾 Financial Summary Database Structure

### Model: `AuctionFinancialSummary`

```prisma
model AuctionFinancialSummary {
  id                    String    @id
  auctionId             String    @unique  // One-to-one with Auction

  // Core amounts
  finalSalePrice        Decimal   // Winner's bid amount
  startingPrice         Decimal   // Original starting price

  // Calculated fees
  commissionFee         Decimal   // Tiered commission
  dossierFee            Decimal   // Admin-set fee
  depositAmount         Decimal   // Required deposit

  // Costs
  totalAuctionCosts     Decimal   // Sum of all costs

  // Final calculations
  totalFeesToSeller     Decimal   // Commission + Costs
  netAmountToSeller     Decimal   // FinalPrice - TotalFees

  // Detailed breakdown (JSON)
  calculationDetails    Json      // Full breakdown with steps

  createdAt             DateTime
  updatedAt             DateTime
}
```

### Calculation Details Structure (JSON)

```typescript
{
  commission: {
    assetCategory: "general" | "land_use_right",
    finalSalePrice: 5500000000,
    commissionFee: 55000000,
    calculation: "Step-by-step formula string" // Human-readable
  },
  dossierFee: {
    amount: 1000000,
    startingPrice: 5000000000
  },
  deposit: {
    type: "percentage" | "fixed",
    percentage: 10,           // If percentage type
    fixedAmount: 50000000,    // If fixed type
    startingPrice: 5000000000,
    amount: 500000000
  },
  costs: {
    advertisingCost: 5000000,
    venueRentalCost: 3000000,
    appraisalCost: 10000000,
    assetViewingCost: 2000000,
    otherCosts: [
      {
        description: "Photography",
        amount: 1000000,
        documentUrl: "https://..."
      }
    ],
    total: 26000000
  },
  summary: {
    finalSalePrice: 5500000000,
    commissionFee: 55000000,
    totalAuctionCosts: 26000000,
    totalFeesToSeller: 81000000,
    netAmountToSeller: 5419000000
  }
}
```

---

## 📋 Contract Model Structure

### Model: `Contract`

```prisma
model Contract {
  id            String         @id
  auctionId     String         // Link to auction
  winningBidId  String         // Link to winning bid
  sellerUserId  String         // Property owner
  buyerUserId   String         // Winner
  createdBy     String         // Admin who finalized
  price         Decimal        // Final winning price
  status        ContractStatus // draft → signed → completed
  signedAt      DateTime?      // When fully signed
  cancelledAt   DateTime?
  docUrl        String?        // URL to generated PDF
  createdAt     DateTime
  updatedAt     DateTime

  // Relations
  auction    Auction
  winningBid AuctionBid
  seller     User @relation("ContractSeller")
  buyer      User @relation("ContractBuyer")
  creator    User @relation("ContractCreator")
}

enum ContractStatus {
  draft       // Initial state after auction finalization
  signed      // After winner payment verified
  cancelled   // If payment fails or fraud detected
  completed   // After contract generation and full signatures
}
```

---

## 🔗 Integration Point: After Winner Payment Verification

### Endpoint: POST /api/auction-finalization/verify-winner-payment

**When Called**: After winner completes Stripe payment (Step 20)

**What Happens**:

1. ✅ Payment verified with Stripe
2. ✅ Payment record updated to `completed`
3. ✅ Contract status updated from `draft` → `signed`
4. ✅ Emails sent (winner, seller, admins)
5. ✅ **Contract data returned for generation**

### Response Structure

```typescript
{
  success: true,
  paymentVerified: true,
  paymentId: "payment-uuid",
  sessionId: "cs_test_...",
  amount: 5000000000,
  contractId: "contract-uuid",
  contractStatus: "signed",
  contractReady: true,
  message: "Payment verified successfully. Contract is ready for final signatures from both parties.",
  nextSteps: [
    "1. Winner reviews and signs the contract",
    "2. Seller reviews and signs the contract",
    "3. Auctioneer reviews and finalizes",
    "4. Final contract document generated"
  ],

  // 🎯 THIS IS THE KEY DATA FOR CONTRACT GENERATION
  contractData: {
    auctionId: "auction-uuid",
    contractId: "contract-uuid",

    seller: {
      userId: "seller-uuid",
      fullName: "Nguyễn Văn An",
      email: "seller@example.com"
    },

    buyer: {
      userId: "buyer-uuid",
      fullName: "Trần Thị Bình",
      email: "buyer@example.com"
    },

    auctionDetails: {
      title: "Căn hộ chung cư 80m2 - Quận 1",
      startingPrice: 2000000000,
      finalPrice: 5500000000
    },

    paymentConfirmed: true,
    paymentDate: "2025-11-16T14:25:00.000Z"
  }
}
```

---

## 🎯 What Your Contract Generation Feature Needs

### Step 1: Get Complete Data After Payment Verification

After the `/verify-winner-payment` endpoint returns, you have the `contractId`. Use it to fetch complete data:

```typescript
// GET /api/auction-finalization/results/:auctionId
// This endpoint returns EVERYTHING including financial summary

const auctionResults = await fetch(`/api/auction-finalization/results/${auctionId}`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

### Step 2: Expected Data Structure from Results Endpoint

```typescript
{
  success: true,
  data: {
    auctionId: "auction-uuid",
    auctionCode: "AUC003",
    auctionName: "Đất nền 500m2 - Quận 9",
    status: "success",
    startingPrice: "5000000000",
    auctionStartAt: "2025-11-10T...",
    auctionEndAt: "2025-11-10T...",
    finalizedAt: "2025-11-11T...",
    totalBids: 15,
    totalParticipants: 3,

    winningBid: {
      bidId: "bid-uuid",
      amount: "5500000000",
      bidAt: "2025-11-10T...",
      bidType: "manual",
      winner: {
        userId: "winner-uuid",
        fullName: "Phạm Thị Dung",
        email: "bidder3@gmail.com"
      }
    },

    contract: {
      contractId: "contract-uuid",
      status: "signed",
      createdAt: "2025-11-11T..."
    },

    // 🎯 CRITICAL: Complete financial breakdown
    financialSummary: {
      finalSalePrice: 5500000000,
      startingPrice: 5000000000,
      commissionFee: 55000000,
      dossierFee: 1000000,
      depositAmount: 500000000,
      totalAuctionCosts: 26000000,
      totalFeesToSeller: 81000000,
      netAmountToSeller: 5419000000,

      // Detailed breakdown for contract document
      calculationDetails: {
        commission: { /* ... */ },
        dossierFee: { /* ... */ },
        deposit: { /* ... */ },
        costs: {
          advertisingCost: 5000000,
          venueRentalCost: 3000000,
          appraisalCost: 10000000,
          assetViewingCost: 2000000,
          otherCosts: [
            {
              description: "Photography and documentation",
              amount: 1000000,
              documentUrl: "https://..."
            }
          ],
          total: 26000000
        },
        summary: { /* ... */ }
      },

      calculatedAt: "2025-11-11T..."
    },

    evaluation: { /* ... */ }
  }
}
```

### Step 3: Alternative - Query Database Directly

If you're building the contract generation as a separate service, you can query:

```typescript
// Get contract with ALL related data
const contract = await prisma.contract.findUnique({
  where: { id: contractId },
  include: {
    auction: {
      include: {
        financialSummary: true, // 🎯 Financial data
        costs: true, // 🎯 Cost breakdown
        owner: true, // Seller info
        auctionPolicy: {
          include: {
            commissionConfig: true,
            dossierConfig: true,
            depositConfig: true,
          },
        },
      },
    },
    winningBid: {
      include: {
        participant: {
          include: {
            user: true, // Winner info
          },
        },
      },
    },
    seller: true, // Full seller details
    buyer: true, // Full buyer details
    creator: true, // Admin who finalized
  },
});

// Now you have EVERYTHING needed for contract generation:
const contractData = {
  // Contract basics
  contractId: contract.id,
  contractStatus: contract.status,
  contractPrice: parseFloat(contract.price.toString()),
  createdAt: contract.createdAt,

  // Parties
  seller: {
    id: contract.seller.id,
    fullName: contract.seller.fullName,
    email: contract.seller.email,
    phoneNumber: contract.seller.phoneNumber,
    identityNumber: contract.seller.identityNumber,
    userType: contract.seller.userType,
    taxId: contract.seller.taxId,
  },

  buyer: {
    id: contract.buyer.id,
    fullName: contract.buyer.fullName,
    email: contract.buyer.email,
    phoneNumber: contract.buyer.phoneNumber,
    identityNumber: contract.buyer.identityNumber,
    userType: contract.buyer.userType,
    taxId: contract.buyer.taxId,
  },

  // Auction details
  auction: {
    id: contract.auction.id,
    code: contract.auction.code,
    name: contract.auction.name,
    assetDescription: contract.auction.assetDescription,
    assetAddress: contract.auction.assetAddress,
    assetType: contract.auction.assetType,
    startingPrice: parseFloat(contract.auction.startingPrice.toString()),
    finalPrice: parseFloat(contract.price.toString()),
    auctionStartAt: contract.auction.auctionStartAt,
    auctionEndAt: contract.auction.auctionEndAt,
    bidIncrement: parseFloat(contract.auction.bidIncrement.toString()),
  },

  // 🎯 Financial Summary - CRITICAL FOR CONTRACT
  financialSummary: {
    finalSalePrice: parseFloat(contract.auction.financialSummary.finalSalePrice.toString()),
    startingPrice: parseFloat(contract.auction.financialSummary.startingPrice.toString()),
    commissionFee: parseFloat(contract.auction.financialSummary.commissionFee.toString()),
    dossierFee: parseFloat(contract.auction.financialSummary.dossierFee.toString()),
    depositAmount: parseFloat(contract.auction.financialSummary.depositAmount.toString()),
    totalAuctionCosts: parseFloat(contract.auction.financialSummary.totalAuctionCosts.toString()),
    totalFeesToSeller: parseFloat(contract.auction.financialSummary.totalFeesToSeller.toString()),
    netAmountToSeller: parseFloat(contract.auction.financialSummary.netAmountToSeller.toString()),
    calculationDetails: JSON.parse(contract.auction.financialSummary.calculationDetails),
  },

  // Cost breakdown
  costs: contract.auction.costs
    ? {
        advertisingCost: parseFloat(contract.auction.costs.advertisingCost.toString()),
        venueRentalCost: parseFloat(contract.auction.costs.venueRentalCost.toString()),
        appraisalCost: parseFloat(contract.auction.costs.appraisalCost.toString()),
        assetViewingCost: parseFloat(contract.auction.costs.assetViewingCost.toString()),
        otherCosts: JSON.parse(contract.auction.costs.otherCosts),
        totalCosts: parseFloat(contract.auction.costs.totalCosts.toString()),
        documents: JSON.parse(contract.auction.costs.documents),
      }
    : null,

  // Winning bid details
  winningBid: {
    id: contract.winningBid.id,
    amount: parseFloat(contract.winningBid.amount.toString()),
    bidAt: contract.winningBid.bidAt,
    bidType: contract.winningBid.bidType,
  },
};
```

---

## 📄 What Should Be in the Generated Contract Document

Based on the available data, your contract PDF should include:

### 1. Contract Header

- Contract ID
- Contract date
- Auction code and name

### 2. Parties Information

**Seller (Property Owner)**:

- Full name
- ID number / Tax ID
- Email, phone
- User type (individual/business)

**Buyer (Winner)**:

- Full name
- ID number / Tax ID
- Email, phone
- User type (individual/business)

### 3. Property Details

- Asset description (from auction)
- Asset address
- Asset type
- Property documents (auction attachments)

### 4. Auction Summary

- Auction start/end dates
- Starting price
- Number of participants
- Number of bids
- Winning bid amount
- Bid date/time

### 5. 🎯 Financial Breakdown (from financialSummary)

```
Final Sale Price:          5,500,000,000 VND

Fees and Costs:
- Commission Fee:             55,000,000 VND
- Dossier Fee:                 1,000,000 VND
- Advertising Cost:            5,000,000 VND
- Venue Rental:                3,000,000 VND
- Appraisal Cost:             10,000,000 VND
- Asset Viewing:               2,000,000 VND
- Other Costs:                 5,000,000 VND

Total Fees to Seller:         81,000,000 VND
Net Amount to Seller:      5,419,000,000 VND

Deposit Already Paid:        500,000,000 VND
Remaining Amount Paid:     5,000,000,000 VND
Total Paid by Buyer:       5,500,000,000 VND
```

### 6. Payment Terms

- Deposit paid: [amount] on [date]
- Final payment: [amount] on [date]
- Payment method: [method]
- Payment verified: ✅

### 7. Terms and Conditions

- Property handover date
- Responsibilities of seller
- Responsibilities of buyer
- Warranty terms
- Dispute resolution

### 8. Signatures

- Seller signature (digital/physical)
- Buyer signature (digital/physical)
- Witness/Auctioneer signature
- Date of signing

---

## 🔄 Contract Status Flow

```
draft → signed → completed
  ↓        ↓         ↓
Created  Payment   Document
after    verified  generated
finalize          & signed
```

### When to Generate Document

**Recommended Trigger**: When contract status = `signed`

This ensures:

- ✅ Payment is verified
- ✅ All financial data is calculated
- ✅ Both parties are identified
- ✅ Winner is committed (paid)

### After Document Generation

Update the contract:

```typescript
await prisma.contract.update({
  where: { id: contractId },
  data: {
    docUrl: 'https://storage.../contract-AUC003.pdf',
    status: ContractStatus.completed,
    signedAt: new Date(),
  },
});
```

---

## 🚀 Integration Steps Summary

### For Your Contract Generation Feature:

1. **Listen for Event**: Contract status changes to `signed`
2. **Fetch Complete Data**:
   - Use `/api/auction-finalization/results/:auctionId` endpoint
   - OR query database directly with all includes
3. **Extract Required Fields**:
   - Seller info (from contract.seller)
   - Buyer info (from contract.buyer)
   - Auction details (from contract.auction)
   - Financial summary (from contract.auction.financialSummary)
   - Cost breakdown (from contract.auction.costs)
4. **Generate PDF Document**:
   - Use all the data above
   - Include financial breakdown table
   - Add signature fields
5. **Upload & Update**:
   - Upload PDF to storage
   - Update contract.docUrl
   - Update contract.status to `completed`
6. **Notify Parties**:
   - Send email to seller with contract link
   - Send email to buyer with contract link
   - Send email to admin for final review

---

## ⚠️ Important Notes

### Financial Summary Availability

✅ **Always Available**: The financial summary is ALWAYS generated during auction finalization (Step 17) before winner payment.

✅ **Updated**: If auction is overridden by admin, the summary is recalculated.

✅ **Persistent**: Stored in database, won't be lost.

### Data Relationships

```
Contract (1) → Auction (1) → FinancialSummary (1)
           ↓              ↓
    WinningBid (1)    Costs (1)
           ↓
    Participant (1) → User (1)
```

Everything is connected via foreign keys, so you can traverse the entire data structure.

### Error Handling

If financial summary is missing (shouldn't happen, but just in case):

```typescript
if (!contract.auction.financialSummary) {
  // Trigger recalculation
  const summary = await policyCalc.calculateAuctionFinancialSummary(contract.auctionId, parseFloat(contract.price.toString()));
}
```

---

## 📞 API Endpoints You'll Need

### 1. Get Auction Results (with financial summary)

```
GET /api/auction-finalization/results/:auctionId
Authorization: Bearer {token}
```

### 2. Update Contract After PDF Generation

```
PATCH /api/contracts/:contractId
Authorization: Bearer {admin-token}
Body: {
  "docUrl": "https://...",
  "status": "completed"
}
```

### 3. Get Contract Details

```
GET /api/contracts/:contractId
Authorization: Bearer {token}
```

---

## 📋 Checklist for Integration

- [ ] Can access contract data after payment verification
- [ ] Can fetch financial summary from database
- [ ] Can extract all required fields (seller, buyer, auction, financial)
- [ ] Can generate PDF with all data
- [ ] Can upload PDF to storage
- [ ] Can update contract with docUrl
- [ ] Can change contract status to completed
- [ ] Can send notifications to all parties
- [ ] Handle missing data scenarios
- [ ] Handle PDF generation failures
- [ ] Test with seed data (comprehensive-seed.js has AUC003 with complete data)

---

## 🧪 Testing with Seed Data

The seed script creates **AUC003** with complete data:

```javascript
// Auction: Đất nền 500m2 - Quận 9
// Status: success
// Winner: bidder4 (Hoàng Văn Em)
// Winning bid: 5,500,000,000 VND
// Financial summary: ✅ Complete
// Contract: ✅ Created and signed
// Winner payment: ✅ Verified
```

Use this auction to test your contract generation!

---

## 📚 Related Files

- **Financial Calculation**: `server/src/feature/auction-policy/policy-calculation.service.ts`
- **Finalization Service**: `server/src/feature/auction-finalization/auction-finalization.service.ts`
- **Schema**: `server/prisma/schema.prisma`
- **Seed Data**: `server/prisma/comprehensive-seed.js` (AUC003)

---

## 🎯 Quick Start Code Example

```typescript
// After receiving contractId from payment verification response:

async function generateContractDocument(contractId: string) {
  // 1. Get complete data
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      auction: {
        include: {
          financialSummary: true,
          costs: true,
        },
      },
      seller: true,
      buyer: true,
      winningBid: true,
    },
  });

  if (!contract) {
    throw new Error('Contract not found');
  }

  // 2. Extract data
  const contractData = {
    contractId: contract.id,
    seller: {
      fullName: contract.seller.fullName,
      identityNumber: contract.seller.identityNumber,
      email: contract.seller.email,
      phone: contract.seller.phoneNumber,
    },
    buyer: {
      fullName: contract.buyer.fullName,
      identityNumber: contract.buyer.identityNumber,
      email: contract.buyer.email,
      phone: contract.buyer.phoneNumber,
    },
    auction: {
      code: contract.auction.code,
      name: contract.auction.name,
      address: contract.auction.assetAddress,
      description: contract.auction.assetDescription,
    },
    financial: {
      finalPrice: parseFloat(contract.price.toString()),
      commission: parseFloat(contract.auction.financialSummary.commissionFee.toString()),
      dossierFee: parseFloat(contract.auction.financialSummary.dossierFee.toString()),
      costs: parseFloat(contract.auction.financialSummary.totalAuctionCosts.toString()),
      netToSeller: parseFloat(contract.auction.financialSummary.netAmountToSeller.toString()),
      deposit: parseFloat(contract.auction.financialSummary.depositAmount.toString()),
    },
  };

  // 3. Generate PDF
  const pdfUrl = await yourPdfGenerator.generate(contractData);

  // 4. Update contract
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      docUrl: pdfUrl,
      status: 'completed',
      signedAt: new Date(),
    },
  });

  // 5. Send notifications
  await sendContractReadyEmail(contract.buyer.email, pdfUrl);
  await sendContractReadyEmail(contract.seller.email, pdfUrl);

  return { success: true, contractUrl: pdfUrl };
}
```

---

## ✅ Summary

**What You Get After Phase 4:**

1. ✅ Contract created in database
2. ✅ Financial summary fully calculated
3. ✅ Winner payment verified
4. ✅ All party information available
5. ✅ Auction details complete
6. ✅ Cost breakdown available
7. ✅ Ready for PDF generation

**What You Need to Do:**

1. Query contract with all includes
2. Extract data for PDF template
3. Generate PDF document
4. Upload to storage
5. Update contract with URL
6. Send notifications

The system is **100% ready** for your contract generation feature! 🎉
