
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    
    let message = exception instanceof HttpException ? exception.message : `Internal server error`;
    let errors: Record<string, unknown>[] = [];

    // Handle validation errors
    if (exception instanceof BadRequestException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const response = exceptionResponse as Record<string, unknown>;
        if (Array.isArray(response.message)) {
          errors = response.message;
          message = 'Validation failed';
        } else if (typeof response.message === 'string') {
          message = response.message;
        }
      }
    }

    // Log the error for debugging
    console.error('Exception caught:', exception);

    response
      .status(status)
      .json({
        success: false,
        message: message,
        errors: errors,
        timestamp: new Date().toISOString(),
        path: request.url,
        statusCode: status,
      });
  }
}
