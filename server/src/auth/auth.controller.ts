import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Headers,
  Put,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { RegisterRequestDto } from './dto/register.dto';
import { LoginRequestDto } from './dto/login.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password.dto';
import { ResendVerificationEmailRequestDto } from './dto/resend-verification-email.dto';
import { VerifyEmailRequestDto } from './dto/verify-email.dto';
import { PromoteUserDto } from './dto/promote-user.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService
  ) {}

  /**
   * Single-endpoint registration: Creates both Supabase and local DB user atomically
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: RegisterRequestDto) {
    return this.authService.register(body);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginRequestDto) {
    return this.authService.login(body);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: ForgotPasswordRequestDto) {
    await this.authService.forgotPassword(body);

    return {
      message: 'Password reset code has been sent to your email',
    };
  }

  @Public()
  @Post('resend-verification-email')
  @HttpCode(HttpStatus.OK)
  async resendVerificationEmail(
    @Body() body: ResendVerificationEmailRequestDto
  ) {
    await this.authService.resendVerificationEmail(body);

    return {
      message: 'Verification email sent successfully',
    };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: VerifyEmailRequestDto) {
    await this.authService.verifyEmail(body);

    return {
      message: 'Email verified successfully',
    };
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getUserInfo(@Headers('authorization') authHeader: string) {
    return this.userService.getCurrentUser(authHeader);
  }

  /**
   * Admin-only user promotion endpoint
   */
  @Put('admin/users/:userId/promote')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async promoteUser(
    @Headers('authorization') authHeader: string,
    @Param('userId') userId: string,
    @Body() promoteData: PromoteUserDto
  ) {
    return this.userService.promoteUser(authHeader, userId, promoteData);
  }
}
