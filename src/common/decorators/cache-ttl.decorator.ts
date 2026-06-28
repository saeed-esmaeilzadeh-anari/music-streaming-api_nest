import { SetMetadata } from '@nestjs/common';

export const CACHE_TTL_KEY = 'cache_ttl_seconds';
export const CACHE_KEY_PREFIX_KEY = 'cache_key_prefix';

/**
 * Marks a GET route as cacheable for `seconds`, optionally under a custom
 * key prefix (defaults to the route path). Used with CacheInterceptor.
 *
 * @example
 * @CacheTTL(60, 'genres:list')
 * @Get()
 * findAll() {}
 */
export const CacheTTL = (seconds: number, keyPrefix?: string) => {
  return (target: object, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata(CACHE_TTL_KEY, seconds)(target, key as string, descriptor as PropertyDescriptor);
    if (keyPrefix) {
      SetMetadata(CACHE_KEY_PREFIX_KEY, keyPrefix)(
        target,
        key as string,
        descriptor as PropertyDescriptor,
      );
    }
  };
};
