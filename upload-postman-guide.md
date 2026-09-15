# Soundwave Upload Flow — Complete Postman Testing Guide

This guide is derived entirely from reading the actual source code:
`upload.controller.ts`, `upload.service.ts`, `local-storage.provider.ts`,
`s3-storage.provider.ts`, `storage.module.ts`, `request-upload.dto.ts`,
`confirm-upload.dto.ts`, and the frontend `upload.service.ts` + `types/index.ts`.
Nothing is invented.

---

## Part 1 — How the Upload Flow Actually Works

### Architecture

```
StorageModule reads STORAGE_PROVIDER env var
         │
         ├─ "local"  →  LocalStorageProvider  (default if unset)
         └─ "s3"     →  S3StorageProvider
```

Both providers are registered in NestJS DI on every startup.
The `STORAGE_PROVIDER` env var selects which one gets bound to the
`STORAGE_PROVIDER` injection token. `UploadService` only ever talks to
the interface — it never imports S3 SDK or fs directly.

### The Three-Step Upload Protocol

```
CLIENT                          NESTJS (UploadService)              STORAGE
  │                                      │                              │
  │── POST /uploads/presign ────────────►│                              │
  │   { assetType, originalName,         │  prisma.upload.create()      │
  │     mimeType, trackId? }             │  status = PENDING            │
  │                                      │  buildUploadUrl()            │
  │◄── { uploadId, uploadUrl, ──────────│                              │
  │      s3Key, expiresIn }              │                              │
  │                                      │                              │
  │  [LOCAL]  PUT uploadUrl ────────────►│  receiveLocalUpload()        │
  │           raw bytes                  │  storage.upload()   ────────►│ write to disk
  │◄── 204 No Content ─────────────────│  status = UPLOADED            │
  │                                      │                              │
  │  [S3]     PUT uploadUrl ────────────────────────────────────────►  │ write to S3
  │           raw bytes                  │                              │
  │◄── 200 (from AWS) ──────────────────────────────────────────────◄  │
  │                                      │                              │
  │── POST /uploads/confirm ────────────►│  prisma.upload.update()      │
  │   { uploadId, sizeBytes? }           │  TRACK_AUDIO → PROCESSING    │
  │                                      │  others      → READY         │
  │◄── UploadResponse ─────────────────│  audioQueue.add() if audio   │
  │                                      │                              │
  │── GET /uploads/:uploadId ───────────►│  poll until PROCESSING→READY │
  │◄── UploadResponse ─────────────────│                              │
```

### Key facts derived from the code

**Fact 1 — Track must exist before uploading TRACK_AUDIO.**
`request-upload.dto.ts` validates: if `assetType` is `TRACK_AUDIO` or
`TRACK_COVER`, then `trackId` is required (`@IsUUID()`). The service throws
`400 Bad Request: "trackId is required when assetType is TRACK_AUDIO"` if
omitted. You cannot upload audio for a track that does not yet exist in the
database.

**Fact 2 — Local PUT goes to NestJS, not S3.**
When `STORAGE_PROVIDER=local`, `buildUploadUrl()` returns:
`${APP_URL}/api/v1/uploads/local-put/${uploadId}`
This is a `PUT` endpoint on the NestJS server itself, protected by
`JwtAuthGuard`. Your Postman `Authorization: Bearer <token>` header
must be present on this request too.

**Fact 3 — The local-put endpoint reads `req.rawBody`.**
`main.ts` must register `express.raw({ type: '*/*', limit: '110mb' })`
middleware for `/api/v1/uploads/local-put` BEFORE NestJS body-parser runs,
and `NestFactory.create(AppModule, { rawBody: true })` must be set. Without
this, `req.rawBody` is `undefined` and the handler silently returns 204
without writing any file.

**Fact 4 — confirm accepts PENDING (S3) or UPLOADED (local).**
After local-put, the record status is `UPLOADED`. After a direct S3 PUT,
the record is still `PENDING` (NestJS never gets the file). The confirm
step accepts both and moves to `PROCESSING` (TRACK_AUDIO) or `READY`
(everything else).

**Fact 5 — TRACK_AUDIO triggers a BullMQ job.**
After confirm, `audioQueue.add('process-track-audio', { uploadId, trackId, s3Key })`
is called. The track status stays `PROCESSING` until the worker completes.
You can poll `GET /uploads/:id` to see when it transitions to `READY`.

**Fact 6 — All four upload controller endpoints require JWT.**
The class decorator is `@UseGuards(JwtAuthGuard)`. Every request —
presign, local-put, confirm, and status poll — requires
`Authorization: Bearer <accessToken>`.

**Fact 7 — Storage key format.**
The service builds: `${KEY_PREFIX[assetType]}/${uuid()}.${extension}`
Example for an MP3: `tracks/audio/f47ac10b-58cc-4372-a567-0e02b2c3d479.mp3`
This is stored in `upload.s3Key` in the database (the column is named `s3Key`
even for local storage — it just holds the storage key regardless of provider).

**Fact 8 — File serving (local only).**
`main.ts` mounts `express.static(uploadsDir)` at `/uploads`.
A file saved as `tracks/audio/uuid.mp3` is served at:
`http://localhost:3001/uploads/tracks/audio/uuid.mp3`
This URL is what `LocalStorageProvider.getSignedUrl()` returns.

---

## Part 2 — Prerequisites

### 2.1 Environment variables (`.env`)

```env
# Required for local dev
STORAGE_PROVIDER=local
APP_URL=http://localhost:3001
PORT=3001

# Optional — defaults to <project-root>/uploads if unset
LOCAL_STORAGE_DIR=/absolute/path/to/your/project/uploads

# Optional — defaults to http://localhost:3001/uploads if unset
LOCAL_STORAGE_URL=http://localhost:3001/uploads

# JWT — must match what your AuthModule uses
JWT_SECRET=your-secret-here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis (BullMQ requires it)
REDIS_HOST=localhost
REDIS_PORT=6379

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/soundwave
```

### 2.2 Services that must be running

| Service | Why |
|---------|-----|
| NestJS backend on port 3001 | The API |
| PostgreSQL | Prisma reads/writes users, artists, tracks, uploads |
| Redis | BullMQ audio-processing queue (confirm will throw if Redis is down) |

### 2.3 Required database records

You need these records **before** starting the upload flow:

1. **User** with role `ARTIST` or `ADMIN`
2. **Artist** linked to that user (the `artists` table row with `userId = yourUserId`)
3. **Track** linked to that artist (created via `POST /artists/:artistId/tracks`)

The Track record is the prerequisite that most people miss. The track is
created as a metadata-only record first, then audio is attached via the
upload flow.

---

## Part 3 — Postman Environment Setup

Create a Postman Environment named **Soundwave Local** with these variables:

| Variable | Initial Value | Description |
|----------|---------------|-------------|
| `baseUrl` | `http://localhost:3001/api/v1` | API base |
| `accessToken` | *(empty)* | Set by Login test script |
| `refreshToken` | *(empty)* | Set by Login test script |
| `userId` | *(empty)* | Set by Login test script |
| `artistId` | *(empty)* | Set by Create Artist test script |
| `trackId` | *(empty)* | Set by Create Track test script |
| `uploadId` | *(empty)* | Set by Presign test script |
| `uploadUrl` | *(empty)* | Set by Presign test script |
| `s3Key` | *(empty)* | Set by Presign test script |
| `coverUploadId` | *(empty)* | Set by Cover Presign test script |
| `coverUploadUrl` | *(empty)* | Set by Cover Presign test script |

---

## Part 4 — Step-by-Step Postman Sequence

---

### Step 0 — Register (skip if account exists)

**Request**
```
POST {{baseUrl}}/auth/register
Content-Type: application/json
```
```json
{
  "email": "artist@soundwave.test",
  "username": "testartist",
  "password": "P@ssw0rd!",
  "firstName": "Test",
  "lastName": "Artist"
}
```

**Expected response — 201**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "a1b2c3d4-...",
      "email": "artist@soundwave.test",
      "username": "testartist",
      "role": "LISTENER"
    }
  }
}
```

**Tests tab (Postman)**
```javascript
const res = pm.response.json();
if (res.data) {
    pm.environment.set('accessToken',  res.data.accessToken);
    pm.environment.set('refreshToken', res.data.refreshToken);
    pm.environment.set('userId',       res.data.user.id);
}
```

> Note: after registration the role is `LISTENER`. You need to manually
> update the role to `ARTIST` in PostgreSQL, or log in as an ADMIN and
> call `PATCH /admin/users/:id/status` and update the role via a direct
> DB query:
> ```sql
> UPDATE users SET role = 'ARTIST' WHERE email = 'artist@soundwave.test';
> ```

---

### Step 1 — Login

**Request**
```
POST {{baseUrl}}/auth/login
Content-Type: application/json
```
```json
{
  "email": "artist@soundwave.test",
  "password": "P@ssw0rd!"
}
```

**Expected response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "artist@soundwave.test",
      "username": "testartist",
      "role": "ARTIST"
    }
  }
}
```

**Tests tab**
```javascript
const res = pm.response.json();
if (res.data) {
    pm.environment.set('accessToken',  res.data.accessToken);
    pm.environment.set('refreshToken', res.data.refreshToken);
    pm.environment.set('userId',       res.data.user.id);
}
```

**Copy to next step:** `accessToken`, `userId`

---

### Step 2 — Create Artist Profile

**Request**
```
POST {{baseUrl}}/artists
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
```json
{
  "stageName": "Test Artist",
  "bio": "This is a test artist profile."
}
```

**Expected response — 201**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "stageName": "Test Artist",
    "bio": "This is a test artist profile.",
    "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "isVerified": false,
    "monthlyListeners": 0
  }
}
```

**Tests tab**
```javascript
const res = pm.response.json();
if (res.data) {
    pm.environment.set('artistId', res.data.id);
}
```

**Copy to next step:** `artistId`

---

### Step 3 — Create Track (metadata only — no audio yet)

This creates the Track database record. Audio is attached separately via the
upload flow. This step is **mandatory** before presigning `TRACK_AUDIO`
because the service requires a valid `trackId` UUID.

**Request**
```
POST {{baseUrl}}/artists/{{artistId}}/tracks
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
```json
{
  "title": "Eshgh",
  "isExplicit": false,
  "genreIds": []
}
```

To attach to an album add `"albumId": "{{albumId}}"`.
`genreIds` can be an empty array or omitted entirely.

**Expected response — 201**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "c3d4e5f6-a7b8-9012-cdef-012345678902",
    "title": "Eshgh",
    "status": "DRAFT",
    "isExplicit": false,
    "playCount": 0,
    "durationSec": null,
    "artist": {
      "id": "b2c3d4e5-...",
      "stageName": "Test Artist"
    },
    "genres": [],
    "album": null
  }
}
```

**Tests tab**
```javascript
const res = pm.response.json();
if (res.data) {
    pm.environment.set('trackId', res.data.id);
}
```

**Copy to next step:** `trackId`

---

### Step 4 — Presign Audio Upload

This creates the `Upload` Prisma record with `status: PENDING` and returns
the URL where the file must be PUT.

**Request**
```
POST {{baseUrl}}/uploads/presign
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
```json
{
  "assetType": "TRACK_AUDIO",
  "originalName": "eshgh.mp3",
  "mimeType": "audio/mpeg",
  "trackId": "{{trackId}}"
}
```

**`assetType` valid values (from the DTO enum):**

| Value | trackId required | Stored under |
|-------|-----------------|--------------|
| `TRACK_AUDIO` | ✅ Yes | `tracks/audio/` |
| `TRACK_COVER` | ✅ Yes | `tracks/covers/` |
| `ALBUM_COVER` | ❌ No | `albums/covers/` |
| `ARTIST_AVATAR` | ❌ No | `artists/avatars/` |
| `ARTIST_BANNER` | ❌ No | `artists/banners/` |
| `PLAYLIST_COVER` | ❌ No | `playlists/covers/` |
| `USER_AVATAR` | ❌ No | `users/avatars/` |

**Expected response — 201**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "uploadId": "d4e5f6a7-b8c9-0123-def0-123456789003",
    "uploadUrl": "http://localhost:3001/api/v1/uploads/local-put/d4e5f6a7-b8c9-0123-def0-123456789003",
    "s3Key": "tracks/audio/d4e5f6a7-b8c9-0123-def0-123456789003.mp3",
    "expiresIn": 900
  }
}
```

The `uploadUrl` for `STORAGE_PROVIDER=local` is always
`http://localhost:3001/api/v1/uploads/local-put/<uploadId>`.
For `STORAGE_PROVIDER=s3` it would be an `https://s3.amazonaws.com/...?X-Amz-Signature=...` URL.

**Tests tab**
```javascript
const res = pm.response.json();
if (res.data) {
    pm.environment.set('uploadId',   res.data.uploadId);
    pm.environment.set('uploadUrl',  res.data.uploadUrl);
    pm.environment.set('s3Key',      res.data.s3Key);
}
```

**Copy to next step:** `uploadId`, `uploadUrl`

---

### Step 5 — PUT the Audio File

This is where the actual file bytes are sent. The method and URL differ
between local and S3 providers but the Postman approach is the same.

#### Local provider (`STORAGE_PROVIDER=local`)

The `uploadUrl` points to your NestJS server. JWT auth is required.

**Request**
```
PUT {{uploadUrl}}
Authorization: Bearer {{accessToken}}
Content-Type: audio/mpeg
Body: Binary → select your .mp3 file
```

Postman setup:
1. Method: `PUT`
2. URL: `{{uploadUrl}}`  (e.g. `http://localhost:3001/api/v1/uploads/local-put/d4e5f6a7-...`)
3. **Authorization** tab → Bearer Token → `{{accessToken}}`
4. **Headers** tab → add `Content-Type: audio/mpeg`
5. **Body** tab → select **binary** → click **Select File** → choose your `.mp3`

**Expected response — 204 No Content**

No body. HTTP status 204. This means:
- The file was written to `${LOCAL_STORAGE_DIR}/tracks/audio/<uuid>.mp3`
- The `Upload` record status changed from `PENDING` to `UPLOADED`

#### S3 provider (`STORAGE_PROVIDER=s3`)

The `uploadUrl` is the AWS presigned URL. Do NOT include the Authorization header.

**Request**
```
PUT <paste the full presigned URL from step 4>
Content-Type: audio/mpeg
Body: Binary → select your .mp3 file
```

Postman setup:
1. Method: `PUT`
2. URL: paste the full `uploadUrl` value (the AWS signed URL)
3. **Authorization** tab → **No Auth** (the presigned URL carries its own credentials)
4. **Headers** tab → add `Content-Type: audio/mpeg`
5. **Body** tab → select **binary** → click **Select File** → choose your `.mp3`

**Expected response — 200 (from AWS)**

Empty body or minimal AWS XML. HTTP 200 from S3.

---

### Step 6 — Confirm Audio Upload

Tells the backend that the PUT succeeded. This transitions the record to
`PROCESSING` and enqueues the BullMQ `process-track-audio` job.

**Request**
```
POST {{baseUrl}}/uploads/confirm
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
```json
{
  "uploadId": "{{uploadId}}",
  "sizeBytes": 4500000
}
```

`sizeBytes` is optional but recommended. Use the actual file size in bytes.

**Expected response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "d4e5f6a7-b8c9-0123-def0-123456789003",
    "assetType": "TRACK_AUDIO",
    "status": "PROCESSING",
    "s3Key": "tracks/audio/d4e5f6a7-b8c9-0123-def0-123456789003.mp3",
    "trackId": "c3d4e5f6-a7b8-9012-cdef-012345678902",
    "sizeBytes": 4500000,
    "createdAt": "2026-09-14T10:30:00.000Z"
  }
}
```

Status is `PROCESSING` (not `READY`) because `TRACK_AUDIO` is in
`AUDIO_ASSET_TYPES` and triggers the BullMQ worker.

---

### Step 7 — Poll Upload Status (optional)

**Request**
```
GET {{baseUrl}}/uploads/{{uploadId}}
Authorization: Bearer {{accessToken}}
```

**Expected response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "d4e5f6a7-b8c9-0123-def0-123456789003",
    "status": "READY",
    "assetType": "TRACK_AUDIO",
    "s3Key": "tracks/audio/d4e5f6a7-b8c9-0123-def0-123456789003.mp3",
    "trackId": "c3d4e5f6-a7b8-9012-cdef-012345678902"
  }
}
```

Status transitions: `PENDING` → `UPLOADED` (local only) → `PROCESSING` → `READY`

If the audio-processing worker is not running, it will stay at `PROCESSING`
indefinitely.

---

### Step 8 — Upload Track Cover (optional, same pattern)

Repeat steps 4–6 with `TRACK_COVER` instead of `TRACK_AUDIO`.
Cover images go to `READY` immediately (no audio processing needed).

**Presign request**
```
POST {{baseUrl}}/uploads/presign
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
```json
{
  "assetType": "TRACK_COVER",
  "originalName": "eshgh-cover.jpg",
  "mimeType": "image/jpeg",
  "trackId": "{{trackId}}"
}
```

**Tests tab**
```javascript
const res = pm.response.json();
if (res.data) {
    pm.environment.set('coverUploadId',  res.data.uploadId);
    pm.environment.set('coverUploadUrl', res.data.uploadUrl);
}
```

**PUT the image** (same as Step 5, but:)
- URL: `{{coverUploadUrl}}`
- Content-Type: `image/jpeg`
- Body: binary → your `.jpg` file

**Confirm**
```json
{
  "uploadId": "{{coverUploadId}}",
  "sizeBytes": 245000
}
```

**Expected confirm response** — status `READY` (not PROCESSING, because it's not audio):
```json
{
  "data": {
    "status": "READY",
    "assetType": "TRACK_COVER"
  }
}
```

---

## Part 5 — Verifying the Result

### 5.1 Verify the file exists on disk (local provider)

```bash
ls -lh ./uploads/tracks/audio/
# should show: d4e5f6a7-b8c9-0123-def0-123456789003.mp3

ls -lh ./uploads/tracks/covers/
# should show the cover image if uploaded
```

### 5.2 Access the file via HTTP (local provider)

Open in browser or send a GET (no auth required — served by express.static):

```
GET http://localhost:3001/uploads/tracks/audio/<uuid>.mp3
GET http://localhost:3001/uploads/tracks/covers/<uuid>.jpg
```

### 5.3 Verify the Upload record in PostgreSQL

```sql
-- Check upload record
SELECT id, asset_type, status, s3_key, track_id, size_bytes, created_at
FROM uploads
WHERE id = 'd4e5f6a7-b8c9-0123-def0-123456789003';

-- Expected:
-- status = 'PROCESSING' or 'READY'
-- s3_key = 'tracks/audio/d4e5f6a7-....mp3'
-- track_id = 'c3d4e5f6-....'
```

### 5.4 Verify the Track record

```sql
SELECT id, title, status, duration_sec
FROM tracks
WHERE id = 'c3d4e5f6-a7b8-9012-cdef-012345678902';

-- Before audio processing: status = 'DRAFT', duration_sec = null
-- After audio processing:  status = 'PUBLISHED', duration_sec = <seconds>
```

### 5.5 Verify BullMQ job was added (Redis)

```bash
redis-cli
> LLEN bull:audio-processing:wait
# Should return 1 (or more) if the job was queued
```

---

## Part 6 — Common Errors and Exact Causes

### 400 Bad Request — `trackId is required when assetType is TRACK_AUDIO`

**Cause:** You sent a presign request for `TRACK_AUDIO` or `TRACK_COVER`
without including `trackId`, or the `trackId` is not a valid UUID.

**Fix:** Create the track first (`POST /artists/:artistId/tracks`), copy
the returned `id`, and include it as `trackId` in the presign body.

---

### 400 Bad Request — `Upload is already in status: UPLOADED`

**Cause:** You called `PUT /uploads/local-put/:id` twice for the same
`uploadId`. The service checks `if (upload.status !== 'PENDING')` and
rejects the second PUT.

**Fix:** Each `uploadId` can only be used once. Run a new presign to get
a fresh `uploadId`.

---

### 400 Bad Request — `Upload is already in status: PROCESSING`

**Cause:** You called `POST /uploads/confirm` twice for the same `uploadId`.

**Fix:** Each `uploadId` can only be confirmed once.

---

### 400 Bad Request — validation errors (class-validator)

**Cause:** Wrong field names, wrong types, or missing required fields in
the presign or confirm body.

Common mistakes:
- `asset_type` instead of `assetType` (use camelCase)
- `track_id` instead of `trackId`
- `assetType: "track_audio"` (must be uppercase: `"TRACK_AUDIO"`)
- `sizeBytes: "4500000"` (must be a number, not a string)

---

### 401 Unauthorized — `Unauthorized`

**Cause A:** Missing `Authorization` header on the local-put PUT request.
The `@UseGuards(JwtAuthGuard)` decorator is on the controller class, so
it applies to ALL routes including `PUT /uploads/local-put/:id`.

**Fix:** Add `Authorization: Bearer {{accessToken}}` to every Postman
request including the PUT.

**Cause B:** Access token has expired (default TTL is 15 minutes).
Re-run Step 1 (Login) to get a fresh token.

---

### 403 Forbidden

**Cause:** The `uploadId` belongs to a different user. `UploadService`
checks `if (upload.userId !== userId)` and throws `ForbiddenException`.

**Fix:** Use the same account that called presign for all subsequent steps
(local-put, confirm, status).

---

### 404 Not Found — `Upload not found`

**Cause:** The `uploadId` UUID does not exist in the `uploads` table.
This happens when:
- You mistyped the UUID
- You're querying the wrong database
- The presign step failed silently and no record was created

**Fix:** Check the presign response body carefully and copy the exact
`uploadId` value.

---

### 204 returned but file not saved (local provider)

**Cause:** `req.rawBody` is `undefined`. The handler checks
`if (!buffer || buffer.length === 0) { return; }` and returns 204 silently.

**Root cause:** `main.ts` does not have:
1. `NestFactory.create(AppModule, { rawBody: true })`
2. `app.use('/api/v1/uploads/local-put', express.raw({ type: '*/*', limit: '110mb' }))`

**Fix:** Apply both changes from `main.bootstrap.ts` and restart the server.

---

### 500 Internal Server Error on confirm

**Cause A:** Redis is not running. BullMQ cannot add the job.
Error in logs: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Fix:** Start Redis: `redis-server` or `docker run -p 6379:6379 redis`

**Cause B:** The `uploads` table `status` column does not have `UPLOADED`
as a valid enum value. This means the Prisma migration for the `UPLOADED`
status was not applied.

**Fix:** Run `npx prisma migrate dev` to apply pending migrations.

---

### Content-Type mismatch

**Cause:** You sent `Content-Type: application/json` in the PUT request.
The local-put handler reads `req.rawBody` regardless, but if NestJS
body-parser intercepts the request first and parses it as JSON, `rawBody`
may be an empty Buffer.

**Fix:** Set `Content-Type` to the actual MIME type of the file:
- `audio/mpeg` for MP3
- `audio/wav` for WAV
- `audio/flac` for FLAC
- `audio/aac` for AAC/M4A
- `image/jpeg` for JPG
- `image/png` for PNG
- `image/webp` for WebP

---

## Part 7 — Complete Postman Collection Structure

Manually create this collection in Postman:

```
📁 Soundwave — Upload Flow
│
├── 📁 0. Auth
│   ├── POST  Register           → {{baseUrl}}/auth/register
│   └── POST  Login              → {{baseUrl}}/auth/login
│
├── 📁 1. Artist Setup
│   └── POST  Create Artist      → {{baseUrl}}/artists
│
├── 📁 2. Track Setup
│   └── POST  Create Track       → {{baseUrl}}/artists/{{artistId}}/tracks
│
├── 📁 3. Audio Upload (TRACK_AUDIO)
│   ├── POST  Presign Audio      → {{baseUrl}}/uploads/presign
│   ├── PUT   Upload Audio File  → {{uploadUrl}}
│   ├── POST  Confirm Audio      → {{baseUrl}}/uploads/confirm
│   └── GET   Poll Status        → {{baseUrl}}/uploads/{{uploadId}}
│
├── 📁 4. Cover Upload (TRACK_COVER)
│   ├── POST  Presign Cover      → {{baseUrl}}/uploads/presign
│   ├── PUT   Upload Cover Image → {{coverUploadUrl}}
│   └── POST  Confirm Cover      → {{baseUrl}}/uploads/confirm
│
├── 📁 5. Verify
│   ├── GET   Get Track          → {{baseUrl}}/tracks/{{trackId}}
│   └── GET   Get Upload Status  → {{baseUrl}}/uploads/{{uploadId}}
│
└── 📁 6. Other Asset Types (same pattern)
    ├── POST  Presign Album Cover   → assetType: ALBUM_COVER,    no trackId
    ├── POST  Presign Artist Avatar → assetType: ARTIST_AVATAR,  no trackId
    ├── POST  Presign Artist Banner → assetType: ARTIST_BANNER,  no trackId
    ├── POST  Presign Playlist Cover→ assetType: PLAYLIST_COVER, no trackId
    └── POST  Presign User Avatar   → assetType: USER_AVATAR,    no trackId
```

### Collection-level Authorization

In Postman → collection → Edit → Authorization tab:
- Type: **Bearer Token**
- Token: `{{accessToken}}`

All requests inherit this. The local-put PUT automatically sends the token.

### Collection-level Variables

```
baseUrl      = http://localhost:3001/api/v1
accessToken  = (empty — set by test scripts)
refreshToken = (empty — set by test scripts)
userId       = (empty — set by test scripts)
artistId     = (empty — set by test scripts)
trackId      = (empty — set by test scripts)
uploadId     = (empty — set by test scripts)
uploadUrl    = (empty — set by test scripts)
coverUploadId  = (empty)
coverUploadUrl = (empty)
```

---

## Part 8 — Request Body Reference Card

```
POST /auth/login
{ "email": "string", "password": "string" }

POST /artists
{ "stageName": "string", "bio": "string (optional)" }

POST /artists/:artistId/tracks
{ "title": "string", "albumId": "uuid (optional)",
  "isExplicit": false, "genreIds": ["uuid"] }

POST /uploads/presign
{ "assetType": "TRACK_AUDIO|TRACK_COVER|ALBUM_COVER|ARTIST_AVATAR|
                ARTIST_BANNER|PLAYLIST_COVER|USER_AVATAR",
  "originalName": "filename.mp3",
  "mimeType": "audio/mpeg",
  "trackId": "uuid — required for TRACK_AUDIO and TRACK_COVER only" }

PUT  <uploadUrl>
Body: binary file | Content-Type: <mimeType from presign>
Auth: Bearer {{accessToken}} if STORAGE_PROVIDER=local
Auth: none if STORAGE_PROVIDER=s3 (presigned URL carries credentials)

POST /uploads/confirm
{ "uploadId": "uuid", "sizeBytes": 4500000 }

GET /uploads/:uploadId
(no body)
```

---

## Part 9 — Status Progression Reference

```
TRACK_AUDIO upload lifecycle:
  PENDING → UPLOADED → PROCESSING → READY
            (local)    (confirm)    (worker done)
            
  PENDING → PROCESSING → READY
            (S3, confirm)  (worker done)

All other asset types (TRACK_COVER, ALBUM_COVER, etc.):
  PENDING → UPLOADED → READY
            (local)    (confirm — immediate, no queue)
            
  PENDING → READY
            (S3, confirm — immediate)
```
