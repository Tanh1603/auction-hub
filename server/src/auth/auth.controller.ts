import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterRequestDto } from './dto/register.dto';
import { LoginRequestDto } from './dto/login.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password.dto';
import { ResendVerificationEmailRequestDto } from './dto/resend-verification-email.dto';
import { VerifyEmailRequestDto } from './dto/verify-email.dto';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: RegisterRequestDto) {
    const result = await this.authService.register(body);
    return {
      message: 'Registration successful',
      data: result,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginRequestDto) {
    const result = await this.authService.login(body);
    
    return {
      message: 'Login successful',
      data: result,
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: ForgotPasswordRequestDto) {
    await this.authService.forgotPassword(body);
    
    return {
      message: 'Password reset code has been sent to your email',
    };
  }

  @Post('resend-verification-email')
  @HttpCode(HttpStatus.OK)
  async resendVerificationEmail(@Body() body: ResendVerificationEmailRequestDto) {
    await this.authService.resendVerificationEmail(body);
    
    return {
      message: 'Verification email sent successfully',
    };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: VerifyEmailRequestDto) {
    await this.authService.verifyEmail(body);
    
    return {
      message: 'Email verified successfully',
    };
  }

  @Get()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getUserInfo(@CurrentUser() user: CurrentUserData) {
    return {
      message: 'User information fetched successfully',
      data: user,
    };
  }
}
