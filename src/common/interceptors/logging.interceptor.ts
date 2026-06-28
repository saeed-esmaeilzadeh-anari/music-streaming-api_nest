import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logs method, URL, status code, and duration for every request.
 * Complements pino's HTTP transport log with a concise app-level line -
 * useful when pino's structured logs are piped elsewhere and you still
 * want a quick human-readable trail in the Nest logger.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, originalUrl } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(
            `${method} ${originalUrl} ${response.statusCode} - ${duration}ms`,
          );
        },
        error: (err) => {
          const duration = Date.now() - start;
          this.logger.error(
            `${method} ${originalUrl} ${response.statusCode ?? 500} - ${duration}ms - ${err.message}`,
          );
        },
      }),
    );
  }
}
