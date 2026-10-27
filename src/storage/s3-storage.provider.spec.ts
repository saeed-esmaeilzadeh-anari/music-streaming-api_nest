import { ConfigService } from '@nestjs/config';
import { S3StorageProvider } from './s3-storage.provider';

describe('S3StorageProvider', () => {
  it('omits default CRC32 parameters from Supabase-compatible presigned PUT URLs', async () => {
    const values: Record<string, string> = {
      AWS_REGION: 'ap-northeast-1',
      AWS_S3_ENDPOINT: 'https://example.storage.supabase.co/storage/v1/s3',
      AWS_S3_BUCKET: 'music-media',
      AWS_ACCESS_KEY_ID: 'test-access-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret-key',
    };

    const config = {
      get: (key: string) => values[key],
      getOrThrow: (key: string) => {
        const value = values[key];
        if (!value) throw new Error(`Missing test config: ${key}`);
        return value;
      },
    } as unknown as ConfigService;

    const provider = new S3StorageProvider(config);
    const url = await provider.presignPutUrl('tracks/audio/test.mp3', 900);

    expect(url).not.toContain('x-amz-checksum-crc32');
    expect(url).not.toContain('x-amz-sdk-checksum-algorithm');
    expect(url).toContain('/storage/v1/s3/music-media/tracks/audio/test.mp3');
  });
});
