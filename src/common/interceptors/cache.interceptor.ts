import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisCacheService } from '../../redis/redis-cache.service';
import {
  CACHE_KEY_PREFIX_KEY,
  CACHE_TTL_KEY,
} from '../decorators/cache-ttl.decorator';

/**
 * Opt-in response cache for read-heavy GET endpoints (genres list, track
 * detail, search results, etc). Only activates when a handler is annotated
 * with @CacheTTL(seconds). Cache key is built from the route path + query
 * string so different filter/pagination combinations don't collide.
 *
 * Registered globally in main.ts, but it's a no-op unless @CacheTTL is present,
 * so it's safe to apply to every route.
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: RedisCacheService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const ttl = this.reflector.get<number>(CACHE_TTL_KEY, context.getHandler());
    if (!ttl) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    if (request.method !== 'GET') {
      return next.handle();
    }

    const customPrefix = this.reflector.get<string>(
      CACHE_KEY_PREFIX_KEY,
      context.getHandler(),
    );
    const cacheKey = this.cacheService.buildKey(
      customPrefix ?? request.route?.path ?? request.originalUrl,
      request.originalUrl,
    );

    const cached = await this.cacheService.get(cacheKey);
    if (cached !== undefined) {
      return of(cached);
    }

    return next.handle().pipe(
      tap((response) => {
        void this.cacheService.set(cacheKey, response, ttl);
      }),
    );
  }
}
