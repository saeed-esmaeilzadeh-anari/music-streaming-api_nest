import { Module }        from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { STORAGE_PROVIDER }      from './storage.interface';
import { S3StorageProvider }     from './s3-storage.provider';
import { LocalStorageProvider }  from './local-storage.provider';

/**
 * StorageModule
 *
 * Registers whichever IStorageProvider implementation is selected by the
 * STORAGE_PROVIDER environment variable and exports it under the
 * STORAGE_PROVIDER injection token.
 *
 * Usage in any feature module:
 *
 *   @Module({ imports: [StorageModule], ... })
 *   export class UploadModule {}
 *
 *   @Injectable()
 *   export class UploadService {
 *     constructor(
 *       @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
 *     ) {}
 *   }
 *
 * Environment:
 *   STORAGE_PROVIDER=local   → LocalStorageProvider  (dev default)
 *   STORAGE_PROVIDER=s3      → S3StorageProvider     (production)
 *   (unset)                  → LocalStorageProvider  (safe fallback)
 */
@Module({
  imports: [ConfigModule],
  providers: [
    S3StorageProvider,
    LocalStorageProvider,
    {
      provide:    STORAGE_PROVIDER,
      inject:     [ConfigService, S3StorageProvider, LocalStorageProvider],
      useFactory: (
        config:    ConfigService,
        s3:        S3StorageProvider,
        local:     LocalStorageProvider,
      ) => {
        const provider = config.get<string>('STORAGE_PROVIDER') ?? 'local';

        if (provider === 's3') {
          return s3;
        }

        if (provider === 'local') {
          return local;
        }

        throw new Error(
          `Unknown STORAGE_PROVIDER="${provider}". ` +
          `Valid values are "local" and "s3".`,
        );
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}