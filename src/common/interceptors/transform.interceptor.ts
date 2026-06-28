import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from './api-success-response.interface';

/**
 * Wraps every successful controller response in a consistent envelope:
 * { success, statusCode, data, timestamp }.
 * Errors are handled separately by GlobalExceptionFilter / PrismaExceptionFilter,
 * so their shape is intentionally similar but distinct (success: false).
 *
 * Registered globally in main.ts via app.useGlobalInterceptors().
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        statusCode: response.statusCode,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
