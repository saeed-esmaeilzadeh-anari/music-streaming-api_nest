import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const baseUrl = (process.env.API_BASE_URL ?? 'http://127.0.0.1:3001/api/v1').replace(/\/+$/, '');
const timeoutMs = Number(process.env.E2E_TIMEOUT_MS ?? 45_000);

function unwrap(payload) {
  return payload && typeof payload === 'object' && payload.success === true && 'data' in payload
    ? payload.data
    : payload;
}

async function request(method, route, { token, body, headers = {}, rawBody, expected = [200, 201, 204] } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(rawBody !== undefined ? { body: rawBody } : {}),
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }

  if (!expected.includes(response.status)) {
    throw new Error(
      `${method} ${route} expected status ${expected.join('|')}, received ${response.status}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`,
    );
  }

  return { response, data: unwrap(parsed), raw: parsed };
}

async function waitForUpload(uploadId, token) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    const result = await request('GET', `/uploads/${uploadId}`, { token });
    last = result.data;
    if (last?.status === 'READY') return last;
    if (last?.status === 'FAILED') {
      throw new Error(`Audio processing failed: ${last.failureReason ?? 'unknown reason'}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for upload ${uploadId}; last status: ${last?.status ?? 'unknown'}`);
}

function createAudioFixture(directory) {
  const filePath = path.join(directory, 'e2e-tone.mp3');
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'sine=frequency=880:duration=2',
    '-vn', '-codec:a', 'libmp3lame', '-b:a', '96k',
    '-y', filePath,
  ]);
  return filePath;
}

async function main() {
  const fixtureDir = await mkdtemp(path.join(tmpdir(), 'soundwave-e2e-'));
  try {
    const anonymousFeed = await request('GET', '/recommendations?limit=5');
    assert.equal(anonymousFeed.data.sections.length, 6);
    assert.equal(anonymousFeed.data.coldStart, true);

    await request('GET', '/recommendations?limit=5', {
      token: 'not-a-valid-jwt-token',
      expected: [401],
    });

    const email = `e2e-${randomUUID()}@example.test`;
    const username = `e2e_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const password = 'StrongE2ePass123';

    const registration = await request('POST', '/auth/register', {
      body: { email, username, password, firstName: 'E2E', lastName: 'Listener' },
      expected: [201],
    });
    let accessToken = registration.data.accessToken;
    let refreshToken = registration.data.refreshToken;
    const userId = registration.data.user.id;
    assert.ok(accessToken, 'registration must return an access token');
    assert.ok(refreshToken, 'registration must return a refresh token');

    const me = await request('GET', '/users/me', { token: accessToken });
    assert.equal(me.data.id, userId);

    const anonymousProfile = await request('GET', '/users/me', { expected: [401] });
    assert.equal(anonymousProfile.response.status, 401);

    const ownArtist = await request('GET', '/artists/me', { token: accessToken });
    assert.equal(ownArtist.data, null);

    const artistResult = await request('POST', '/artists', {
      token: accessToken,
      body: { stageName: `E2E Artist ${username}`, bio: 'Temporary artist created by the isolated E2E suite.' },
      expected: [201],
    });
    const artistId = artistResult.data.id;
    assert.ok(artistId, 'artist onboarding must return an artist id');

    const rotated = await request('POST', '/auth/refresh', {
      body: { refreshToken },
      expected: [200],
    });
    accessToken = rotated.data.accessToken;
    refreshToken = rotated.data.refreshToken;
    assert.equal(rotated.data.user.role, 'ARTIST');

    await request('POST', '/auth/refresh', {
      body: { refreshToken: registration.data.refreshToken },
      expected: [401],
    });

    await request('GET', '/users', { token: accessToken, expected: [403] });

    const trackResult = await request('POST', `/artists/${artistId}/tracks`, {
      token: accessToken,
      body: { title: `E2E audio ${username}`, isExplicit: false },
      expected: [201],
    });
    const trackId = trackResult.data.id;
    assert.ok(trackId, 'track metadata creation must return a track id');
    assert.equal(trackResult.data.status, 'DRAFT');

    const secondRegistration = await request('POST', '/auth/register', {
      body: {
        email: `other-${randomUUID()}@example.test`,
        username: `other_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
        password,
      },
      expected: [201],
    });

    await request('POST', '/uploads/presign', {
      token: secondRegistration.data.accessToken,
      body: {
        assetType: 'TRACK_AUDIO',
        originalName: 'forbidden.mp3',
        mimeType: 'audio/mpeg',
        trackId,
      },
      expected: [403],
    });

    const audioPath = createAudioFixture(fixtureDir);
    const audioBytes = await readFile(audioPath);

    const presign = await request('POST', '/uploads/presign', {
      token: accessToken,
      body: {
        assetType: 'TRACK_AUDIO',
        originalName: 'e2e-tone.mp3',
        mimeType: 'audio/mpeg',
        trackId,
      },
      expected: [201],
    });
    assert.ok(presign.data.uploadId);
    assert.match(presign.data.uploadUrl, /uploads\/local-put\//);

    const binaryUpload = await fetch(presign.data.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'audio/mpeg' },
      body: audioBytes,
    });
    assert.equal(binaryUpload.status, 204, 'local binary PUT must return 204');
    await binaryUpload.arrayBuffer();

    const confirmed = await request('POST', '/uploads/confirm', {
      token: accessToken,
      body: { uploadId: presign.data.uploadId, sizeBytes: audioBytes.length },
      expected: [201, 200],
    });
    assert.equal(confirmed.data.status, 'PROCESSING');

    const readyUpload = await waitForUpload(presign.data.uploadId, accessToken);
    assert.equal(readyUpload.status, 'READY');

    const publishedTrack = await request('GET', `/tracks/${trackId}`);
    assert.equal(publishedTrack.data.status, 'PUBLISHED');
    assert.ok(publishedTrack.data.durationSec > 0, 'ffprobe duration must be a positive number');
    assert.match(publishedTrack.data.audioUrl, /\/uploads\/tracks\//);

    const audioResponse = await fetch(`${baseUrl}/uploads/tracks/${trackId}/audio`);
    assert.equal(audioResponse.status, 200, 'published audio must be reachable through the stable route');
    const streamedAudio = Buffer.from(await audioResponse.arrayBuffer());
    assert.ok(streamedAudio.length > 0, 'audio endpoint must stream non-empty bytes');

    await request('POST', `/tracks/${trackId}/play`, {
      token: accessToken,
      body: { progressSec: 30 },
      expected: [204],
    });

    // The listening-history subscriber is asynchronous; poll for its persisted event.
    let historyItems = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const history = await request('GET', '/listening-history?page=1&limit=20', {
        token: accessToken,
      });
      historyItems = history.data.items ?? [];
      if (historyItems.some((entry) => entry.trackId === trackId)) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const historyEntry = historyItems.find((entry) => entry.trackId === trackId);
    assert.ok(historyEntry, 'play event must be persisted in listening history');
    assert.equal(historyEntry.completed, true, 'a 30-second listen must be marked completed');

    const personalizedFeed = await request('GET', '/recommendations?limit=5', {
      token: accessToken,
    });
    assert.equal(personalizedFeed.data.sections.length, 6);
    assert.equal(personalizedFeed.data.coldStart, false);

    await request('POST', '/favorites', {
      token: accessToken,
      body: { trackId },
      expected: [201],
    });
    const favorites = await request('GET', '/favorites', { token: accessToken });
    assert.ok(
      (favorites.data.items ?? []).some((favorite) => favorite.trackId === trackId),
      'favorite list must contain the liked track',
    );
    await request('DELETE', `/favorites/${trackId}`, { token: accessToken, expected: [204] });

    const like = await request('POST', '/likes', {
      token: accessToken,
      body: { targetType: 'TRACK', targetId: trackId },
      expected: [201],
    });
    assert.equal(like.data.targetType, 'TRACK');
    const likeCount = await request(
      'GET',
      `/likes/count?targetType=TRACK&targetId=${encodeURIComponent(trackId)}`,
    );
    assert.ok(Number(likeCount.data) >= 1, 'track like count must increase');
    await request('DELETE', `/likes?targetType=TRACK&targetId=${encodeURIComponent(trackId)}`, {
      token: accessToken,
      expected: [204],
    });

    const comment = await request('POST', '/comments', {
      token: accessToken,
      body: {
        targetType: 'TRACK',
        targetId: trackId,
        content: 'A real integration-test comment.',
      },
      expected: [201],
    });
    const comments = await request(
      'GET',
      `/comments?targetType=TRACK&targetId=${encodeURIComponent(trackId)}&page=1&limit=20`,
    );
    assert.ok(
      (comments.data.items ?? []).some((entry) => entry.id === comment.data.id),
      'public track comments must include the created comment',
    );
    await request('DELETE', `/comments/${comment.data.id}`, {
      token: accessToken,
      expected: [204],
    });

    const secondUserComment = await request('POST', '/comments', {
      token: secondRegistration.data.accessToken,
      body: {
        targetType: 'TRACK',
        targetId: trackId,
        content: 'A comment from another listener to verify owner notifications.',
      },
      expected: [201],
    });
    assert.ok(secondUserComment.data.id);

    await request('POST', '/likes', {
      token: secondRegistration.data.accessToken,
      body: { targetType: 'TRACK', targetId: trackId },
      expected: [201],
    });

    let ownerNotifications = [];
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const notificationPage = await request('GET', '/notifications?page=1&limit=20', {
        token: accessToken,
      });
      ownerNotifications = notificationPage.data.items ?? [];
      const hasLike = ownerNotifications.some((item) => item.type === 'LIKE_RECEIVED');
      const hasComment = ownerNotifications.some((item) => item.type === 'COMMENT_REPLY');
      if (hasLike && hasComment) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const likeNotification = ownerNotifications.find((item) => item.type === 'LIKE_RECEIVED');
    const commentNotification = ownerNotifications.find((item) => item.type === 'COMMENT_REPLY');
    assert.ok(likeNotification, 'another user liking the track must notify the artist owner');
    assert.ok(commentNotification, 'another user commenting on the track must notify the artist owner');

    await request('PATCH', `/notifications/${likeNotification.id}/read`, {
      token: secondRegistration.data.accessToken,
      expected: [404],
    });
    const readNotification = await request('PATCH', `/notifications/${likeNotification.id}/read`, {
      token: accessToken,
      expected: [200],
    });
    assert.equal(readNotification.data.isRead, true, 'only the notification owner can mark it as read');

    const unreadNotifications = await request('GET', '/notifications/unread-count', {
      token: accessToken,
    });
    assert.equal(typeof unreadNotifications.data.count, 'number');

    const playlist = await request('POST', '/playlists', {
      token: accessToken,
      body: { title: `E2E playlist ${username}`, visibility: 'PRIVATE' },
      expected: [201],
    });
    await request('GET', `/playlists/${playlist.data.id}`, { expected: [403] });
    await request('GET', `/playlists/${playlist.data.id}`, {
      token: secondRegistration.data.accessToken,
      expected: [403],
    });
    const ownerPrivatePlaylist = await request('GET', `/playlists/${playlist.data.id}`, {
      token: accessToken,
      expected: [200],
    });
    assert.equal(ownerPrivatePlaylist.data.id, playlist.data.id);

    await request('POST', `/playlists/${playlist.data.id}/tracks`, {
      token: accessToken,
      body: { trackId },
      expected: [201],
    });
    const playlistRead = await request('GET', `/playlists/${playlist.data.id}`, {
      token: accessToken,
    });
    const playlistTracks = playlistRead.data.tracks ?? [];
    assert.ok(
      playlistTracks.some((entry) => (entry.track?.id ?? entry.trackId) === trackId),
      'playlist API response must include the ordered nested track entry',
    );

    const search = await request('GET', `/search?q=${encodeURIComponent(username)}`);
    assert.ok(search.data, 'search endpoint must return a response');

    const adminLogin = await request('POST', '/auth/login', {
      body: { email: 'admin@musicstream.dev', password: process.env.SEED_ADMIN_PASSWORD },
      expected: [200],
    });
    assert.equal(adminLogin.data.user.role, 'ADMIN');
    const adminUsers = await request('GET', '/users?page=1&limit=5', {
      token: adminLogin.data.accessToken,
    });
    assert.ok(adminUsers.data.items, 'admin user-management endpoint must return paginated users');

    const createdGenre = await request('POST', '/genres', {
      token: adminLogin.data.accessToken,
      body: { name: `E2E Genre ${username}`, description: 'Temporary E2E genre.' },
      expected: [201],
    });
    await request('DELETE', `/genres/${createdGenre.data.id}`, {
      token: adminLogin.data.accessToken,
      expected: [204],
    });

    // Session-management regression coverage: metadata must never expose token material,
    // and a user may revoke only their own refresh session.
    const sessionList = await request('GET', '/auth/sessions', { token: accessToken });
    assert.ok(Array.isArray(sessionList.data), 'active sessions endpoint must return an array');
    assert.ok(sessionList.data.length >= 1, 'the current login must have an active session');
    for (const session of sessionList.data) {
      assert.ok(session.id, 'session metadata must include its id');
      assert.ok(session.createdAt && session.expiresAt, 'session metadata must include lifecycle timestamps');
      assert.equal('tokenHash' in session, false, 'session metadata must not expose token hashes');
      assert.equal('refreshToken' in session, false, 'session metadata must not expose refresh tokens');
    }

    const extraLogin = await request('POST', '/auth/login', {
      body: { email, password },
      expected: [200],
    });
    const sessionsAfterLogin = await request('GET', '/auth/sessions', { token: accessToken });
    const extraSession = sessionsAfterLogin.data.find(
      (session) => !sessionList.data.some((existing) => existing.id === session.id),
    );
    assert.ok(extraSession, 'a new login must create a separately manageable session');

    await request('DELETE', `/auth/sessions/${extraSession.id}`, {
      token: secondRegistration.data.accessToken,
      expected: [404],
    });
    await request('DELETE', `/auth/sessions/${extraSession.id}`, {
      token: accessToken,
      expected: [204],
    });
    await request('POST', '/auth/refresh', {
      body: { refreshToken: extraLogin.data.refreshToken },
      expected: [401],
    });

    await request('POST', '/auth/logout', {
      body: { refreshToken },
      expected: [204],
    });
    await request('POST', '/auth/refresh', {
      body: { refreshToken },
      expected: [401],
    });

    console.log(JSON.stringify({
      success: true,
      checks: [
        'register and current-user profile',
        'protected endpoint rejects anonymous requests',
        'artist onboarding and refresh-token role update',
        'refresh token rotation rejects the previous token',
        'artist RBAC blocks administrative user listing',
        'track metadata creation and ownership validation',
        'local binary upload and confirmation',
        'BullMQ + ffprobe processing publishes a real audio track',
        'stable audio endpoint streams non-empty audio bytes',
        'play event and asynchronous listening-history persistence',
        'favorites add/list/remove',
        'likes add/count/remove',
        'comments create/list/delete',
        'like/comment owner notification delivery and owner-only read authorization',
        'notifications unread-count query',
        'private playlist access control and ordered nested track response',
        'catalog search',
        'admin login, user listing, and genre management',
        'logout revokes the refresh token',
        'active sessions expose metadata only and support owner-scoped revocation',
      ],
      userId,
      artistId,
      trackId,
      durationSec: publishedTrack.data.durationSec,
      streamedBytes: streamedAudio.length,
    }, null, 2));
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
