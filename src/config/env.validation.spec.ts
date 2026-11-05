import 'reflect-metadata';
import { validateEnv } from './env.validation';

const localEnvironment = {
  NODE_ENV: 'development',
  APP_URL: 'http://localhost:3001',
  CORS_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/music_streaming',
  JWT_ACCESS_SECRET: 'local-access-secret',
  JWT_REFRESH_SECRET: 'local-refresh-secret',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  STORAGE_PROVIDER: 'local',
};

describe('validateEnv', () => {
  it('allows local storage without AWS credentials', () => {
    const config = validateEnv(localEnvironment);

    expect(config.STORAGE_PROVIDER).toBe('local');
    expect(config.REDIS_PORT).toBe(6379);
  });

  it('requires the complete S3 configuration when S3 storage is selected', () => {
    expect(() =>
      validateEnv({ ...localEnvironment, STORAGE_PROVIDER: 's3' }),
    ).toThrow(/AWS_REGION/);
  });

  it('accepts S3 storage when all required credentials are configured', () => {
    const config = validateEnv({
      ...localEnvironment,
      STORAGE_PROVIDER: 's3',
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test-access-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret-key',
      AWS_S3_BUCKET: 'music-test-bucket',
    });

    expect(config.STORAGE_PROVIDER).toBe('s3');
  });

  it('requires JWT secrets in development too', () => {
    const { JWT_ACCESS_SECRET: _access, ...missingAccess } = localEnvironment;
    expect(() => validateEnv(missingAccess)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('requires long independent JWT secrets in production', () => {
    expect(() =>
      validateEnv({
        ...localEnvironment,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'too-short',
        JWT_REFRESH_SECRET: 'also-too-short',
      }),
    ).toThrow(/JWT_ACCESS_SECRET must contain at least 32 characters/);
  });
});
