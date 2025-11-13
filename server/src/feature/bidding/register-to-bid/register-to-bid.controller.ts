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
import { RegisterToBidService } from './register-to-bid.service';
import { CreateRegisterToBidDto } from './dto/create-register-to-bid.dto';
import { WithdrawRegistrationDto } from './dto/withdraw-registration.dto';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { RejectRegistrationDto } from './dto/reject-registration.dto';
import { ListRegistrationsQueryDto } from './dto/list-registrations-query.dto';
import {
  CurrentUser,
  CurrentUserData,
} from '../../../common/decorators/current-user.decorator';
import { AuctionParticipantResponseDto } from './dto/auction-participant-response.dto';
import { PaginatedRegistrationsResponseDto } from './dto/paginated-registrations-response.dto';
import { ApiOperation, ApiResponse, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/roles.enum';

@ApiTags('register-to-bid')
@Controller('register-to-bid')
export class RegisterToBidController {
  constructor(private readonly svc: RegisterToBidService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register or resubmit for auction',
    description:
      'Register to bid on an auction. Can resubmit if rejected or re-apply if withdrawn.',
  })
  @ApiResponse({
    status: 201,
    description: 'Registration created or resubmitted',
    type: AuctionParticipantResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Registration period closed' })
  @ApiResponse({ status: 403, description: 'User banned or not eligible' })
  @ApiResponse({ status: 404, description: 'Auction not found' })
  @ApiResponse({
    status: 409,
    description: 'Already confirmed or under review',
  })
  @ApiBearerAuth()
  create(
    @Body() dto: CreateRegisterToBidDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.svc.create(dto, user);
  }

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
  @ApiResponse({ status: 404, description: 'Auction or registration not found' })
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

  @Get('admin/users/:userId/registrations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AUCTIONEER, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List all registrations for a user (admin)',
    description: 'Retrieve all auction registrations for a specific user.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of registrations',
    type: [AuctionParticipantResponseDto],
  })
  @ApiResponse({ status: 404, description: 'User has no registrations' })
  @ApiBearerAuth()
  async listForUser(
    @Param('userId') userId: string
  ): Promise<AuctionParticipantResponseDto[]> {
    return this.svc.getRegistrationStatusOfOneUserForAdmin(userId);
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
}
