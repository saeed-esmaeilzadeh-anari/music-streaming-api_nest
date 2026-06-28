import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ApiErrorResponse } from './api-error-response.interface';

/**
 * Translates known Prisma error codes into meaningful HTTP responses instead
 * of leaking raw database error messages (which can expose schema details).
 * Registered before GlobalExceptionFilter so it takes precedence for
 * Prisma.PrismaClientKnownRequestError instances.
 *
 * Reference: https://www.prisma.io/docs/reference/api-reference/error-reference
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message } = this.mapPrismaError(exception);

    this.logger.warn(
      `[${request.method} ${request.url}] Prisma error: ${exception.constructor.name} - ${message}`,
    );

    const errorResponse: ApiErrorResponse = {
      success: false,
      statusCode,
      error: HttpStatus[statusCode] ?? 'Error',
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(errorResponse);
  }

  private mapPrismaError(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
  ): { statusCode: number; message: string } {
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid data provided to the database layer.',
      };
    }

    switch (exception.code) {
      case 'P2002': {
        const target = (exception.meta?.target as string[])?.join(', ') ?? 'field';
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `A record with this ${target} already exists.`,
        };
      }
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'The referenced related record does not exist.',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'The requested record could not be found.',
        };
      case 'P2014':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'The change would violate a required relation.',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'A database error occurred.',
        };
    }
  }
}
