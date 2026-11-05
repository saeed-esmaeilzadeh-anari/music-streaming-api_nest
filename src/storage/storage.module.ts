import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { IStorageProvider, STORAGE_PROVIDER } from './storage.interface';
import { S3StorageProvider } from './s3-storage.provider';
import { LocalStorageProvider } from './local-storage.provider';

/**
 * Construct only the selected provider. Registering both concrete providers
 * as Nest providers eagerly constructs both at application startup, which
 * makes local development incorrectly require AWS credentials.
 */
export function createStorageProvider(config: ConfigService): IStorageProvider {
  const provider = config.get<string>('STORAGE_PROVIDER') ?? 'local';

  switch (provider) {
    case 'local':
      return new LocalStorageProvider(config);
    case 's3':
      return new S3StorageProvider(config);
    default:
      throw new Error(
        `Unknown STORAGE_PROVIDER="${provider}". Valid values are "local" and "s3".`,
      );
  }
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: createStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
