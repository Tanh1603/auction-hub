import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuctionFinalizationService } from './auction-finalization.service';
import { FinalizeAuctionDto } from './dto/finalize-auction.dto';
import { OverrideAuctionStatusDto } from './dto/override-auction-status.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import {
  CurrentUser,
  CurrentUserData,
} from '../../common/decorators/current-user.decorator';

@Controller('auction-finalization')
export class AuctionFinalizationController {
  constructor(
    private readonly auctionFinalizationService: AuctionFinalizationService
  ) {}

  /**
   * Evaluate auction status based on business rules
   * GET /auction-finalization/evaluate/:auctionId
   */
  @Get('evaluate/:auctionId')
  @UseGuards(AuthGuard)
  async evaluateAuction(
    @Param('auctionId') auctionId: string,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.auctionFinalizationService.evaluateAuction(auctionId);
  }

  /**
   * Finalize auction (automatic evaluation + finalization)
   * POST /auction-finalization/finalize
   */
  @Post('finalize')
  @UseGuards(AuthGuard)
  async finalizeAuction(
    @Body() dto: FinalizeAuctionDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.auctionFinalizationService.finalizeAuction(dto, user.id);
  }

  /**
   * Admin override - manually change auction status
   * POST /auction-finalization/override
   * Use cases:
   * - Detect fraudulent activity -> cancel auction
   * - Revoke winner due to payment failure
   * - Manual intervention for edge cases
   */
  @Post('override')
  @UseGuards(AuthGuard)
  async overrideAuctionStatus(
    @Body() dto: OverrideAuctionStatusDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.auctionFinalizationService.overrideAuctionStatus(dto, user.id);
  }

  /**
   * Get auction results
   * GET /auction-finalization/results/:auctionId
   */
  @Get('results/:auctionId')
  @UseGuards(AuthGuard)
  async getAuctionResults(
    @Param('auctionId') auctionId: string,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.auctionFinalizationService.getAuctionResults(auctionId, user.id);
  }

  /**
   * Get audit logs for an auction
   * GET /auction-finalization/audit-logs/:auctionId
   * Only auction owner can view
   */
  @Get('audit-logs/:auctionId')
  @UseGuards(AuthGuard)
  async getAuctionAuditLogs(
    @Param('auctionId') auctionId: string,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.auctionFinalizationService.getAuctionAuditLogs(auctionId, user.id);
  }
}
