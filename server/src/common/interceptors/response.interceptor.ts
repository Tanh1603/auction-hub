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
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const path = request.url;

    return next.handle().pipe(
      map((data) => {
        // If data is already in the expected response format, return it as-is
        if (data && typeof data === 'object' && 'success' in data && 'timestamp' in data) {
          return {
            ...data,
            path: data.path || path,
          };
        }  

        // If data has a 'data' property, use that as the response data
        // Otherwise, use the entire data object as the response data
        const responseData = data && typeof data === 'object' && 'data' in data 
          ? data.data 
          : data;

        return {
          success: true,
          message: (data && typeof data === 'object' && 'message' in data) ? data.message : 'Request successful',
          data: responseData,
          meta: (data && typeof data === 'object' && 'meta' in data) ? data.meta : {},
          timestamp: new Date().toISOString(),
          path,
        };
      }),
    );
  }
}

