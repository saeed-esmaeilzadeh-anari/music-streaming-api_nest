import { RecommendationsService } from './recommendations.service';

describe('RecommendationsService', () => {
  const personalUserId = 'user-with-history';

  let prisma: Record<string, Record<string, jest.Mock>>;
  let cache: { buildKey: jest.Mock; get: jest.Mock; set: jest.Mock };
  let follows: { followedArtistIds: jest.Mock };
  let service: RecommendationsService;

  const track = (id: string) => ({
    id,
    title: `Track ${id}`,
    audioUrl: `https://cdn/${id}.mp3`,
    coverUrl: null,
    durationSec: 180,
    isExplicit: false,
    artist: { id: `artist-${id}`, stageName: 'Artist' },
    album: { id: `album-${id}` },
  });
  const artistRow = (id: string) => ({
    id,
    stageName: `Artist ${id}`,
    monthlyListeners: 10,
    isVerified: false,
    user: { avatarUrl: null },
  });
  const playlistRow = (id: string) => ({
    id,
    title: `Playlist ${id}`,
    coverUrl: null,
    owner: { username: 'owner' },
    _count: { tracks: 3 },
  });

  beforeEach(() => {
    prisma = {
      listeningHistory: { findMany: jest.fn().mockResolvedValue([]) },
      favorite: { findMany: jest.fn().mockResolvedValue([]) },
      track: { findMany: jest.fn().mockResolvedValue([]) },
      artist: { findMany: jest.fn().mockResolvedValue([]) },
      playlist: { findMany: jest.fn().mockResolvedValue([]) },
    };
    cache = {
      buildKey: jest.fn((...parts) => parts.join(':')),
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };
    follows = { followedArtistIds: jest.fn().mockResolvedValue([]) };
    service = new RecommendationsService(
      prisma as unknown as never,
      cache as unknown as never,
      follows as unknown as never,
    );
  });

  it('builds a six-section cold-start feed for anonymous users', async () => {
    prisma.track.findMany.mockResolvedValue([track('t1')]);
    prisma.artist.findMany.mockResolvedValue([artistRow('a1')]);
    prisma.playlist.findMany.mockResolvedValue([playlistRow('p1')]);

    const result = await service.getForUser(undefined, { limit: 10 });

    expect(result.coldStart).toBe(true);
    expect(result.sections.map((s) => s.id)).toEqual([
      'recently-played',
      'new-releases',
      'trending',
      'artists-for-you',
      'made-for-you',
      'because-you-follow',
    ]);
    expect(result.sections[0].items).toHaveLength(1);
  });

  it('uses listening history for the recently-played section of known users', async () => {
    prisma.listeningHistory.findMany.mockResolvedValue([
      { trackId: 't2' },
      { trackId: 't1' },
      { trackId: 't2' },
    ]);
    prisma.track.findMany.mockImplementation(async ({ where }) => {
      if (where?.id?.in) return [track('t2'), track('t1')];
      return [track('t3')];
    });
    prisma.artist.findMany.mockResolvedValue([artistRow('a1')]);
    prisma.playlist.findMany.mockResolvedValue([playlistRow('p1')]);
    follows.followedArtistIds.mockResolvedValue(['a1']);

    const result = await service.getForUser(personalUserId, { limit: 10 });

    expect(result.coldStart).toBe(false);
    const recently = result.sections.find((s) => s.id === 'recently-played');
    expect(recently?.items).toHaveLength(2);
    expect(prisma.listeningHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: personalUserId } }),
    );
  });

  it('uses listened and favorited genres to personalize public playlists', async () => {
    prisma.listeningHistory.findMany.mockImplementation(async ({ select }) => (
      select?.track
        ? [{ track: { genres: [{ genreId: 'genre-rock' }] } }]
        : [{ trackId: 'recent-track' }]
    ));
    prisma.favorite.findMany.mockResolvedValue([
      { track: { genres: [{ genreId: 'genre-pop' }] } },
    ]);
    prisma.track.findMany.mockResolvedValue([track('recent-track'), track('related-track')]);
    prisma.playlist.findMany.mockResolvedValue([playlistRow('p1')]);

    const result = await service.getForUser(personalUserId, { limit: 10 });
    const playlistQuery = prisma.playlist.findMany.mock.calls[0][0];

    expect(result.coldStart).toBe(false);
    expect(playlistQuery.where.visibility).toBe('PUBLIC');
    expect(playlistQuery.where.OR).toHaveLength(2);
    expect(JSON.stringify(playlistQuery.where)).toContain('genre-rock');
    expect(JSON.stringify(playlistQuery.where)).toContain('genre-pop');
  });

  it('does not repeat a track across multiple track sections', async () => {
    prisma.listeningHistory.findMany.mockResolvedValue([{ trackId: 't1' }]);
    prisma.track.findMany.mockResolvedValue([track('t1'), track('t2')]);
    prisma.artist.findMany.mockResolvedValue([artistRow('a1')]);
    prisma.playlist.findMany.mockResolvedValue([playlistRow('p1')]);

    const result = await service.getForUser(personalUserId, { limit: 10 });
    const trackIds = result.sections
      .filter((section) => section.type === 'track')
      .flatMap((section) => section.items.map((item) => (item as { id: string }).id));

    expect(new Set(trackIds).size).toBe(trackIds.length);
  });

  it('caches the assembled feed per user with the current algorithm version', async () => {
    prisma.track.findMany.mockResolvedValue([track('t1')]);
    prisma.artist.findMany.mockResolvedValue([artistRow('a1')]);
    prisma.playlist.findMany.mockResolvedValue([playlistRow('p1')]);

    await service.getForUser(personalUserId, { limit: 10 });

    expect(cache.set).toHaveBeenCalledWith(
      `recommendations:v2:${personalUserId}:10`,
      expect.objectContaining({ sections: expect.any(Array) }),
      120,
    );
  });

  it('returns a cached feed without touching the database again', async () => {
    const cachedFeed = { sections: [], coldStart: true, generatedAt: new Date().toISOString() };
    cache.get.mockResolvedValue(cachedFeed);

    const result = await service.getForUser(personalUserId, { limit: 10 });

    expect(result).toBe(cachedFeed);
    expect(prisma.track.findMany).not.toHaveBeenCalled();
  });
});
