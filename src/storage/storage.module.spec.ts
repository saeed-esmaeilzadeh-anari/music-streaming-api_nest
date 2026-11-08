import { ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { createStorageProvider } from './storage.module';

describe('createStorageProvider', () => {
  function config(values: Record<string, string>) {
    return {
      get: (key: string) => values[key],
      getOrThrow: (key: string) => {
        const value = values[key];
        if (!value) throw new Error(`Missing test config: ${key}`);
        return value;
      },
    } as unknown as ConfigService;
  }

  it('creates local storage without requiring any AWS credentials', () => {
    const provider = createStorageProvider(
      config({
        STORAGE_PROVIDER: 'local',
        LOCAL_STORAGE_DIR: '/tmp/music-storage-test',
        LOCAL_STORAGE_URL: 'http://localhost:3001/uploads',
      }),
    );

    expect(provider).toBeInstanceOf(LocalStorageProvider);
  });

  it('creates S3 storage only when S3 is explicitly selected and configured', () => {
    const provider = createStorageProvider(
      config({
        STORAGE_PROVIDER: 's3',
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test-access-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret-key',
        AWS_S3_BUCKET: 'music-test-bucket',
      }),
    );

    expect(provider).toBeInstanceOf(S3StorageProvider);
  });

  it('rejects unknown storage providers', () => {
    expect(() => createStorageProvider(config({ STORAGE_PROVIDER: 'unknown' }))).toThrow(
      /Unknown STORAGE_PROVIDER/,
    );
  });
});
