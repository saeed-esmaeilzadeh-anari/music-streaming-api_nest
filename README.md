# Soundwave — Music Streaming API

NestJS API for the Soundwave music streaming platform. The frontend is maintained in [music-platform-frontend](https://github.com/saeed-esmaeilzadeh-anari/music-platform-frontend).

## Stack

- NestJS 10 / TypeScript
- PostgreSQL and Prisma
- JWT access and rotating refresh tokens
- Redis and BullMQ
- Local or S3-compatible object storage
- Stripe payments (optional until credentials and prices are configured)
- Swagger / OpenAPI and Pino logging

## Local development

1. Install Node.js 20+, PostgreSQL and Redis.
2. Copy `.env.example` to `.env` and set the local database connection.
3. Keep `STORAGE_PROVIDER=local` for local development. AWS credentials are required only for `STORAGE_PROVIDER=s3`.
4. Install and generate Prisma:

```bash
npm ci
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
```

The API defaults to `http://localhost:3001/api/v1`; Swagger is available at `http://localhost:3001/docs`. The production entry point is `dist/src/main.js` (`npm run start:prod`).

## Environment

See [`.env.example`](.env.example) for the complete variable list. Important groups:

- App: `APP_URL`, `PORT`, `API_PREFIX`, `CORS_ORIGINS`
- Database: `DATABASE_URL`, optional `DATABASE_POOL_SIZE`
- Auth: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and their expiry values
- Redis: `REDIS_HOST`, `REDIS_PORT`, optional password/TLS
- Storage: `STORAGE_PROVIDER`; S3 credentials only when the provider is `s3`
- Payments: Stripe keys and price IDs, optional until payments are enabled

Use separate cryptographically random JWT secrets of at least 32 characters in production. Never commit `.env` or real credentials.

## Storage and audio processing

The canonical upload implementation is `src/modules/upload`, backed by the `IStorageProvider` abstraction. The legacy `upload1` implementation is not registered by the application module.

Audio jobs use BullMQ and the system `ffprobe` executable to read the uploaded object's real duration. The worker requires `ffprobe` in its runtime image; the provided Docker image installs FFmpeg/ffprobe. A failed probe does not publish the track. Retries are left to BullMQ, and the upload is marked failed only after the final attempt.

Local storage is intended for development or a persistent-volume host. Do not use container-local storage for a serverless production deployment. Use a persistent S3-compatible provider (AWS S3, Cloudflare R2, or another compatible service) in production.

The API and BullMQ worker currently share the Nest application process. For serverless API hosting, run the queue worker as a separate always-on process/container using the same codebase and environment rather than expecting a serverless function to stay alive.

## Commands

```bash
npm run start:dev
npm run build
npm run start:prod
npm test -- --runInBand
npm run test:e2e
npx prisma migrate deploy
npx prisma studio
```

## API and integration

- API prefix: `/api/v1` by default
- Swagger: `/docs`
- Upload flow: `POST /uploads/presign` → PUT to the returned upload URL → `POST /uploads/confirm` → poll `GET /uploads/:id`
- Audio playback: public stable route `GET /uploads/tracks/:trackId/audio`, which redirects to the configured storage provider's read URL

All protected endpoints require a valid access token. Ownership and role checks belong in the API; hiding UI controls is not an authorization boundary.

## Deployment

1. Provision PostgreSQL, Redis, and durable object storage.
2. Configure production environment variables and strong JWT secrets.
3. Build the container with the provided Dockerfile.
4. Run `npx prisma migrate deploy` as a release step.
5. Run the API and an always-on queue worker.
6. Restrict CORS to the deployed frontend origin.
7. Verify `/health` (when configured) and `/docs` according to your deployment policy.

Do not expose Swagger publicly in a production environment unless that is an explicit product decision.

## CI

GitHub Actions runs Prisma generation, TypeScript checking, build, and unit tests on pushes and pull requests. External services are not provisioned by the compile/test workflow; integration tests that require PostgreSQL, Redis, Stripe, or S3 must use isolated test services and credentials.
