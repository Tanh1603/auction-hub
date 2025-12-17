// Admin-focused controller
// Handles: document verification/rejection, approvals, listing registrations
import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  Param,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import { RegisterToBidService } from '../register-to-bid.service';
import { ApproveRegistrationDto } from '../dto/approve-registration.dto';
import { RejectRegistrationDto } from '../dto/reject-registration.dto';
import { ListRegistrationsQueryDto } from '../dto/list-registrations-query.dto';
import { VerifyDocumentsDto } from '../dto/verify-documents.dto';
import { RejectDocumentsDto } from '../dto/reject-documents.dto';
import { FinalApprovalDto } from '../dto/final-approval.dto';
import {
  CurrentUser,
  CurrentUserData,
} from '../../../../common/decorators/current-user.decorator';
import { AuctionParticipantResponseDto } from '../dto/auction-participant-response.dto';
import { PaginatedRegistrationsResponseDto } from '../dto/paginated-registrations-response.dto';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { UserRole } from '../../../../common/enums/roles.enum';

@ApiTags('register-to-bid/admin')
@Controller('register-to-bid/admin')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminApprovalController {
  constructor(private readonly svc: RegisterToBidService) {}

  @Get('registrations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all registrations with pagination (admin/auctioneer)',
    description:
      'Retrieve paginated list of all auction registrations with filtering options by status and auction. Useful for admins/auctioneers to review and manage registrations.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of registrations',
    type: PaginatedRegistrationsResponseDto,
  })
  async listRegistrations(
    @Query() query: ListRegistrationsQueryDto
  ): Promise<PaginatedRegistrationsResponseDto> {
    return this.svc.listRegistrations(query);
  }

  @Post('approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a registration (admin/auctioneer)',
    description:
      'Approve a pending registration, allowing the user to participate in the auction.',
  })
  @ApiResponse({
    status: 200,
    description: 'Registration approved successfully',
    type: AuctionParticipantResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid state for approval',
  })
  @ApiResponse({
    status: 409,
    description: 'Registration already confirmed',
  })
  async approveRegistration(
    @Body() dto: ApproveRegistrationDto
  ): Promise<AuctionParticipantResponseDto> {
    return this.svc.approveRegistration(dto);
  }

  @Post('reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a registration (admin/auctioneer)',
    description:
      'Reject a pending registration with a reason. Users can re-apply after rejection.',
  })
  @ApiResponse({
    status: 200,
    description: 'Registration rejected successfully',
    type: AuctionParticipantResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid state for rejection',
  })
  @ApiResponse({
    status: 409,
    description: 'Cannot reject confirmed registration',
  })
  async rejectRegistration(
    @Body() dto: RejectRegistrationDto
  ): Promise<AuctionParticipantResponseDto> {
    return this.svc.rejectRegistration(dto);
  }

  @Post('verify-documents')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify submitted documents (Tier 1 Approval)',
    description:
      'Admin/Auctioneer verifies the documents submitted by the bidder. After verification, bidder can proceed to pay deposit.',
  })
  @ApiResponse({
    status: 200,
    description: 'Documents verified successfully',
    type: AuctionParticipantResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  @ApiResponse({ status: 400, description: 'Documents not submitted yet' })
  async verifyDocuments(
    @Body() dto: VerifyDocumentsDto,
    @CurrentUser() user: CurrentUserData
  ): Promise<AuctionParticipantResponseDto> {
    return this.svc.verifyDocuments(dto.registrationId, user.id);
  }

  @Post('reject-documents')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject submitted documents (Tier 1 Rejection)',
    description:
      'Admin/Auctioneer rejects the documents with a reason. Bidder can re-submit documents.',
  })
  @ApiResponse({
    status: 200,
    description: 'Documents rejected successfully',
    type: AuctionParticipantResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async rejectDocuments(
    @Body() dto: RejectDocumentsDto
  ): Promise<AuctionParticipantResponseDto> {
    return this.svc.rejectDocuments(dto.registrationId, dto.reason);
  }

  @Post('final-approval')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Give final approval (After Tier 1 & 2)',
    description:
      'Admin/Auctioneer gives final approval after both documents are verified and deposit is paid.',
  })
  @ApiResponse({
    status: 200,
    description: 'Registration finally approved',
    type: AuctionParticipantResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Documents not verified or deposit not paid',
  })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async finalApproval(
    @Body() dto: FinalApprovalDto,
    @CurrentUser() user: CurrentUserData
  ): Promise<AuctionParticipantResponseDto> {
    return this.svc.approveRegistrationFinal(dto.registrationId, user.id);
  }
}
