import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  avatar_url?: string;
  full_name?: string;
  aud?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser extends JwtPayload {
  role: string; // This will be populated from local DB
}

export const IS_PUBLIC_KEY = 'isPublic';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // For public routes, still try to extract user data if token is present
      // This enables tiered access control based on authentication status
      await this.tryExtractUserFromToken(context);
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authMode = this.configService.get<string>('AUTH_MODE', 'jwt');

    this.logger.debug(`Auth mode: ${authMode}`);

    // MODE 1: DISABLED - No authentication required
    if (authMode === 'disabled') {
      this.logger.warn(
        '⚠️  AUTH DISABLED - All requests allowed without authentication'
      );
      // Set a mock user for disabled mode
      const testUserId = this.configService.get<string>('TEST_USER_ID');
      request['user'] = {
        sub: testUserId || 'test-user-id',
        email: 'test@example.com',
        full_name: 'Test User',
        avatar_url: '',
        role: this.configService.get<string>('TEST_USER_ROLE', 'user'),
      };
      return true;
    }

    // MODE 2: TEST - Allow x-test-user-id header
    if (authMode === 'test') {
      const testUserIdFromHeader = request.headers['x-test-user-id'] as string;
      const testUserIdFromEnv = this.configService.get<string>('TEST_USER_ID');
      const testUserId = testUserIdFromHeader || testUserIdFromEnv;

      if (testUserId) {
        this.logger.warn(`⚠️  TEST MODE - Using test user ID: ${testUserId}`);

        // Try to get real user data from database in test mode
        const localUser = await this.prisma.user.findUnique({
          where: { id: testUserId },
          select: { role: true, email: true, fullName: true },
        });

        request['user'] = {
          sub: testUserId,
          email: localUser?.email || 'test@example.com',
          full_name: localUser?.fullName || 'Test User',
          avatar_url: '',
          role:
            localUser?.role ||
            this.configService.get<string>('TEST_USER_ROLE', 'bidder'),
        };
        return true;
      }

      // No test user ID provided, fall through to JWT verification
      this.logger.warn(
        '⚠️  TEST MODE - No x-test-user-id header or TEST_USER_ID env var, attempting JWT verification'
      );
    }

    // MODE 3: JWT - Full JWT authentication (default)
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException(
        'Authorization header is missing. Use Bearer token or enable test mode with x-test-user-id header.'
      );
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('Invalid authorization header format');
    }
    const token = parts[1];

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Use Supabase JWT secret to verify Supabase-issued tokens
      const jwtSecret =
        this.configService.get<string>('SUPABASE_JWT_SECRET') ||
        this.configService.get<string>('JWT_SECRET');

      if (!jwtSecret) {
        this.logger.error('JWT secret is not configured');
        throw new UnauthorizedException('JWT secret is not configured');
      }

      // Debug log for test troubleshooting
      console.log(
        `[AuthGuard] JWT secret starts with: ${jwtSecret.substring(0, 10)}...`
      );

      const payload = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
      }) as JwtPayload;

      // 🔥 KEY FIX: Query local database for user role
      const localUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { role: true, email: true, fullName: true },
      });

      console.log(
        `[AuthGuard] Looking for user ${payload.sub}: ${
          localUser ? 'FOUND' : 'NOT FOUND'
        }`
      );

      if (!localUser) {
        throw new UnauthorizedException(
          'User not found in system. Please complete registration.'
        );
      }

      // Combine JWT payload with local database role
      const authenticatedUser: AuthenticatedUser = {
        ...payload,
        role: localUser.role, // ✅ Role from local database
        email: localUser.email,
        full_name: localUser.fullName,
      };

      request['user'] = authenticatedUser;
      this.logger.debug(
        `JWT verified for user: ${payload.sub}, role: ${localUser.role}`
      );
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        this.logger.error(`JWT verification failed: ${error.message}`);
        throw new UnauthorizedException(`Invalid token: ${error.message}`);
      }
      throw new UnauthorizedException('Authentication failed');
    }

    return true;
  }

  /**
   * Try to extract user data from token for public endpoints.
   * Does not throw errors - silently fails if no valid token present.
   * This enables tiered access control on public endpoints.
   */
  private async tryExtractUserFromToken(
    context: ExecutionContext
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    const authMode = this.configService.get<string>('AUTH_MODE', 'jwt');

    // Handle test mode for public routes
    if (authMode === 'test') {
      const testUserIdFromHeader = request.headers['x-test-user-id'] as string;
      const testUserIdFromEnv = this.configService.get<string>('TEST_USER_ID');
      const testUserId = testUserIdFromHeader || testUserIdFromEnv;

      if (testUserId) {
        const localUser = await this.prisma.user.findUnique({
          where: { id: testUserId },
          select: { role: true, email: true, fullName: true },
        });

        if (localUser) {
          request['user'] = {
            sub: testUserId,
            email: localUser.email || 'test@example.com',
            full_name: localUser.fullName || 'Test User',
            avatar_url: '',
            role: localUser.role,
          };
        }
        return;
      }
    }

    // Try to extract from JWT token
    const authHeader = request.headers.authorization;
    if (!authHeader) return;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return;

    const token = parts[1];
    if (!token) return;

    try {
      const jwtSecret =
        this.configService.get<string>('SUPABASE_JWT_SECRET') ||
        this.configService.get<string>('JWT_SECRET');

      if (!jwtSecret) return;

      const payload = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
      }) as JwtPayload;

      const localUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { role: true, email: true, fullName: true },
      });

      if (localUser) {
        request['user'] = {
          ...payload,
          role: localUser.role,
          email: localUser.email,
          full_name: localUser.fullName,
        };
      }
    } catch {
      // Silently fail - user will be null for public endpoints
      this.logger.debug('Failed to extract user from token for public route');
    }
  }
}
