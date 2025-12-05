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
  ForbiddenException,
} from '@nestjs/common';
import { RegisterToBidService } from './register-to-bid.service';
import { WithdrawRegistrationDto } from './dto/withdraw-registration.dto';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { RejectRegistrationDto } from './dto/reject-registration.dto';
import { ListRegistrationsQueryDto } from './dto/list-registrations-query.dto';
import { VerifyDocumentsDto } from './dto/verify-documents.dto';
import { RejectDocumentsDto } from './dto/reject-documents.dto';
import { SubmitDepositDto } from './dto/submit-deposit.dto';
import { VerifyDepositPaymentDto } from './dto/verify-deposit-payment.dto';
import { FinalApprovalDto } from './dto/final-approval.dto';
import { CheckInDto } from './dto/check-in.dto';
import {
  CurrentUser,
  CurrentUserData,
} from '../../../common/decorators/current-user.decorator';
import { AuctionParticipantResponseDto } from './dto/auction-participant-response.dto';
import { PaginatedRegistrationsResponseDto } from './dto/paginated-registrations-response.dto';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/roles.enum';

@ApiTags('register-to-bid')
@Controller('register-to-bid')
export class RegisterToBidController {
  constructor(private readonly svc: RegisterToBidService) {}

  // NOTE: The @Post() create endpoint is handled by UserRegistrationController
  // which supports multipart/form-data with file uploads (documents & media)

  @Post('withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Withdraw from auction',
    description:
      'Allows user to withdraw their registration from an auction before it starts. Cannot withdraw after auction has started or after checking in.',
  })
  @ApiResponse({
    status: 200,
    description: 'Registration withdrawn successfully',
    type: AuctionParticipantResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Auction or registration not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot withdraw after auction started or after check-in',
  })
  @ApiResponse({
    status: 409,
    description: 'Registration already withdrawn',
  })
  @ApiBearerAuth()
  withdraw(
    @Body() dto: WithdrawRegistrationDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.svc.withdraw(dto, user);
  }

  @Get('users/:userId/registrations')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.AUCTIONEER,
    UserRole.SUPER_ADMIN,
    UserRole.BIDDER
  )
  @ApiOperation({
    summary: 'List all registrations for a user',
    description:
      'Retrieve all auction registrations for a specific user. Users can only see their own registrations.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of registrations',
    type: [AuctionParticipantResponseDto],
  })
  @ApiResponse({ status: 404, description: 'User has no registrations' })
  @ApiBearerAuth()
  async listForUser(
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserData
  ): Promise<AuctionParticipantResponseDto[]> {
    // If not admin/auctioneer, ensure user is requesting their own data
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.AUCTIONEER
    ) {
      if (user.id !== userId) {
        throw new ForbiddenException(
          'You can only view your own registrations'
        );
      }
    }
    return this.svc.getRegistrationStatusOfOneUserForAdmin(userId);
  }

  @Get('auctions/:auctionId/registration')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.AUCTIONEER,
    UserRole.SUPER_ADMIN,
    UserRole.BIDDER
  )
  @ApiOperation({
    summary: 'Get registration for a specific auction',
    description:
      'Retrieve the registration details for the current user for a specific auction.',
  })
  @ApiResponse({
    status: 200,
    description: 'Registration details',
    type: AuctionParticipantResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  @ApiBearerAuth()
  async getRegistrationForAuction(
    @Param('auctionId') auctionId: string,
    @CurrentUser() user: CurrentUserData
  ): Promise<AuctionParticipantResponseDto> {
    return this.svc.getRegistrationForAuction(user.id, auctionId);
  }

  @Get('admin/registrations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
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
  @ApiBearerAuth()
  async listRegistrations(
    @Query() query: ListRegistrationsQueryDto
  ): Promise<PaginatedRegistrationsResponseDto> {
    return this.svc.listRegistrations(query);
  }

  @Post('admin/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
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
  @ApiBearerAuth()
  async approveRegistration(
    @Body() dto: ApproveRegistrationDto
  ): Promise<AuctionParticipantResponseDto> {
    return this.svc.approveRegistration(dto);
  }

  @Post('admin/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
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
  @ApiBearerAuth()
  async rejectRegistration(
    @Body() dto: RejectRegistrationDto
  ): Promise<AuctionParticipantResponseDto> {
    return this.svc.rejectRegistration(dto);
  }

  @Post('admin/verify-documents')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
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
  @ApiBearerAuth()
  async verifyDocuments(
    @Body() dto: VerifyDocumentsDto,
    @CurrentUser() user: CurrentUserData
  ): Promise<AuctionParticipantResponseDto> {
    return this.svc.verifyDocuments(dto.registrationId, user.id);
  }

  @Post('admin/reject-documents')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
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
  @ApiBearerAuth()
  async rejectDocuments(
    @Body() dto: RejectDocumentsDto
  ): Promise<AuctionParticipantResponseDto> {
    return this.svc.rejectDocuments(dto.registrationId, dto.reason);
  }

  @Post('submit-deposit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit deposit payment (Tier 2)',
    description:
      'Bidder initiates deposit payment after documents are verified. Creates Stripe payment session and returns payment URL/QR code.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Deposit payment initiated successfully. Returns payment URL and details.',
  })
  @ApiResponse({
    status: 400,
    description: 'Documents not verified or invalid amount',
  })
  @ApiResponse({
    status: 404,
    description: 'Registration not found',
  })
  @ApiBearerAuth()
  async submitDeposit(
    @Body() dto: SubmitDepositDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.svc.submitDeposit(
      dto.registrationId,
      dto.auctionId,
      dto.amount,
      user.id
    );
  }

  @Post('verify-deposit-payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify deposit payment completion',
    description:
      'Verify that the Stripe payment has been completed and update the registration accordingly.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verified and registration updated',
  })
  @ApiResponse({
    status: 400,
    description: 'Payment not completed or invalid',
  })
  @ApiResponse({
    status: 404,
    description: 'Registration or payment not found',
  })
  @ApiBearerAuth()
  async verifyDepositPayment(
    @Body() dto: VerifyDepositPaymentDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.svc.verifyDepositPayment(
      dto.sessionId,
      dto.registrationId,
      user.id
    );
  }

  @Post('admin/final-approval')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
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
  @ApiBearerAuth()
  async finalApproval(
    @Body() dto: FinalApprovalDto,
    @CurrentUser() user: CurrentUserData
  ): Promise<AuctionParticipantResponseDto> {
    return this.svc.approveRegistrationFinal(dto.registrationId, user.id);
  }

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check in for auction',
    description:
      'Participant checks in before or at the start of auction to confirm attendance and enable bidding. Check-in window opens 24 hours before auction starts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully checked in',
    type: AuctionParticipantResponseDto,
  })
  @ApiResponse({
    status: 403,
    description:
      'Registration not confirmed, check-in window not open, or auction ended',
  })
  @ApiResponse({
    status: 404,
    description: 'Auction or registration not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Already checked in',
  })
  @ApiBearerAuth()
  async checkIn(
    @Body() dto: CheckInDto,
    @CurrentUser() user: CurrentUserData
  ): Promise<AuctionParticipantResponseDto> {
    return this.svc.checkIn(dto.auctionId, user.id);
  }
}
