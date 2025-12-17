// Payment-focused controller
// Handles: deposit submission and verification
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import { RegisterToBidService } from '../register-to-bid.service';
import { SubmitDepositDto } from '../dto/submit-deposit.dto';
import { VerifyDepositPaymentDto } from '../dto/verify-deposit-payment.dto';
import {
  CurrentUser,
  CurrentUserData,
} from '../../../../common/decorators/current-user.decorator';

@ApiTags('register-to-bid/payment')
@Controller('register-to-bid')
export class RegistrationPaymentController {
  constructor(private readonly svc: RegisterToBidService) {}

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
}
