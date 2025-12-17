import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { RegisterToBidService } from './register-to-bid.service';
import {
  CurrentUser,
  CurrentUserData,
} from '../../../common/decorators/current-user.decorator';
import { AuctionParticipantResponseDto } from './dto/auction-participant-response.dto';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/roles.enum';

/**
 * Main RegisterToBid Controller
 *
 * This controller handles user-specific registration queries.
 * Other endpoints are handled by specialized sub-controllers:
 *
 * - UserRegistrationController: POST / (create with file upload), POST /withdraw, POST /check-in
 * - RegistrationPaymentController: POST /submit-deposit, POST /verify-deposit-payment
 * - AdminApprovalController: All /admin/* routes (registrations, approve, reject, verify-documents, etc.)
 */
@ApiTags('register-to-bid')
@Controller('register-to-bid')
export class RegisterToBidController {
  constructor(private readonly svc: RegisterToBidService) {}

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
}
