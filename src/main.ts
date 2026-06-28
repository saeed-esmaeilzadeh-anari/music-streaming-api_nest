import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  app.useLogger(app.get(Logger));

  // --- Security middleware ---
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // --- CORS ---
  app.enableCors({
    origin: configService.get<string[]>('app.corsOrigins'),
    credentials: true,
  });

  // --- Global prefix ---
  // Versioning is encoded directly in API_PREFIX (e.g. "api/v1") rather than
  // via app.enableVersioning(), since this project ships a single API
  // version at a time. Bumping to v2 means changing API_PREFIX and routing
  // old/new controllers side by side during a migration window if needed.
  const apiPrefix = configService.get<string>('app.apiPrefix')!;
  app.setGlobalPrefix(apiPrefix);

  // --- Validation ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // --- Swagger ---
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Music Streaming Platform API')
    .setDescription(
      'Production-ready backend for a Spotify-like music streaming platform. ' +
        'Covers auth, catalog management, playlists, social features, uploads, ' +
        'subscriptions, and payments.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addTag('Auth')
    .addTag('Users')
    .addTag('Artists')
    .addTag('Albums')
    .addTag('Tracks')
    .addTag('Genres')
    .addTag('Playlists')
    .addTag('Favorites')
    .addTag('Listening History')
    .addTag('Search')
    .addTag('Upload')
    .addTag('Comments')
    .addTag('Likes')
    .addTag('Notifications')
    .addTag('Subscription')
    .addTag('Payments')
    .addTag('Admin')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: { persistAuthorization: true },
  });

  // --- Graceful shutdown ---
  app.enableShutdownHooks();

  const port = configService.get<number>('app.port')!;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
  // eslint-disable-next-line no-console
  console.log(`📚 Swagger docs available at: http://localhost:${port}/docs`);
}

bootstrap();
