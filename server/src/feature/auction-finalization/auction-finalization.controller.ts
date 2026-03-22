import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuctionFinalizationService } from './auction-finalization.service';
import { FinalizeAuctionDto } from './dto/finalize-auction.dto';
import { OverrideAuctionStatusDto } from './dto/override-auction-status.dto';
import { InitiateWinnerPaymentDto } from './dto/initiate-winner-payment.dto';
import { VerifyWinnerPaymentDto } from './dto/verify-winner-payment.dto';
import {
  CurrentUser,
  CurrentUserData,
} from '../../common/decorators/current-user.decorator';
import { OptionalCurrentUser } from '../../common/decorators/optional-current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums/roles.enum';

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
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
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
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
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
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async overrideAuctionStatus(
    @Body() dto: OverrideAuctionStatusDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.auctionFinalizationService.overrideAuctionStatus(dto, user.id);
  }

  /**
   * Get auction results - PUBLIC endpoint with tiered access:
   * - Admin/Super Admin: Full access to all data
   * - Auctioneer (owner): Full access to their auctions
   * - Authenticated Participant: All data but winner name hidden
   * - Public (unauthenticated): Limited data for finalized auctions only
   *
   * GET /auction-finalization/results/:auctionId
   */
  @Get('results/:auctionId')
  @Public()
  async getAuctionResults(
    @Param('auctionId') auctionId: string,
    @OptionalCurrentUser() user: CurrentUserData | null
  ) {
    return this.auctionFinalizationService.getAuctionResults(
      auctionId,
      user?.id || null,
      user?.role || null
    );
  }

  /**
   * Get audit logs for an auction
   * GET /auction-finalization/audit-logs/:auctionId
   * Only auction owner can view
   */
  @Get('audit-logs/:auctionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
  async getAuctionAuditLogs(
    @Param('auctionId') auctionId: string,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.auctionFinalizationService.getAuctionAuditLogs(
      auctionId,
      user.id
    );
  }

  /**
   * Get winner payment requirements
   * GET /auction-finalization/winner-payment-requirements/:auctionId
   */
  @Get('winner-payment-requirements/:auctionId')
  async getWinnerPaymentRequirements(
    @Param('auctionId') auctionId: string,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.auctionFinalizationService.getWinnerPaymentRequirements(
      auctionId
    );
  }

  /**
   * Initiate winner payment (creates Stripe payment session)
   * POST /auction-finalization/submit-winner-payment
   */
  @Post('submit-winner-payment')
  async initiateWinnerPayment(
    @Body() dto: InitiateWinnerPaymentDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.auctionFinalizationService.initiateWinnerPayment(
      dto.auctionId,
      user.id
    );
  }

  /**
   * Verify winner payment completion
   * POST /auction-finalization/verify-winner-payment
   * Can be called by:
   * - Winner: To verify their own payment
   * - Admin/Auctioneer: To verify payment on behalf of winner
   */
  @Post('verify-winner-payment')
  @HttpCode(HttpStatus.OK)
  async verifyWinnerPayment(
    @Body() dto: VerifyWinnerPaymentDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.auctionFinalizationService.verifyWinnerPayment(
      dto.sessionId,
      dto.auctionId,
      user.id
    );
  }

  /**
   * Get management detail for admin override operations
   * GET /auction-finalization/management-detail/:auctionId
   * Returns full bidding pool and participant status for manual winner selection
   * Only accessible by admin/super_admin
   */
  @Get('management-detail/:auctionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getManagementDetail(
    @Param('auctionId') auctionId: string,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.auctionFinalizationService.getManagementDetail(
      auctionId,
      user.id
    );
  }
}
