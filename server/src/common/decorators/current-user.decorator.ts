import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export interface CurrentUserData {
  id: string;
  avatar: string;
  email: string;
  full_name: string;
  role?: string;
}

/**
 * Decorator to extract current user data from request
 * User data is populated by the global AuthGuard
 *
 * The AuthGuard handles different authentication modes:
 * - JWT mode: Validates JWT token
 * - Test mode: Uses x-test-user-id header or TEST_USER_ID env var
 * - Disabled mode: Uses mock user data
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();

    if (!request.user) {
      throw new UnauthorizedException(
        'User not found in request. Make sure the global AuthGuard is configured properly.'
      );
    }

    const user = request['user'];

    return {
      id: user.sub,
      avatar: user.avatar_url || '',
      email: user.email,
      full_name: user.full_name || '',
      role: user.role,
    };
  }
);

