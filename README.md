# Music Streaming Platform API

A production-ready NestJS backend for a Spotify-like music streaming platform. Built with clean architecture, domain-driven module boundaries, and the repository pattern throughout.

## Stack

| Concern | Technology |
|---|---|
| Framework | NestJS 10 (Express adapter) |
| Database | PostgreSQL via Prisma ORM |
| Auth | JWT (access + refresh, rotation), Passport, RBAC |
| Cache | Redis (`cache-manager`) |
| Queues | BullMQ (Redis-backed) |
| File storage | AWS S3 (presigned URLs) |
| Payments | Stripe (Checkout + Webhooks) |
| Docs | Swagger / OpenAPI |
| Validation | class-validator / class-transformer |
| Logging | nestjs-pino |

## Architecture

```
src/
├── main.ts                 # Bootstrap: Swagger, security middleware, global pipes
├── app.module.ts            # Root module wiring infra + all 17 feature modules
│
├── config/                  # Namespaced, validated environment configuration
├── common/                  # Cross-cutting: filters, interceptors, guards, decorators, DTOs
├── prisma/                  # PrismaService + PrismaModule (global)
├── redis/                   # Cache abstraction + raw ioredis client (global)
├── queue/                   # BullMQ root registration + queue name constants
├── events/                  # Domain event names + typed payload classes
├── logger/                  # Pino structured logging
├── stripe/                  # Shared Stripe SDK client (avoids circular deps)
│
└── modules/                  # One folder per business domain
    ├── auth/                 # JWT issuance, refresh rotation, RBAC guards
    ├── users/
    ├── artists/
    ├── albums/
    ├── tracks/
    ├── genres/
    ├── playlists/
    ├── favorites/
    ├── listening-history/    # Event-driven: listens to track.played
    ├── search/                # Cross-entity fan-out query
    ├── upload/                # S3 presigned URLs + BullMQ processing
    ├── comments/
    ├── likes/
    ├── notifications/         # Event-driven: listens to comment/like/payment events
    ├── subscription/          # Stripe Checkout session creation
    ├── payments/              # Stripe webhook handling + payment history
    └── admin/                 # Cross-module aggregation, moderation
```

Each feature module follows the same internal shape:

```
modules/<name>/
├── dto/                 # Request/response DTOs with class-validator + Swagger decorators
├── repositories/        # Repository Pattern: isolates Prisma access from business logic
├── <name>.controller.ts
├── <name>.service.ts
└── <name>.module.ts
```

### Why the Repository Pattern here

Every module's service depends on a `*Repository` class, never on `PrismaService` directly (the only deliberate exceptions are `SearchService` and `AdminService`, which are documented inline as read-only composition layers that don't "own" a table). This means:

- Business logic in services has no knowledge of Prisma's query API shape.
- Repositories are trivially mockable in unit tests.
- If the ORM ever changes, only the repository layer is touched.

### Event-driven architecture

Cross-module side effects are decoupled via `@nestjs/event-emitter`, not direct service-to-service calls. For example:

- `TracksService.registerPlay()` emits `track.played` and knows nothing about `ListeningHistoryModule`.
- `ListeningHistoryService` listens for `track.played` (`@OnEvent`) and persists a history row.
- `CommentsService` / `LikesService` emit `comment.created` / `like.created`; `NotificationsModule` listens and creates notifications, then enqueues a BullMQ job for actual delivery.
- Stripe webhooks emit `subscription.renewed` / `payment.failed`; `NotificationsModule` reacts the same way.

This keeps modules genuinely independent — new consumers can subscribe to existing events without modifying the emitting module.

### Queues (BullMQ)

- `track-processing` — triggered after a client confirms an S3 audio upload; extracts duration/metadata and flips the track to `PUBLISHED` (placeholder for real ffmpeg/ffprobe integration).
- `notifications` — delivers (push/email/websocket placeholder) a notification after its DB row is created.

Heavy or slow work never blocks the request thread; the API responds immediately and the queue worker does the rest, with retry/backoff configured centrally in `QueueModule`.

### AuthN/AuthZ

- **Access tokens** are short-lived JWTs (default 15m), validated by `JwtStrategy`.
- **Refresh tokens** are long-lived (default 7d), stored **hashed** (SHA-256) in `refresh_tokens`, and **rotated** on every use — the old token is revoked the moment a new pair is issued, limiting the blast radius of a leaked token.
- **RBAC** is opt-in per route via `@Roles(...)` + the global `RolesGuard`; routes without `@Roles()` are open to any authenticated user.
- **`@Public()`** opts a route out of the global `JwtAuthGuard` (registration, login, genre browsing, etc).

### Security middleware (main.ts)

- `helmet()` for standard HTTP security headers.
- `compression()` for response gzip.
- Global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` — unknown/unexpected body fields are rejected, not silently dropped.
- Stripe webhook route verifies the `stripe-signature` header against the **raw** request body (`rawBody: true` passed to `NestFactory.create`), so webhook authenticity never depends on our own session/JWT auth.
- Global rate limiting via `@nestjs/throttler`.

### Caching

- `RedisCacheService` wraps `cache-manager` with typed `get/set/del/delByPrefix` helpers.
- `@CacheTTL(seconds, keyPrefix?)` + the global `CacheInterceptor` make any GET route cacheable with one decorator; cache keys include the full query string so filter/pagination combinations don't collide.
- Mutating operations (`update`, `delete`) invalidate the relevant cache prefix.

## Database schema highlights

See `prisma/schema.prisma` for the full model. Key relationship patterns:

- **Polymorphic associations** (`Comment`, `Like`) use nullable FK columns (`trackId`, `albumId`, `playlistId`, `commentId`) gated by a `targetType` enum, rather than a generic `(type, id)` string pair — this preserves real foreign-key integrity and cascade behavior per target type.
- **Ordered many-to-many** (`PlaylistTrack`) is an explicit join model (not an implicit Prisma m:n) so track order within a playlist can be stored and updated.
- **Soft deletes** on `User` (`deletedAt`) so referential history (comments, listening history, payments) survives account deletion for audit/legal purposes.
- **Money** is stored as integer cents (`amountCents`) to avoid floating-point rounding issues.

## Getting started

```bash
cp .env.example .env        # fill in real secrets (JWT secrets, AWS, Stripe)
docker compose up -d postgres redis
npm install
npm run prisma:migrate:dev
npm run prisma:seed          # creates an admin + demo artist + base genres
npm run start:dev
```

API available at `http://localhost:3001/api/v1`, Swagger docs at `http://localhost:3001/docs`.

To run the whole stack (API + Postgres + Redis) in Docker:

```bash
docker compose up --build
```

## Production deployment notes

- `Dockerfile` is multi-stage (`development` / `build` / `production`); the production image runs as a non-root user and contains only `dist/`, `node_modules` (pruned), and the Prisma client.
- Run `npm run prisma:migrate:deploy` (not `migrate dev`) in CI/CD before starting the production container — it applies pending migrations without prompting or generating new ones.
- Set `NODE_ENV=production` so pino logs as structured JSON (no `pino-pretty` transport) and Prisma's query logging is reduced to `error` only.
- Point `REDIS_HOST`/`DATABASE_URL` at managed services (ElastiCache/Redis Cloud, RDS/Cloud SQL) — the app itself is stateless and horizontally scalable behind a load balancer.
- BullMQ workers run in-process here for simplicity. At higher scale, extract `TrackProcessingProcessor` and `NotificationsDispatchProcessor` into a separate worker deployment (same codebase, a different `main-worker.ts` entrypoint that bootstraps only `QueueModule` + the processors) so CPU-heavy job processing doesn't compete with API request handling.

## Extending this codebase

- **New module**: copy the shape of an existing module (`dto/`, `repositories/`, controller, service, module), register it in `app.module.ts`.
- **New domain event**: add the name to `DOMAIN_EVENTS` and a payload class in `src/events/domain-events.payloads.ts`, emit via `EventEmitter2.emit()`, listen via `@OnEvent()`.
- **New cached endpoint**: add `@CacheTTL(seconds, 'prefix')` to any GET handler — no other wiring needed.
- **New queue**: add a name to `QUEUE_NAMES`, register it in `QueueModule` (or locally via `BullModule.registerQueue` in the owning feature module), add a `@Processor()` class.

<!-- جهت اجرای redis بدون داکر -->
<!-- PowerShell را Run as Administrator باز کن:

sc.exe start Memurai

بعد:

sc.exe query Memurai -->

<!-- جهت اجرای redis در داکر
docker run -d --name redis -p 6379:6379 redis:7-alpine -->


<!-- اعمال تغییرات سورس و اجرای مجدد داکر
# 1. تغییرات کد را انجام بده

# 2. ساخت Image جدید
docker build -t music-streaming-api:latest .

# 3. حذف کانتینر قبلی
docker stop music-streaming-api
docker rm music-streaming-api

# 4. اجرای نسخه جدید
docker run -d `
  --name music-streaming-api `
  -p 3001:3001 `
  --env-file .env `
  music-streaming-api:latest -->

  <!-- جهت اجرای minio
  
  docker run -d --name minio -p 9000:9000 -p 9001:9001 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin -v minio_data:/data quay.io/minio/minio:latest server /data --console-address ":9001"
  
  curl.exe --noproxy "*" -i http://127.0.0.1:9000/minio/health/live
   -->


   <!-- لاگ گیری برای اجرای بک اند
   docker logs -f music-streaming-api -->

   <!-- داکر ران
   docker rm -f music-streaming-api 

   docker run -d `                   
>>   --name music-streaming-api `
>>   --network music-network `
>>   -p 3001:3001 `
>>   --env-file .env `
>>   music-streaming-api -->


<!-- ساخت مجدد پستگرس در داکر
docker run -d `                   
>>   --name music-streaming-postgres `
>>   --network music-network `
>>   -p 5432:5432 `
>>   -e POSTGRES_DB=music_streaming `
>>   -e POSTGRES_USER=postgres `
>>   -e POSTGRES_PASSWORD=postgres `
>>   -v postgres_data:/var/lib/postgresql/data `
>>   postgres:16 -->

