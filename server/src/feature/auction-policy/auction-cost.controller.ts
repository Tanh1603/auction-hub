import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuctionCostService } from './auction-cost.service';
import { CreateAuctionCostDto } from './dto/create-auction-cost.dto';
import { UpdateAuctionCostDto } from './dto/update-auction-cost.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/roles.enum';

@ApiTags('Auction Costs')
@Controller('auction-costs')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AuctionCostController {
  constructor(private readonly costService: AuctionCostService) {}

  /**
   * CREATE/UPDATE: Set auction costs for an auction (Admin/Auctioneer only)
   */
  @Post('auction/:auctionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create or update auction costs' })
  @ApiResponse({
    status: 201,
    description: 'Costs created/updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Auction not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin/Auctioneer access required',
  })
  upsert(
    @Param('auctionId') auctionId: string,
    @Body() createDto: CreateAuctionCostDto
  ) {
    return this.costService.upsert(auctionId, createDto);
  }

  /**
   * READ: Get auction costs by auction ID
   */
  @Get('auction/:auctionId')
  @ApiOperation({ summary: 'Get auction costs for a specific auction' })
  @ApiResponse({ status: 200, description: 'Costs retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Costs not found' })
  findByAuction(@Param('auctionId') auctionId: string) {
    return this.costService.findByAuction(auctionId);
  }

  /**
   * UPDATE: Modify specific cost fields (Admin/Auctioneer only)
   */
  @Patch('auction/:auctionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update specific auction cost fields' })
  @ApiResponse({ status: 200, description: 'Costs updated successfully' })
  @ApiResponse({ status: 404, description: 'Costs not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin/Auctioneer access required',
  })
  update(
    @Param('auctionId') auctionId: string,
    @Body() updateDto: UpdateAuctionCostDto
  ) {
    return this.costService.update(auctionId, updateDto);
  }

  /**
   * DELETE: Remove auction costs (Admin only)
   */
  @Delete('auction/:auctionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete auction costs' })
  @ApiResponse({ status: 204, description: 'Costs deleted successfully' })
  @ApiResponse({ status: 404, description: 'Costs not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  remove(@Param('auctionId') auctionId: string) {
    return this.costService.remove(auctionId);
  }

  /**
   * ADD: Add individual "other cost" item (Admin/Auctioneer only)
   */
  @Post('auction/:auctionId/other-cost')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add an individual "other cost" item' })
  @ApiResponse({ status: 201, description: 'Cost item added successfully' })
  @ApiResponse({ status: 404, description: 'Costs not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin/Auctioneer access required',
  })
  addOtherCost(
    @Param('auctionId') auctionId: string,
    @Body() body: { description: string; amount: number }
  ) {
    return this.costService.addOtherCost(
      auctionId,
      body.description,
      body.amount
    );
  }
}
