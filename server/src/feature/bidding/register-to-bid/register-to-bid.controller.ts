import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  Get,
  Param,
  HttpStatus,
} from '@nestjs/common';
import { RegisterToBidService } from './register-to-bid.service';
import { CreateRegisterToBidDto } from './dto/create-register-to-bid.dto';
import { WithdrawRegistrationDto } from './dto/withdraw-registration.dto';
import { AuthGuard } from '../../../common/guards/auth.guard';
import {
  CurrentUser,
  CurrentUserData,
} from '../../../common/decorators/current-user.decorator';
import { AuctionParticipantResponseDto } from './dto/auction-participant-response.dto';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@Controller('register-to-bid')
export class RegisterToBidController {
  constructor(private readonly svc: RegisterToBidService) {}

  @Post()
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard) // TODO: Add RoleGuard('admin')
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
}
