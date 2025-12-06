import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SystemVariablesService } from '../services/system-variables.service';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserData,
} from '../decorators/current-user.decorator';

/**
 * System Variables Controller
 * Manages system-wide configuration variables
 * ADMIN ONLY - System engine configuration is sensitive
 */
@ApiTags('System Variables')
@Controller('system-variables')
@UseGuards(AuthGuard, RolesGuard)
export class SystemVariablesController {
  constructor(private readonly sysVars: SystemVariablesService) {}

  /**
   * Get all system variables or filtered by category
   */
  @Get()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get all system variables (Admin only)' })
  @ApiResponse({ status: 200, description: 'System variables retrieved' })
  async getAll(@Query('category') category?: string) {
    if (category) {
      return {
        category,
        variables: await this.sysVars.getCategory(category),
      };
    }
    return await this.sysVars.getAllVariables();
  }

  /**
   * Get a specific system variable
   * Admin only - system configuration is sensitive
   */
  @Get(':category/:key')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get a specific system variable (Admin only)' })
  @ApiResponse({ status: 200, description: 'Variable retrieved' })
  @ApiResponse({ status: 404, description: 'Variable not found' })
  async getVariable(
    @Param('category') category: string,
    @Param('key') key: string
  ) {
    const value = await this.sysVars.get(category, key);
    return {
      category,
      key: `${category}.${key}`,
      value,
    };
  }

  /**
   * Update a system variable value
   */
  @Patch(':category/:key')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update system variable (Admin only)' })
  @ApiResponse({ status: 200, description: 'Variable updated' })
  @ApiResponse({ status: 404, description: 'Variable not found' })
  async updateVariable(
    @Param('category') category: string,
    @Param('key') key: string,
    @Body('value') value: string,
    @CurrentUser() user: CurrentUserData
  ) {
    const updated = await this.sysVars.update(category, key, value, user.id);
    this.sysVars.clearCache(); // Clear entire cache after update
    return {
      message: 'System variable updated successfully',
      variable: updated,
    };
  }

  /**
   * Create a new system variable
   */
  @Post()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Create new system variable (Admin only)' })
  @ApiResponse({ status: 201, description: 'Variable created' })
  async createVariable(
    @Body('category') category: string,
    @Body('key') key: string,
    @Body('value') value: string,
    @Body('dataType') dataType: 'number' | 'boolean' | 'string' | 'json',
    @Body('description') description?: string
  ) {
    const created = await this.sysVars.create(
      category,
      key,
      value,
      dataType,
      description
    );
    return {
      message: 'System variable created successfully',
      variable: created,
    };
  }

  /**
   * Clear system variables cache
   */
  @Post('cache/clear')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Clear system variables cache (Admin only)' })
  @ApiResponse({ status: 200, description: 'Cache cleared' })
  async clearCache(@Query('category') category?: string) {
    if (category) {
      this.sysVars.clearCategoryCache(category);
      return {
        message: `Cache cleared for category: ${category}`,
      };
    }

    this.sysVars.clearCache();
    return {
      message: 'All system variables cache cleared',
    };
  }

  /**
   * Get cache statistics
   */
  @Get('cache/stats')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get cache statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Cache stats retrieved' })
  async getCacheStats() {
    return this.sysVars.getCacheStats();
  }
}
