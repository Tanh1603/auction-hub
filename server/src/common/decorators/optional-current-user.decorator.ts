import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUserData } from './current-user.decorator';

/**
 * Decorator to extract current user data from request WITHOUT throwing if not authenticated.
 * Returns null if user is not authenticated (for public endpoints with optional auth).
 *
 * Use this decorator when:
 * - The endpoint is marked as @Public()
 * - You want to provide different responses based on authentication status
 *
 * Usage:
 * @Public()
 * @Get('results/:auctionId')
 * async getResults(@OptionalCurrentUser() user: CurrentUserData | null) {
 *   if (user) {
 *     // Authenticated user - return full data
 *   } else {
 *     // Public user - return limited data
 *   }
 * }
 */
export const OptionalCurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserData | null => {
    const request = ctx.switchToHttp().getRequest();

    if (!request.user) {
      return null; // Return null instead of throwing
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
