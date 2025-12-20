# Admin Dashboard Analytics - Integration Guide

## Overview

This guide explains how to integrate the analytics view refresh into your existing `AuctionFinalizationService` to ensure the dashboard data is always up-to-date after an auction closes.

## Files Created

| File                                                                   | Description                                              |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| `scripts/setup-analytics-view.ts`                                      | Setup script to create the materialized view and indexes |
| `server/src/feature/dashboard/dto/dashboard-filters.dto.ts`            | DTO for filter parameters                                |
| `server/src/feature/dashboard/dto/dashboard-analytics-response.dto.ts` | Response DTO                                             |
| `server/src/feature/dashboard/dashboard.service.ts`                    | Service with analytics logic and cron job                |
| `server/src/feature/dashboard/dashboard.controller.ts`                 | REST API endpoints                                       |
| `server/src/feature/dashboard/dashboard.module.ts`                     | NestJS module configuration                              |

---

## Integration: Calling `refreshAnalyticsView()` from AuctionFinalizationService

### Step 1: Import and Inject DashboardService

Update your `AuctionOwnerService` (or wherever finalization logic resides) to inject `DashboardService`:

```typescript
// server/src/feature/auction-finalization/services/auction-owner.service.ts

import { DashboardService } from '../../dashboard/dashboard.service';

@Injectable()
export class AuctionOwnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly biddingGateway: BiddingGateway,
    private readonly policyCalc: PolicyCalculationService,
    private readonly evaluationService: AuctionEvaluationService,
    private readonly paymentService: PaymentService,
    // Add DashboardService injection
    private readonly dashboardService: DashboardService
  ) {}

  // ... rest of the service
}
```

### Step 2: Update the Module to Import DashboardModule

```typescript
// server/src/feature/auction-finalization/auction-finalization.module.ts

import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [
    PrismaModule,
    AuctionPolicyModule,
    PaymentModule,
    BiddingModule,
    DashboardModule, // Add this import
  ],
  // ... rest of the module
})
export class AuctionFinalizationModule {}
```

### Step 3: Call `refreshAnalyticsView()` After Finalization

Add the refresh call at the end of your `finalizeAuction` method:

```typescript
// In AuctionOwnerService.finalizeAuction()

async finalizeAuction(dto: FinalizeAuctionDto, userId: string) {
  // ... existing finalization logic ...

  // After the transaction completes and emails are sent:

  // Trigger analytics view refresh (non-blocking)
  this.dashboardService.refreshAnalyticsView().catch((error) => {
    this.logger.error('Failed to refresh analytics view after auction finalization', error);
    // Don't throw - this is a non-critical operation
  });

  return {
    auctionId: auction.id,
    status: newStatus,
    // ... rest of the response
  };
}
```

### Step 4: Also Call After Status Override

```typescript
// In AuctionOwnerService.overrideAuctionStatus()

async overrideAuctionStatus(dto: OverrideAuctionStatusDto, adminId: string) {
  // ... existing override logic ...

  // Trigger analytics view refresh after status change
  if (dto.newStatus === AuctionStatus.success || dto.newStatus === AuctionStatus.failed) {
    this.dashboardService.refreshAnalyticsView().catch((error) => {
      this.logger.error('Failed to refresh analytics view after status override', error);
    });
  }

  return {
    auctionId: auction.id,
    previousStatus: auction.status,
    newStatus: dto.newStatus,
    // ... rest of the response
  };
}
```

---

## Deployment Checklist

1. **Install Dependencies:**

   ```bash
   npm install @nestjs/schedule
   ```

2. **Run Setup Script (after deployment):**

   ```bash
   npx ts-node scripts/setup-analytics-view.ts
   ```

3. **Verify Endpoints:**

   - `GET /dashboard/analytics` - Get analytics data
   - `POST /dashboard/analytics/refresh` - Manual refresh

4. **Verify Cron Job:**
   The `@Cron(CronExpression.EVERY_HOUR)` decorator will automatically refresh the view every hour.

---

## API Usage Examples

### Get Analytics (with filters)

```bash
GET /dashboard/analytics?startDate=2024-01-01&endDate=2024-12-31&assetType=secured_asset&provinceId=1
Authorization: Bearer <admin_token>
```

### Response

```json
{
  "summary": {
    "totalGmv": 15000000000,
    "totalRevenue": 450000000,
    "avgBids": 12.4,
    "successRatePercentage": 82.5,
    "totalAuctions": 150,
    "successfulAuctions": 124
  }
}
```

### Manual Refresh

```bash
POST /dashboard/analytics/refresh
Authorization: Bearer <admin_token>
```

---

## Security Notes

1. **SQL Injection Prevention:** All dynamic parameters use `Prisma.sql` tagged template literals.
2. **Role-Based Access:** Endpoints require `admin` or `super_admin` role.
3. **Authentication:** JWT Bearer token required for all endpoints.
