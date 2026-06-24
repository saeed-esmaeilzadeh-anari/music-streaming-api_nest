import appConfig from './app.config';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
import redisConfig from './redis.config';
import awsConfig from './aws.config';
import stripeConfig from './stripe.config';
import throttleConfig from './throttle.config';

export const configurations = [
  appConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  awsConfig,
  stripeConfig,
  throttleConfig,
];

export * from './env.validation';
