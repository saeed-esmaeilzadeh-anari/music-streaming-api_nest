import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

type StorageProvider = 'local' | 's3';

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsNumber()
  @Min(1)
  PORT = 3001;

  @IsString()
  API_PREFIX = 'api/v1';

  @IsString()
  @IsNotEmpty()
  APP_URL = 'http://localhost:3001';

  @IsString()
  CORS_ORIGINS = 'http://localhost:3000';

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  DATABASE_POOL_SIZE?: number;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN = '15m';

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_REFRESH_EXPIRES_IN = '7d';

  @IsNumber()
  @Min(4)
  BCRYPT_SALT_ROUNDS = 12;

  @IsString()
  REDIS_HOST = 'localhost';

  @IsNumber()
  @Min(1)
  REDIS_PORT = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsNumber()
  @Min(0)
  REDIS_DB = 0;

  @IsNumber()
  @Min(1)
  REDIS_TTL_SECONDS = 300;

  @IsString()
  @IsIn(['local', 's3'])
  STORAGE_PROVIDER: StorageProvider = 'local';

  @IsOptional()
  @IsString()
  LOCAL_STORAGE_DIR?: string;

  @IsOptional()
  @IsString()
  LOCAL_STORAGE_URL?: string;

  @ValidateIf((env: EnvironmentVariables) => env.STORAGE_PROVIDER === 's3')
  @IsString()
  @IsNotEmpty()
  AWS_REGION?: string;

  @ValidateIf((env: EnvironmentVariables) => env.STORAGE_PROVIDER === 's3')
  @IsString()
  @IsNotEmpty()
  AWS_ACCESS_KEY_ID?: string;

  @ValidateIf((env: EnvironmentVariables) => env.STORAGE_PROVIDER === 's3')
  @IsString()
  @IsNotEmpty()
  AWS_SECRET_ACCESS_KEY?: string;

  @ValidateIf((env: EnvironmentVariables) => env.STORAGE_PROVIDER === 's3')
  @IsString()
  @IsNotEmpty()
  AWS_S3_BUCKET?: string;

  @IsNumber()
  @Min(1)
  AWS_S3_PRESIGNED_URL_EXPIRY_SECONDS = 900;

  @IsOptional()
  @IsString()
  AWS_S3_PUBLIC_BASE_URL?: string;

  @IsOptional()
  @IsString()
  AWS_S3_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  STRIPE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET?: string;

  @IsOptional()
  @IsString()
  STRIPE_PRICE_ID_PREMIUM_MONTHLY?: string;

  @IsOptional()
  @IsString()
  STRIPE_PRICE_ID_PREMIUM_YEARLY?: string;

  @IsNumber()
  @Min(1)
  THROTTLE_TTL_SECONDS = 60;

  @IsNumber()
  @Min(1)
  THROTTLE_LIMIT = 100;

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;

  @IsOptional()
  @IsString()
  REDIS_TLS?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const normalizedConfig = { ...config } as Record<string, unknown>;
  const numericKeys = [
    'PORT',
    'DATABASE_POOL_SIZE',
    'BCRYPT_SALT_ROUNDS',
    'REDIS_PORT',
    'REDIS_DB',
    'REDIS_TTL_SECONDS',
    'AWS_S3_PRESIGNED_URL_EXPIRY_SECONDS',
    'THROTTLE_TTL_SECONDS',
    'THROTTLE_LIMIT',
  ];

  for (const key of numericKeys) {
    const value = normalizedConfig[key];
    if (typeof value === 'string' && value.trim() !== '') {
      const parsedValue = Number(value);
      if (Number.isFinite(parsedValue)) normalizedConfig[key] = parsedValue;
    }
  }

  const validatedConfig = plainToInstance(EnvironmentVariables, normalizedConfig, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  if (validatedConfig.NODE_ENV === NodeEnv.Production) {
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      const secret = validatedConfig[key];
      if (typeof secret !== 'string' || secret.length < 32) {
        throw new Error(
          `Environment validation failed: ${key} must contain at least 32 characters in production`,
        );
      }
    }
    if (validatedConfig.JWT_ACCESS_SECRET === validatedConfig.JWT_REFRESH_SECRET) {
      throw new Error(
        'Environment validation failed: JWT access and refresh secrets must be different in production',
      );
    }
  }

  return validatedConfig;
}
