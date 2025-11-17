// User-focused controller
// Handles: registration, withdrawal, check-in
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import { RegisterToBidService } from '../register-to-bid.service';
import { CreateRegisterToBidDto } from '../dto/create-register-to-bid.dto';
import { WithdrawRegistrationDto } from '../dto/withdraw-registration.dto';
import { CheckInDto } from '../dto/check-in.dto';
import {
  CurrentUser,
  CurrentUserData,
} from '../../../../common/decorators/current-user.decorator';
import { AuctionParticipantResponseDto } from '../dto/auction-participant-response.dto';

@ApiTags('register-to-bid/user')
@Controller('register-to-bid')
export class UserRegistrationController {
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
