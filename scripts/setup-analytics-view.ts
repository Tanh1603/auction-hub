/**
 * Setup script for the analytics materialized view.
 *
 * This script creates the mv_auction_analytics materialized view
 * and required indexes for the admin dashboard analytics feature.
 *
 * Usage: npx ts-node scripts/setup-analytics-view.ts
 *
 * This script is idempotent - safe to run multiple times.
 */

import { PrismaClient } from '../server/generated';

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('🚀 Starting materialized view setup...');

    // Create the materialized view if it doesn't exist
    // Note: PostgreSQL doesn't support IF NOT EXISTS for materialized views directly,
    // so we use a DO block to conditionally create it
    await prisma.$executeRaw`
      DO $$
      BEGIN
        -- Check if the materialized view already exists
        IF NOT EXISTS (
          SELECT FROM pg_matviews WHERE matviewname = 'mv_auction_analytics'
        ) THEN
          -- Create the materialized view
          CREATE MATERIALIZED VIEW mv_auction_analytics AS
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

          RAISE NOTICE 'Materialized view created successfully.';
        ELSE
          RAISE NOTICE 'Materialized view already exists, skipping creation.';
        END IF;
      END
      $$;
    `;

    console.log('✅ Materialized view checked/created.');

    // Create indexes (IF NOT EXISTS makes this idempotent)
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_mv_analytics_status ON mv_auction_analytics(status);
    `;
    console.log('   ✅ Index idx_mv_analytics_status created.');

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_mv_analytics_date ON mv_auction_analytics(auction_end_at);
    `;
    console.log('   ✅ Index idx_mv_analytics_date created.');

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_mv_analytics_asset ON mv_auction_analytics(asset_type);
    `;
    console.log('   ✅ Index idx_mv_analytics_asset created.');

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_mv_analytics_province ON mv_auction_analytics(asset_province_id);
    `;
    console.log('   ✅ Index idx_mv_analytics_province created.');

    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_unique_id ON mv_auction_analytics(auction_id);
    `;
    console.log('   ✅ Index idx_mv_unique_id (unique) created.');

    console.log('');
    console.log('🎉 Materialized View setup complete.');
  } catch (error) {
    console.error('❌ Error during setup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
