import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  RegisterUserRequestDto,
  RegisterUserResponseDto,
} from './dto/register-user.dto';
import { PromoteUserDto } from './dto/promote-user.dto';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private supabaseService: SupabaseService
  ) {}

  /**
   * Step 1 Implementation: Register user in local DB after Supabase signup
   * Called with Authorization header containing Supabase JWT
   */
  async registerUser(
    authorizationHeader: string,
    request?: RegisterUserRequestDto
  ): Promise<RegisterUserResponseDto> {
    // Extract and validate JWT
    const token = this.extractTokenFromHeader(authorizationHeader);
    const supabaseUser = await this.validateSupabaseToken(token);

    // Check if user already exists in local DB
    const existingUser = await this.prisma.user.findUnique({
      where: { id: supabaseUser.id },
    });

    if (existingUser) {
      throw new BadRequestException('User already registered in system');
    }

    // Validate unique constraints
    await this.validateUniqueFields(
      supabaseUser.email,
      request?.phone_number,
      request?.identity_number
    );

    // Get user data from either request body or Supabase metadata
    const userData = this.extractUserData(supabaseUser, request);

    // Create user in local DB with default 'bidder' role
    const user = await this.prisma.user.create({
      data: {
        id: supabaseUser.id, // Use Supabase user ID
        email: userData.email,
        phoneNumber: userData.phone_number,
        fullName: userData.full_name,
        identityNumber: userData.identity_number,
        userType: userData.user_type,
        taxId: userData.tax_id,
        role: 'bidder', // Everyone starts as bidder
      },
    });

    return {
      user_id: user.id,
      email: user.email,
      role: user.role,
      message: 'User registered successfully with bidder role',
    };
  }

  /**
   * Step 3 Implementation: Promote user (admin only)
   */
  async promoteUser(
    authorizationHeader: string,
    userIdToPromote: string,
    promoteData: PromoteUserDto
  ): Promise<{ message: string; user: any }> {
    // Validate admin permissions
    const adminUser = await this.validateAdminPermissions(authorizationHeader);

    // Find user to promote
    const userToPromote = await this.prisma.user.findUnique({
      where: { id: userIdToPromote },
    });

    if (!userToPromote) {
      throw new NotFoundException('User not found');
    }

    // Validate promotion rules
    this.validatePromotionRules(adminUser.role, promoteData.role);

    // Update user role
    const updatedUser = await this.prisma.user.update({
      where: { id: userIdToPromote },
      data: { role: promoteData.role },
    });

    return {
      message: `User promoted to ${promoteData.role} successfully`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
      },
    };
  }

  /**
   * Get current user info from token
   */
  async getCurrentUser(authorizationHeader: string) {
    const token = this.extractTokenFromHeader(authorizationHeader);
    const supabaseUser = await this.validateSupabaseToken(token);

    const user = await this.prisma.user.findUnique({
      where: { id: supabaseUser.id },
    });

    if (!user) {
      throw new NotFoundException(
        'User not found in system. Please register first.'
      );
    }

    return user;
  }

  // Helper Methods
  private extractTokenFromHeader(authorizationHeader: string): string {
    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid authorization header format');
    }
    return authorizationHeader.split(' ')[1];
  }

  private async validateSupabaseToken(token: string) {
    try {
      const { data, error } = await this.supabaseService.auth.getUser(token);

      if (error || !data.user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      return data.user;
    } catch (error) {
      throw new UnauthorizedException('Token validation failed');
    }
  }

  private async validateUniqueFields(
    email: string,
    phoneNumber?: string,
    identityNumber?: string
  ) {
    if (phoneNumber) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phoneNumber },
      });
      if (existingPhone) {
        throw new BadRequestException('Phone number already exists');
      }
    }

    if (identityNumber) {
      const existingIdentity = await this.prisma.user.findUnique({
        where: { identityNumber },
      });
      if (existingIdentity) {
        throw new BadRequestException('Identity number already exists');
      }
    }
  }

  private extractUserData(supabaseUser: any, request?: RegisterUserRequestDto) {
    // Prefer request body data, fallback to Supabase metadata
    return {
      email: supabaseUser.email,
      full_name:
        request?.full_name || supabaseUser.user_metadata?.full_name || '',
      phone_number:
        request?.phone_number || supabaseUser.user_metadata?.phone_number,
      identity_number:
        request?.identity_number || supabaseUser.user_metadata?.identity_number,
      user_type:
        request?.user_type ||
        supabaseUser.user_metadata?.user_type ||
        'individual',
      tax_id: request?.tax_id || supabaseUser.user_metadata?.tax_id,
    };
  }

  private async validateAdminPermissions(authorizationHeader: string) {
    const token = this.extractTokenFromHeader(authorizationHeader);
    const supabaseUser = await this.validateSupabaseToken(token);

    const adminUser = await this.prisma.user.findUnique({
      where: { id: supabaseUser.id },
    });

    if (!adminUser) {
      throw new NotFoundException('Admin user not found');
    }

    if (!['admin', 'super_admin'].includes(adminUser.role)) {
      throw new ForbiddenException(
        'Insufficient permissions. Admin role required.'
      );
    }

    return adminUser;
  }

  private validatePromotionRules(adminRole: string, targetRole: string) {
    // Super admin can promote to any role
    if (adminRole === 'super_admin') {
      return;
    }

    // Regular admin cannot create other admins or super admins
    if (
      adminRole === 'admin' &&
      ['admin', 'super_admin'].includes(targetRole)
    ) {
      throw new ForbiddenException('Cannot promote to admin roles');
    }
  }
}
