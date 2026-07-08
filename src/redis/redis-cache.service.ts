import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { REDIS_CLIENT } from './redis.constants';
import type { Cache } from 'cache-manager';
import { Redis } from 'ioredis';

/**
 * Thin convenience wrapper around cache-manager so feature services
 * don't depend directly on the CACHE_MANAGER token / cache-manager API shape.
 * Swapping the underlying cache implementation later only touches this file.
 */
@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      // return await this.cache.get<T>(key);
      const value = await this.cache.get<T>(key);
      return value ?? undefined;
    } catch (error) {
      this.logger.warn(`Cache GET failed for key "${key}": ${error}`);
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttlSeconds ? ttlSeconds * 1000 : undefined);
    } catch (error) {
      this.logger.warn(`Cache SET failed for key "${key}": ${error}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cache.del(key);
    } catch (error) {
      this.logger.warn(`Cache DEL failed for key "${key}": ${error}`);
    }
  }

  /**
   * Deletes all keys matching a prefix - useful for invalidating
   * list/search caches when an underlying entity changes.
   * NOTE: requires the underlying store to support `keys()` (redis does).
   */
  // async delByPrefix(prefix: string): Promise<void> {
  //   try {
  //     const store = this.cache.store as unknown as {
  //       keys?: (pattern: string) => Promise<string[]>;
  //     };
  //     if (!store.keys) return;
  //     const keys = await store.keys(`${prefix}*`);
  //     await Promise.all(keys.map((key) => this.cache.del(key)));
  //   } catch (error) {
  //     this.logger.warn(`Cache delByPrefix failed for prefix "${prefix}": ${error}`);
  //   }
  // }

  async delByPrefix(prefix: string): Promise<void> {
    try {
      const redis = this.redisClient; // یا REDIS_CLIENT

      const keys = await redis.keys(`${prefix}*`);

      if (!keys.length) return;

      await redis.del(keys);
    } catch (error) {
      this.logger.warn(`Cache delByPrefix failed for prefix "${prefix}": ${error}`);
    }
  }

  buildKey(...parts: Array<string | number>): string {
    return parts.join(':');
  }
}
