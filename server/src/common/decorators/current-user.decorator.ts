import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export interface CurrentUserData {
  id: string;
  avatar: string;
  email: string;
  full_name: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.user) {
        throw new UnauthorizedException(
          'User not found in request. Make sure AuthGuard is applied.',
        );
      }
    const user = request['user'];

    return {
      id: user.sub,
      avatar: user.avatar_url || '',
      email: user.email,
      full_name: user.full_name || '',
    };
  },
);

