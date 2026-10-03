/**
 * main.ts bootstrap additions required for the storage abstraction.
 *
 * Merge these into your existing src/main.ts.
 * Lines marked NEW are the additions; existing lines are shown for context.
 */

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import * as path from 'path';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const configService = app.get(ConfigService);

  app.useLogger(app.get(Logger));

  // ─────────────────────────────────────────────
  // Security middleware
  // ─────────────────────────────────────────────

  app.use(
    helmet({
      crossOriginResourcePolicy: {
        policy: 'cross-origin',
      },
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  // ─────────────────────────────────────────────
  // CORS
  // ─────────────────────────────────────────────

  app.enableCors({
    origin: configService.get<string[]>('app.corsOrigins'),
    credentials: true,
  });

  // ─────────────────────────────────────────────
  // Global prefix
  // ─────────────────────────────────────────────

  const apiPrefix = configService.get<string>('app.apiPrefix') ?? 'api/v1';

  app.setGlobalPrefix(apiPrefix);

  // ─────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ─────────────────────────────────────────────
  // Local storage
  // ─────────────────────────────────────────────

  if (process.env.STORAGE_PROVIDER === 'local') {
    const uploadsDir = process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), 'uploads');

    app.use(
      '/uploads',
      express.static(uploadsDir, {
        maxAge: 0,
        fallthrough: false,
      }),
    );
  }

  // ─────────────────────────────────────────────
  // Local upload endpoint
  // ─────────────────────────────────────────────

  app.use(
    '/api/v1/uploads/local-put',
    express.raw({
      type: '*/*',
      limit: '110mb',
    }),
  );

  // ─────────────────────────────────────────────
  // Swagger
  // ─────────────────────────────────────────────

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Music Streaming Platform API')
    .setDescription(
      'Production-ready backend for a Spotify-like music streaming platform. ' +
        'Covers auth, catalog management, playlists, social features, uploads, ' +
        'subscriptions, and payments.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
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
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // ─────────────────────────────────────────────
  // Graceful shutdown
  // ─────────────────────────────────────────────

  app.enableShutdownHooks();

  // ─────────────────────────────────────────────
  // Start server
  // ─────────────────────────────────────────────

  const port = configService.get<number>('app.port') ?? 3001;

  await app.listen(port);
}

bootstrap();

//اسکریپت دوم
// import { NestFactory }    from '@nestjs/core';
// import { AppModule }      from './app.module';
// import * as express       from 'express';                              // NEW
// import * as path          from 'path';                                 // NEW

// async function bootstrap() {
//   // ── existing ────────────────────────────────────────────────────────────────
//   const app = await NestFactory.create(AppModule, {
//     rawBody: true,   // NEW — enables req.rawBody for the local-put endpoint
//   });

//   // ── NEW: serve uploaded files statically in development ───────────────────
//   // When STORAGE_PROVIDER=local, files are saved to ./uploads/ and served at
//   // GET /uploads/<key>.  In production (S3) this middleware is never hit because
//   // all file access goes through presigned S3 URLs.
//   if (process.env.STORAGE_PROVIDER === 'local') {
//     const uploadsDir = process.env.LOCAL_STORAGE_DIR
//       ?? path.join(process.cwd(), 'uploads');

//     app.use(
//       '/uploads',
//       express.static(uploadsDir, {
//         maxAge: 0,           // no browser caching in dev
//         fallthrough: false,  // 404 instead of passing to next handler
//       }),
//     );
//   }

//   // ── NEW: raw body for the local-put endpoint ──────────────────────────────
//   // NestJS normally parses JSON; the local-put route receives binary file data.
//   // Express raw() middleware must run before NestJS body-parser for this route.
//   app.use(
//     '/api/v1/uploads/local-put',
//     express.raw({ type: '*/*', limit: '110mb' }),   // 110 MB > our 100 MB audio limit
//   );

//   // ── existing ────────────────────────────────────────────────────────────────
//   app.setGlobalPrefix('api/v1');
//   // ... rest of your existing bootstrap code
//   await app.listen(process.env.PORT ?? 3001);
// }
// bootstrap();

// کد ابتدایی
// import { NestFactory } from '@nestjs/core';
// import { NestExpressApplication } from '@nestjs/platform-express';
// import { ConfigService } from '@nestjs/config';
// import { ValidationPipe } from '@nestjs/common';
// import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// import { Logger } from 'nestjs-pino';
// import helmet from 'helmet';
// import compression from 'compression';
// import cookieParser from 'cookie-parser';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create<NestExpressApplication>(AppModule, {
//     bufferLogs: true,
//     rawBody: true,
//   });

//   const configService = app.get(ConfigService);
//   app.useLogger(app.get(Logger));

//   // --- Security middleware ---
//   app.use(helmet());
//   app.use(compression());
//   app.use(cookieParser());

//   // --- CORS ---
//   app.enableCors({
//     origin: configService.get<string[]>('app.corsOrigins'),
//     credentials: true,
//   });

//   // --- Global prefix ---
//   // Versioning is encoded directly in API_PREFIX (e.g. "api/v1") rather than
//   // via app.enableVersioning(), since this project ships a single API
//   // version at a time. Bumping to v2 means changing API_PREFIX and routing
//   // old/new controllers side by side during a migration window if needed.
//   const apiPrefix = configService.get<string>('app.apiPrefix')!;
//   app.setGlobalPrefix(apiPrefix);

//   // --- Validation ---
//   app.useGlobalPipes(
//     new ValidationPipe({
//       whitelist: true,
//       forbidNonWhitelisted: true,
//       transform: true,
//       transformOptions: { enableImplicitConversion: true },
//     }),
//   );

//   // --- Swagger ---
//   const swaggerConfig = new DocumentBuilder()
//     .setTitle('Music Streaming Platform API')
//     .setDescription(
//       'Production-ready backend for a Spotify-like music streaming platform. ' +
//         'Covers auth, catalog management, playlists, social features, uploads, ' +
//         'subscriptions, and payments.',
//     )
//     .setVersion('1.0')
//     .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
//     .addTag('Auth')
//     .addTag('Users')
//     .addTag('Artists')
//     .addTag('Albums')
//     .addTag('Tracks')
//     .addTag('Genres')
//     .addTag('Playlists')
//     .addTag('Favorites')
//     .addTag('Listening History')
//     .addTag('Search')
//     .addTag('Upload')
//     .addTag('Comments')
//     .addTag('Likes')
//     .addTag('Notifications')
//     .addTag('Subscription')
//     .addTag('Payments')
//     .addTag('Admin')
//     .build();

//   const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
//   SwaggerModule.setup('docs', app, swaggerDocument, {
//     swaggerOptions: { persistAuthorization: true },
//   });

//   // --- Graceful shutdown ---
//   app.enableShutdownHooks();

//   const port = configService.get<number>('app.port')!;

//   // console.log("PORT =", port);
//   await app.listen(port);

//   // eslint-disable-next-line no-console
//   // console.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
//   // eslint-disable-next-line no-console
//   // console.log(`📚 Swagger docs available at: http://localhost:${port}/docs`);
// }

// bootstrap();
