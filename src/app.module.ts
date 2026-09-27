import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { configurations, validateEnv } from './config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { DomainEventsModule } from './events';
import { LoggerModule } from './logger/logger.module';

import { GlobalExceptionFilter, PrismaExceptionFilter } from './common/filters';
import { TransformInterceptor, LoggingInterceptor, CacheInterceptor } from './common/interceptors';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ArtistsModule } from './modules/artists/artists.module';
import { AlbumsModule } from './modules/albums/albums.module';
import { TracksModule } from './modules/tracks/tracks.module';
import { GenresModule } from './modules/genres/genres.module';
import { PlaylistsModule } from './modules/playlists/playlists.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ListeningHistoryModule } from './modules/listening-history/listening-history.module';
import { SearchModule } from './modules/search/search.module';
import { UploadModule } from './modules/upload/upload.module';
import { CommentsModule } from './modules/comments/comments.module';
import { LikesModule } from './modules/likes/likes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    // ---- Infrastructure (global) ----
    ConfigModule.forRoot({
      isGlobal: true,
      load: configurations,
      validate: validateEnv,
      envFilePath: ['.env'],
    }),
    LoggerModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    DomainEventsModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: parseInt(process.env.THROTTLE_TTL_SECONDS ?? '60', 10) * 1000,
            limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
          },
        ],
      }),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    // ---- Feature modules ----
    AuthModule,
    UsersModule,
    ArtistsModule,
    AlbumsModule,
    TracksModule,
    GenresModule,
    PlaylistsModule,
    FavoritesModule,
    ListeningHistoryModule,
    SearchModule,
    UploadModule,
    CommentsModule,
    LikesModule,
    NotificationsModule,
    SubscriptionModule,
    PaymentsModule,
    AdminModule,
  ],
  providers: [
    // Order matters for filters: more specific filters (Prisma) must be
    // provided before the catch-all GlobalExceptionFilter so Nest checks
    // them first for a matching @Catch() type.
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },

    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: CacheInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },

    // Auth guard runs before RBAC guard; both are global so every route is
    // protected by default unless annotated with @Public() (auth) and
    // every protected route is open to any role unless annotated with @Roles().
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
