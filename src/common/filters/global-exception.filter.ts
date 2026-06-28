import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from './api-error-response.interface';

/**
 * Catches every exception that isn't handled by a more specific filter
 * (see PrismaExceptionFilter for database errors) and normalizes the
 * response into a consistent ApiErrorResponse shape.
 *
 * Registered globally in main.ts via app.useGlobalFilters().
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, error, message } = this.resolveException(exception);

    const errorResponse: ApiErrorResponse = {
      success: false,
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: (request.headers['x-request-id'] as string) ?? undefined,
    };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method} ${request.url}] ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${request.method} ${request.url}] ${statusCode} - ${JSON.stringify(message)}`,
      );
    }

    response.status(statusCode).json(errorResponse);
  }

  private resolveException(exception: unknown): {
    statusCode: number;
    error: string;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return {
          statusCode: status,
          error: HttpStatus[status] ?? 'Error',
          message: exceptionResponse,
        };
      }

      const responseObj = exceptionResponse as Record<string, unknown>;
      return {
        statusCode: status,
        error: (responseObj.error as string) ?? HttpStatus[status] ?? 'Error',
        message: (responseObj.message as string | string[]) ?? exception.message,
      };
    }

    // Unknown/unexpected error - never leak internals to the client.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
    };
  }
}
