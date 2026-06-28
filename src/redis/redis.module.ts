import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisCacheService } from './redis-cache.service';

/**
 * Global Redis module exposing two things:
 *  1. Nest's CacheModule (cache-manager) wired to Redis - used via CACHE_MANAGER
 *     for the caching interceptor and general get/set/ttl operations.
 *  2. A raw ioredis client (REDIS_CLIENT) for use cases that need direct
 *     Redis commands (rate limiting, pub/sub, sorted sets for trending tracks, etc).
 */
@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: config.get<string>('redis.host') ?? 'localhost',
            port: config.get<number>('redis.port') ?? 6379,
          },
          password: config.get<string>('redis.password') || undefined,
          database: config.get<number>('redis.db') ?? 0,
          ttl: (config.get<number>('redis.ttlSeconds') ?? 300) * 1000,
        }),
      }),
    }),
  ],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new Redis({
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
          db: config.get<number>('redis.db'),
          maxRetriesPerRequest: 3,
        });
      },
    },
    RedisCacheService,
  ],
  exports: [REDIS_CLIENT, RedisCacheService],
})
export class RedisModule {}
