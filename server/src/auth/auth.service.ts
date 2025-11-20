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
  constructor(
    private prisma: PrismaService,
    private supabaseService: SupabaseService
  ) {}

  async register(request: RegisterRequestDto): Promise<RegisterResponseDto> {
    let newSupabaseUser = null;

    try {
      // === PHASE 1: CREATE SUPABASE AUTH USER (using admin client) ===
      const { data, error: authError } =
        await this.supabaseService.authAdmin.createUser({
          email: request.email,
          password: request.password,
          email_confirm: false, // Will require email verification
          user_metadata: {
            full_name: request.full_name,
            phone_number: request.phone_number,
            identity_number: request.identity_number,
            user_type: request.user_type,
            tax_id: request.tax_id,
          },
        });

      if (authError || !data.user) {
        throw new BadRequestException(
          'Failed to create user in Supabase: ' +
            (authError?.message || 'No user data returned')
        );
      }

      newSupabaseUser = data.user;

      // Check for existing users with same unique fields BEFORE creating
      await this.validateUniqueFields(request);

      // === PHASE 2: CREATE LOCAL DB USER ===
      const localUser = await this.prisma.user.create({
        data: {
          id: newSupabaseUser.id, // Use Supabase user ID
          email: newSupabaseUser.email || request.email,
          phoneNumber: request.phone_number,
          fullName: request.full_name || '',
          identityNumber: request.identity_number,
          userType: request.user_type || 'individual',
          taxId: request.tax_id,
          role: 'bidder', // Everyone starts as bidder
        },
      });

      // === SUCCESS ===
      return {
        user_id: localUser.id,
        email: localUser.email,
        verification_required: true,
      };
    } catch (error) {
      // === ROLLBACK ===
      // If local DB creation fails, delete the Supabase user to prevent orphaned accounts
      if (newSupabaseUser) {
        try {
          await this.supabaseService.authAdmin.deleteUser(newSupabaseUser.id);
        } catch (rollbackError) {
          // Log the rollback error but don't throw it
          console.error('Failed to rollback Supabase user:', rollbackError);
        }
      }

      // Re-throw the original error
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Signup failed. Please try again.');
    }
  }

  private async validateUniqueFields(
    request: RegisterRequestDto
  ): Promise<void> {
    // Check for existing email
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: request.email },
    });
    if (existingEmail) {
      throw new BadRequestException('User with this email already exists');
    }

    // Check for existing phone number
    if (request.phone_number) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phoneNumber: request.phone_number },
      });
      if (existingPhone) {
        throw new BadRequestException(
          'User with this phone number already exists'
        );
      }
    }

    // Check for existing identity number
    if (request.identity_number) {
      const existingIdentity = await this.prisma.user.findUnique({
        where: { identityNumber: request.identity_number },
      });
      if (existingIdentity) {
        throw new BadRequestException(
          'User with this identity number already exists'
        );
      }
    }
  }

  async login(request: LoginRequestDto): Promise<LoginResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: request.email },
    });

    if (!existingUser) {
      throw new BadRequestException('User not found');
    }

    const { data, error } = await this.supabaseService.auth.signInWithPassword({
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
    const { error } = await this.supabaseService.auth.resetPasswordForEmail(
      request.email,
      {
        redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
      }
    );
    if (error) {
      throw new BadRequestException(
        'Failed to send reset password email. ' + error.message
      );
    }

    if (!user) {
      throw new BadRequestException('User not found');
    }
  }

  async resendVerificationEmail(
    request: ResendVerificationEmailRequestDto
  ): Promise<void> {
    const { error } = await this.supabaseService.auth.resend({
      type: 'signup',
      email: request.email,
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/auth/verify`,
      },
    });

    if (error) {
      throw new BadRequestException(
        'Failed to resend verification email. ' + error.message
      );
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
