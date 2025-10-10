import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterRequestDto, RegisterResponseDto } from './dto/register.dto';
import { LoginRequestDto, LoginResponseDto } from './dto/login.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password.dto';
import { VerifyEmailRequestDto } from './dto/verify-email.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { ResendVerificationEmailRequestDto } from './dto/resend-verification-email.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private supabaseService: SupabaseService) {}

  async register(request: RegisterRequestDto): Promise<RegisterResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: request.email },
    });


    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

      const { error } = await this.supabaseService.auth.signUp({
        email: request.email,
        password: request.password,
        options: {
          data: {
            full_name: request.full_name,
            phone_number: request.phone_number,
            identity_number: request.identity_number,
            user_type: request.user_type,
          },
          emailRedirectTo: `${process.env.FRONTEND_URL}/auth/verify`,
        },
      });

    if (error) {
      throw new BadRequestException('Failed to create user in Supabase. ' + error.message);
    }


    const user = await this.prisma.user.create({
      data: {
        email: request.email,
        phoneNumber: request.phone_number,
        fullName: request.full_name || '',
        identityNumber: request.identity_number,
        userType: request.user_type || 'individual',
        taxId: request.tax_id,
      },
    });

    return {
      user_id: user.id,
      email: user.email,
      verification_required: true,
    };
  }

  async login(request: LoginRequestDto): Promise<LoginResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: request.email },
    });
    
    if (!existingUser) {
      throw new BadRequestException('User not found');
    }

    const {data, error } = await this.supabaseService.auth.signInWithPassword({
      email: request.email,
      password: request.password,
    });

    if (error) {
      throw new BadRequestException('Failed to login. ' + error.message);
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      user: existingUser,
    };
  }

  async forgotPassword(request: ForgotPasswordRequestDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: request.email },
    });
      const { error } = await this.supabaseService.auth.resetPasswordForEmail(request.email, {
          redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
        });
      if (error) {
      throw new BadRequestException('Failed to send reset password email. ' + error.message);
    }

    if (!user) {
      throw new BadRequestException('User not found');
    }

  }

  async resendVerificationEmail(request: ResendVerificationEmailRequestDto): Promise<void> {
    const { error } = await this.supabaseService.auth.resend({
      type: 'signup',
      email: request.email,
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/auth/verify`
      }
    })

    if (error) {
      throw new BadRequestException('Failed to resend verification email. ' + error.message);
    }
  }

  async verifyEmail(request: VerifyEmailRequestDto): Promise<void> {
    const { error } = await this.supabaseService.auth.verifyOtp({
      email: request.email,
      type: 'email',
      token: request.token,
    });

    if (error) {
      throw new BadRequestException('Failed to verify email. ' + error.message);
    }
  }


}
