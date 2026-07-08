import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  url: process.env.APP_URL ?? 'http://localhost:3001',
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
  isProduction: process.env.NODE_ENV === 'production',
}));
