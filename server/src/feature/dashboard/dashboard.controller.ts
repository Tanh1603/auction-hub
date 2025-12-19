import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardFiltersDto, DashboardAnalyticsResponseDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../../generated';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Controller for admin dashboard analytics endpoints.
 *
 * All endpoints require admin or super_admin role.
 */
@ApiTags('Dashboard')
@Controller('dashboard')
@ApiBearerAuth()
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get aggregated analytics data for the admin dashboard.
   *
   * @param filters - Optional query parameters for filtering
   * @returns Aggregated analytics summary
   */
  @Get('analytics')
  @Roles(UserRole.admin, UserRole.super_admin)
  @ApiOperation({
    summary: 'Get dashboard analytics',
    description:
      'Returns aggregated analytics data from the materialized view. Supports optional filtering by date range, asset type, and province.',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics data retrieved successfully',
    type: DashboardAnalyticsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin or super_admin role required',
  })
  async getAnalytics(
    @Query() filters: DashboardFiltersDto
  ): Promise<DashboardAnalyticsResponseDto> {
    return this.dashboardService.getAnalytics(filters);
  }

  /**
   * Manually trigger a refresh of the analytics view.
   *
   * This is useful for immediate updates after significant changes.
   * The automatic refresh runs hourly.
   */
  @Post('analytics/refresh')
  @Roles(UserRole.admin, UserRole.super_admin)
  @ApiOperation({
    summary: 'Refresh analytics view',
    description:
      'Manually triggers a refresh of the materialized view. Use this after major data changes that need to be reflected immediately.',
  })
  @ApiResponse({
    status: 200,
    description: 'Materialized view refreshed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin or super_admin role required',
  })
  async refreshAnalyticsView(): Promise<{ message: string }> {
    await this.dashboardService.refreshAnalyticsView();
    return { message: 'Analytics view refreshed successfully' };
  }
}
