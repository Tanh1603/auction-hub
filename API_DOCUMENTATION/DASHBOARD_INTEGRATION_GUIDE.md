## 1. Backend Implementation (Data Engineering)

### A. The Setup Script (`scripts/setup-analytics-view.ts`)

We use a standalone script to create the view. The SQL is written to be **Idempotent** (safe to run multiple times).

```sql
-- 1. Safe Teardown (Optional, for resetting)
-- DROP MATERIALIZED VIEW IF EXISTS mv_auction_analytics CASCADE;

-- 2. Create View (Only if it doesn't exist)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_auction_analytics AS
SELECT
    a.id AS auction_id,
    a.code AS auction_code,
    a.name AS auction_name,
    a.asset_type,
    a.asset_province_id,
    a.status,
    a.auction_end_at,
    COALESCE(a.final_sale_price, 0) AS gmv,
    COALESCE(a.commission_fee, 0) + COALESCE(a.dossier_fee_snapshot, 0) AS total_revenue,
    a.net_amount_to_property_owner AS net_to_seller,
    COUNT(DISTINCT b.id) AS bid_count,
    COUNT(DISTINCT p.user_id) AS participant_count
FROM auctions a
LEFT JOIN auction_bids b ON a.id = b.auction_id
LEFT JOIN auction_participants p ON a.id = p.auction_id
GROUP BY a.id;

-- 3. Create Indexes (Crucial for Filter Performance)
CREATE INDEX IF NOT EXISTS idx_mv_analytics_status ON mv_auction_analytics(status);
CREATE INDEX IF NOT EXISTS idx_mv_analytics_date ON mv_auction_analytics(auction_end_at);
CREATE INDEX IF NOT EXISTS idx_mv_analytics_asset ON mv_auction_analytics(asset_type);
CREATE INDEX IF NOT EXISTS idx_mv_analytics_province ON mv_auction_analytics(asset_province_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_unique_id ON mv_auction_analytics(auction_id);

```

### B. View Refresh Strategy

Since Materialized Views are static snapshots, we must refresh them.

1. **Triggered Refresh:** The `AuctionFinalizationService` must execute `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_auction_analytics;` immediately after an auction closes.
2. **Scheduled Refresh:** A Cron job runs every 1 hour as a safety net.

### C. Secure Service Implementation

We use `Prisma.sql` tagged templates. This is **mandatory** to prevent SQL Injection.

```typescript
// dashboard.service.ts
import { Prisma } from '@prisma/client';

async getAnalytics(filters: DashboardFiltersDto) {
  const conditions = [];
  
  // Default dates to avoid "undefined" errors
  const startDate = filters.startDate ? new Date(filters.startDate) : new Date('2000-01-01');
  const endDate = filters.endDate ? new Date(filters.endDate) : new Date();

  // 1. Base Time Filter
  conditions.push(Prisma.sql`auction_end_at >= ${startDate} AND auction_end_at <= ${endDate}`);

  // 2. Dynamic Filters
  if (filters.assetType) {
    conditions.push(Prisma.sql`asset_type = ${filters.assetType}`);
  }
  if (filters.provinceId) {
    conditions.push(Prisma.sql`asset_province_id = ${filters.provinceId}`);
  }

  // 3. Secure Query Construction
  const whereClause = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;

  return await this.prisma.$queryRaw`
    SELECT
      SUM(gmv) as total_gmv,
      SUM(total_revenue) as platform_revenue,
      COUNT(*) FILTER (WHERE status = 'success') as success_count,
      COUNT(*) as total_count,
      ROUND(AVG(bid_count), 1) as avg_bids_per_auction
    FROM mv_auction_analytics
    ${whereClause}
  `;
}

```

---

## 2. Shared Data Interface

```json
{
  "summary": {
    "totalGmv": 15000000000,
    "totalRevenue": 450000000,
    "avgBids": 12.4,
    "successRatePercentage": 82.5
  }
}

```

---

## 3. Deployment Checklist

1. [ ] **Run Setup Script:** Execute `npx ts-node scripts/setup-analytics-view.ts` after deployment.
2. [ ] **Trigger Integration:** Ensure `AuctionFinalizationService` triggers the refresh.
3. [ ] **Cron Job:** Ensure the `@Cron` task is active.
