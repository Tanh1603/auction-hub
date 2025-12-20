/**
 * RefundController - Handles refund-related API endpoints
 * Admin routes for managing refunds and user route for requesting refunds
 */
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { RefundService, RefundDetailDto } from '../services/refund.service';
import { RequestRefundDto } from '../dto/request-refund.dto';
import { UpdateRefundDto, RefundAction } from '../dto/update-refund.dto';
import { ListRefundsQueryDto } from '../dto/list-refunds-query.dto';
import {
  CurrentUser,
  CurrentUserData,
} from '../../../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { UserRole } from '../../../../common/enums/roles.enum';

@ApiTags('register-to-bid/refunds')
@Controller('register-to-bid')
@ApiBearerAuth()
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  // ============ User Endpoint ============

  @Post('request-refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a refund of deposit (Bidder)',
    description:
      'Allows a bidder to request a refund of their deposit after withdrawing from an auction. ' +
      'Admin will be notified via email. Refund is subject to eligibility evaluation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Refund request submitted successfully',
  })
  @ApiResponse({ status: 400, description: 'Not eligible for refund' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  @ApiResponse({
    status: 409,
    description: 'Refund already requested or processed',
  })
  async requestRefund(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RequestRefundDto
  ): Promise<RefundDetailDto> {
    return this.refundService.requestRefund(dto.auctionId, user.id, dto.reason);
  }

  // ============ Admin Endpoints ============

  @Get('admin/refunds')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all refunds with filtering (Admin/Auctioneer)',
    description:
      'Retrieve paginated list of refund requests with optional filtering by auction and status.',
  })
  @ApiResponse({ status: 200, description: 'List of refund records' })
  async listRefunds(@Query() query: ListRefundsQueryDto) {
    return this.refundService.listRefunds(query);
  }

  @Get('admin/refunds/:participantId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get refund details for a participant (Admin/Auctioneer)',
    description:
      'Get detailed refund information including eligibility evaluation.',
  })
  @ApiParam({ name: 'participantId', description: 'Participant ID' })
  @ApiResponse({ status: 200, description: 'Refund details' })
  @ApiResponse({ status: 404, description: 'Participant not found' })
  async getRefundDetail(
    @Param('participantId') participantId: string
  ): Promise<RefundDetailDto> {
    return this.refundService.getRefundDetail(participantId);
  }

  @Patch('admin/refunds/:participantId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update refund status (Admin/Auctioneer)',
    description:
      'Approve, reject, or process a refund request. User will be notified via email.',
  })
  @ApiParam({ name: 'participantId', description: 'Participant ID' })
  @ApiResponse({ status: 200, description: 'Refund status updated' })
  @ApiResponse({ status: 400, description: 'Invalid action or state' })
  @ApiResponse({ status: 404, description: 'Participant not found' })
  async updateRefund(
    @Param('participantId') participantId: string,
    @CurrentUser() admin: CurrentUserData,
    @Body() dto: UpdateRefundDto
  ): Promise<RefundDetailDto> {
    switch (dto.action) {
      case RefundAction.APPROVE:
        return this.refundService.approveRefund(participantId, admin.id);

      case RefundAction.REJECT:
        if (!dto.reason) {
          throw new BadRequestException('Reason is required for rejection');
        }
        return this.refundService.rejectRefund(
          participantId,
          admin.id,
          dto.reason
        );

      case RefundAction.PROCESS:
        return this.refundService.processRefund(participantId, admin.id);

      default:
        throw new BadRequestException(`Unknown action: ${dto.action}`);
    }
  }

  @Post('admin/refunds/batch/:auctionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Batch process all eligible refunds for an auction (Admin)',
    description:
      'Automatically process refunds for all eligible participants of an auction. ' +
      'Winners and disqualified participants are skipped.',
  })
  @ApiParam({ name: 'auctionId', description: 'Auction ID' })
  @ApiResponse({
    status: 200,
    description: 'Batch processing result',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number' },
        skipped: { type: 'number' },
        failed: { type: 'number' },
      },
    },
  })
  async batchProcessRefunds(
    @Param('auctionId') auctionId: string,
    @CurrentUser() admin: CurrentUserData
  ) {
    return this.refundService.processAllRefundsForAuction(auctionId, admin.id);
  }
}
