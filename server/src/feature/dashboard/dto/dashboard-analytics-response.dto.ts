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
 * Main response DTO for dashboard analytics.
 */
export class DashboardAnalyticsResponseDto {
  @ApiProperty({
    description: 'Summary statistics for the dashboard',
    type: DashboardSummaryDto,
  })
  summary: DashboardSummaryDto;
}
