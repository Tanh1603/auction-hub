import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for the summary section of dashboard analytics.
 */
export class DashboardSummaryDto {
  @ApiProperty({
    description: 'Total Gross Merchandise Value (GMV) in VND',
    example: 15000000000,
  })
  totalGmv: number;

  @ApiProperty({
    description: 'Total platform revenue (commission + dossier fees) in VND',
    example: 450000000,
  })
  totalRevenue: number;

  @ApiProperty({
    description: 'Average number of bids per auction',
    example: 12.4,
  })
  avgBids: number;

  @ApiProperty({
    description: 'Success rate percentage of completed auctions',
    example: 82.5,
  })
  successRatePercentage: number;

  @ApiProperty({
    description: 'Total number of auctions in the period',
    example: 150,
  })
  totalAuctions: number;

  @ApiProperty({
    description: 'Number of successful auctions',
    example: 124,
  })
  successfulAuctions: number;
}

/**
 * Data point for time series charts.
 */
export class TimeSeriesPointDto {
  @ApiProperty({
    description: 'The date/timestamp for this point (usually start of the day)',
    example: '2025-12-01T00:00:00.000Z',
  })
  date: string;

  @ApiProperty({
    description: 'GMV for this period',
    example: 500000000,
  })
  gmv: number;

  @ApiProperty({
    description: 'Revenue for this period',
    example: 15000000,
  })
  revenue: number;

  @ApiProperty({
    description: 'Number of auctions ended in this period',
    example: 5,
  })
  auctionCount: number;
}

/**
 * Main response DTO for dashboard analytics.
 */
export class DashboardAnalyticsResponseDto {
  @ApiProperty({
    description: 'Summary statistics for the dashboard',
    type: DashboardSummaryDto,
  })
  summary: DashboardSummaryDto;

  @ApiProperty({
    description: 'Time series data for charts',
    type: [TimeSeriesPointDto],
  })
  timeSeries: TimeSeriesPointDto[];
}
