import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '../../../generated';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DashboardFiltersDto,
  DashboardAnalyticsResponseDto,
  DashboardSummaryDto,
} from './dto';

/**
 * Raw result from the materialized view query.
 * Uses BigInt for COUNT aggregates as PostgreSQL returns bigint type.
 */
interface AnalyticsRawResult {
  total_gmv: Prisma.Decimal | null;
  platform_revenue: Prisma.Decimal | null;
  success_count: bigint;
  total_count: bigint;
  avg_bids_per_auction: Prisma.Decimal | null;
}

/**
 * Service for handling admin dashboard analytics.
 *
 * This service queries the mv_auction_analytics materialized view
 * for aggregated auction performance metrics.
 *
 * SECURITY: Uses Prisma.sql tagged template literals to prevent SQL injection.
 *
 * PREREQUISITE: The materialized view must be created by running:
 *   npx ts-node scripts/setup-analytics-view.ts
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get aggregated analytics data from the materialized view.
   *
   * @param filters - Optional filters for date range, asset type, and province
   * @returns Aggregated analytics summary
   *
   * SECURITY: All dynamic parameters use Prisma.sql tagged templates
   * to prevent SQL injection attacks.
   */
  async getAnalytics(
    filters: DashboardFiltersDto
  ): Promise<DashboardAnalyticsResponseDto> {
    try {
      const conditions: Prisma.Sql[] = [];

      // Default dates to avoid "undefined" errors
      const startDate = filters.startDate
        ? new Date(filters.startDate)
        : new Date('2000-01-01');
      const endDate = filters.endDate ? new Date(filters.endDate) : new Date();

      // 1. Base Time Filter
      conditions.push(
        Prisma.sql`auction_end_at >= ${startDate} AND auction_end_at <= ${endDate}`
      );

      // 2. Dynamic Filters (using Prisma.sql for SQL injection prevention)
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

      // Execute the query against the materialized view
      const result = await this.prisma.$queryRaw<AnalyticsRawResult[]>`
        SELECT
          SUM(gmv) as total_gmv,
          SUM(total_revenue) as platform_revenue,
          COUNT(*) FILTER (WHERE status = 'success') as success_count,
          COUNT(*) as total_count,
          ROUND(AVG(bid_count), 1) as avg_bids_per_auction
        FROM mv_auction_analytics
        ${whereClause}
      `;

      // Transform the raw result to the response DTO
      const rawData = result[0] || {
        total_gmv: null,
        platform_revenue: null,
        success_count: BigInt(0),
        total_count: BigInt(0),
        avg_bids_per_auction: null,
      };

      const totalCountNum = Number(rawData.total_count);
      const successCountNum = Number(rawData.success_count);

      const summary: DashboardSummaryDto = {
        totalGmv: rawData.total_gmv ? Number(rawData.total_gmv) : 0,
        totalRevenue: rawData.platform_revenue
          ? Number(rawData.platform_revenue)
          : 0,
        avgBids: rawData.avg_bids_per_auction
          ? Number(rawData.avg_bids_per_auction)
          : 0,
        successRatePercentage:
          totalCountNum > 0
            ? Math.round((successCountNum / totalCountNum) * 10000) / 100
            : 0,
        totalAuctions: totalCountNum,
        successfulAuctions: successCountNum,
      };

      return { summary };
    } catch (error) {
      // Handle missing materialized view error with helpful message
      if (
        error instanceof Error &&
        error.message?.includes('mv_auction_analytics') &&
        (error.message?.includes('does not exist') ||
          error.message?.includes('relation') ||
          error.message?.includes('undefined'))
      ) {
        this.logger.error(
          'Materialized view mv_auction_analytics not found. Please run setup script.',
          error.stack
        );
        throw new InternalServerErrorException(
          'Analytics view not initialized. Please run: npx ts-node scripts/setup-analytics-view.ts'
        );
      }

      // Log and rethrow other errors
      this.logger.error(
        'Failed to fetch analytics data',
        error instanceof Error ? error.stack : String(error)
      );
      throw new InternalServerErrorException(
        'Failed to retrieve analytics data. Please try again later.'
      );
    }
  }

  /**
   * Refresh the materialized view to update analytics data.
   *
   * Uses CONCURRENTLY option to allow reads during refresh.
   * This requires the UNIQUE index (idx_mv_unique_id) to exist.
   *
   * Called by:
   * 1. Scheduled cron job (every hour as safety net)
   * 2. AuctionFinalizationService after auction closes (triggered refresh)
   */
  async refreshAnalyticsView(): Promise<void> {
    try {
      this.logger.log('Refreshing materialized view: mv_auction_analytics');

      await this.prisma.$executeRaw`
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_auction_analytics
      `;

      this.logger.log('Materialized view refreshed successfully.');
    } catch (error) {
      this.logger.error(
        'Failed to refresh materialized view',
        error instanceof Error ? error.stack : error
      );
      throw error;
    }
  }

  /**
   * Scheduled cron job to refresh the analytics view every hour.
   *
   * This serves as a safety net in case triggered refreshes fail
   * or for any auctions that may have been missed.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleScheduledRefresh(): Promise<void> {
    this.logger.log('Running scheduled analytics view refresh...');
    await this.refreshAnalyticsView();
  }
}
