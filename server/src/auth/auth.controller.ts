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
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
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
import {
  CurrentUser,
  CurrentUserData,
} from '../common/decorators/current-user.decorator';

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

  /**
   * GET endpoint for email verification link clicks
   * Handles: /auth/verify?token=xxx&email=xxx
   */
  @Public()
  @Get('verify')
  async verifyEmailFromLink(
    @Query('token') token: string,
    @Query('email') email: string,
    @Res() res: Response
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    try {
      if (!token || !email) {
        return res.redirect(
          `${frontendUrl}/auth/verify-result?success=false&error=Missing token or email`
        );
      }

      await this.authService.verifyEmail({ token, email });

      // Redirect to frontend success page
      return res.redirect(
        `${frontendUrl}/auth/verify-result?success=true&message=Email verified successfully`
      );
    } catch (error) {
      // Redirect to frontend with error
      const errorMessage = error.message || 'Verification failed';
      return res.redirect(
        `${frontendUrl}/auth/verify-result?success=false&error=${encodeURIComponent(
          errorMessage
        )}`
      );
    }
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getUserInfo(@CurrentUser() user: CurrentUserData) {
    // AuthGuard has already validated token and fetched user from DB
    // Just fetch full user data (excluding sensitive fields)
    return this.userService.getUserById(user.id);
  }

  /**
   * Admin-only user promotion endpoint
   */
  @Put('admin/users/:userId/promote')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async promoteUser(
    @CurrentUser() adminUser: CurrentUserData,
    @Param('userId') userId: string,
    @Body() promoteData: PromoteUserDto
  ) {
    return this.userService.promoteUser(adminUser, userId, promoteData);
  }
}
