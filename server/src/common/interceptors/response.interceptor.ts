import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  message: string;
  data?: T;
  meta: unknown;
  timestamp: string;
  path: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const path = request.url;

    return next.handle().pipe(
      map((data) => {
        // Skip wrapping for auth responses that already have the expected structure
        if (path.includes('/auth/login') || path.includes('/auth/register')) {
          return data;
        }

        // Skip wrapping if response already has the standard wrapper structure
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'timestamp' in data
        ) {
          return {
            ...data,
            path: data.path || path,
          };
        }

        return {
          success: true,
          message: data?.message || 'Request successful',
          data: data?.data || data || '',
          meta: data?.meta || {},
          timestamp: new Date().toISOString(),
          path,
        };
      })
    );
  }
}
