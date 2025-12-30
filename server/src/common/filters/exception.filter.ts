import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: Date;
    path: string;
    statusCode: number;
    requestId?: string;
  };
}

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let details: any = null;

    // Handle different exception types
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message =
          typeof resp.message === 'string'
            ? resp.message
            : Array.isArray(resp.message)
            ? 'Validation failed'
            : exception.message;

        if (Array.isArray(resp.message)) {
          details = resp.message;
        }
      } else {
        message = exception.message;
      }

      // Map status codes to error codes
      errorCode = this.getErrorCode(status);
    } else if (exception instanceof Error) {
      message = exception.message;
      errorCode = 'UNEXPECTED_ERROR';

      // Log unexpected errors with stack trace
      this.logger.error(
        `Unexpected error: ${message}`,
        exception.stack,
        'AllExceptionFilter'
      );
    }

    // Build standardized error response
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        details,
        timestamp: new Date(),
        path: request.url,
        statusCode: status,
        requestId: request.headers['x-request-id'] as string,
      },
    };

    // Log all errors (with appropriate level)
    if (status >= 500) {
      this.logger.error(
        `${status} Error: ${message} - ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : undefined
      );
    } else {
      this.logger.warn(
        `${status} Error: ${message} - ${request.method} ${request.url}`
      );
    }

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };

    return codeMap[status] || `HTTP_${status}`;
  }
}
