import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../guards/auth.guard';

/**
 * Decorator to mark a route as public (bypasses authentication)
 *
 * Usage:
 * @Public()
 * @Get('health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
