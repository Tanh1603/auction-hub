import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

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

export const IS_PUBLIC_KEY = 'isPublic';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
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
        this.logger.warn(
          `⚠️  TEST MODE - Using test user ID: ${testUserId}`
        );
        request['user'] = {
          sub: testUserId,
          email: 'test@example.com',
          full_name: 'Test User',
          avatar_url: '',
          role: this.configService.get<string>('TEST_USER_ROLE', 'user'),
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

      const payload = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
      }) as JwtPayload;

      request['user'] = payload;
      this.logger.debug(`JWT verified for user: ${payload.sub}`);
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
}
