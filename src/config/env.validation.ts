import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsNumber()
  PORT = 3000;

  @IsString()
  API_PREFIX = 'api/v1';

  @IsString()
  APP_URL: string;

  @IsString()
  CORS_ORIGINS: string;

  @IsString()
  DATABASE_URL: string;

  @IsOptional()
  @IsNumber()
  DATABASE_POOL_SIZE?: number;

  @IsString()
  JWT_ACCESS_SECRET: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_REFRESH_EXPIRES_IN: string;

  @IsNumber()
  BCRYPT_SALT_ROUNDS = 12;

  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  REDIS_PORT: number;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsNumber()
  @Min(0)
  REDIS_DB = 0;

  @IsNumber()
  REDIS_TTL_SECONDS = 300;

  @IsString()
  AWS_REGION: string;

  @IsString()
  AWS_ACCESS_KEY_ID: string;

  @IsString()
  AWS_SECRET_ACCESS_KEY: string;

  @IsString()
  AWS_S3_BUCKET: string;

  @IsNumber()
  AWS_S3_PRESIGNED_URL_EXPIRY_SECONDS = 900;

  @IsOptional()
  @IsString()
  AWS_S3_PUBLIC_BASE_URL?: string;

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
  THROTTLE_TTL_SECONDS = 60;

  @IsNumber()
  THROTTLE_LIMIT = 100;

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validatedConfig;
}
