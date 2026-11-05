import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Role } from '../../common/constants/role.enum';
import { RedisCacheService } from '../../redis/redis-cache.service';
import { ArtistsRepository } from '../artists/repositories/artists.repository';
import { TracksRepository } from './repositories/tracks.repository';
import { TracksService } from './tracks.service';

describe('TracksService', () => {
  const userId = 'artist-user-1';
  const otherUserId = 'other-user-1';
  const artistId = 'artist-1';
  const trackId = 'track-1';

  let tracks: {
    create: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    incrementPlayCount: jest.Mock;
    setGenres: jest.Mock;
  };
  let artists: { findById: jest.Mock };
  let cache: { buildKey: jest.Mock; del: jest.Mock; delByPrefix: jest.Mock };
  let events: { emit: jest.Mock };
  let service: TracksService;

  const track = {
    id: trackId,
    title: 'Unit test track',
    durationSec: 0,
    audioUrl: null,
    coverUrl: null,
    status: 'DRAFT',
    isExplicit: false,
    playCount: 0n,
    albumId: null,
    artistId,
    artist: { id: artistId, stageName: 'Unit Artist' },
    createdAt: new Date(),
  };

  beforeEach(() => {
    tracks = {
      create: jest.fn().mockResolvedValue(track),
      findById: jest.fn(),
      update: jest.fn().mockResolvedValue(track),
      delete: jest.fn(),
      findMany: jest.fn().mockResolvedValue([track]),
      count: jest.fn().mockResolvedValue(1),
      incrementPlayCount: jest.fn().mockResolvedValue(track),
      setGenres: jest.fn(),
    };
    artists = {
      findById: jest.fn().mockResolvedValue({ id: artistId, userId }),
    };
    cache = {
      buildKey: jest.fn((...parts: string[]) => parts.join(':')),
      del: jest.fn().mockResolvedValue(undefined),
      delByPrefix: jest.fn().mockResolvedValue(undefined),
    };
    events = { emit: jest.fn() };

    service = new TracksService(
      tracks as unknown as TracksRepository,
      artists as unknown as ArtistsRepository,
      cache as unknown as RedisCacheService,
      events as unknown as EventEmitter2,
    );
  });

  it('creates a draft track when the requester owns the artist profile', async () => {
    const result = await service.create(artistId, userId, Role.ARTIST, {
      title: 'Unit test track',
      isExplicit: false,
    });

    expect(tracks.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Unit test track',
      artist: { connect: { id: artistId } },
    }));
    expect(result.id).toBe(trackId);
    expect(cache.delByPrefix).toHaveBeenCalledWith('tracks:list');
  });

  it('rejects track creation for an artist profile owned by someone else', async () => {
    artists.findById.mockResolvedValue({ id: artistId, userId });

    await expect(service.create(artistId, otherUserId, Role.ARTIST, {
      title: 'Not allowed',
    })).rejects.toBeInstanceOf(ForbiddenException);

    expect(tracks.create).not.toHaveBeenCalled();
  });

  it('allows admins to manage artist tracks without changing artist ownership', async () => {
    const result = await service.create(artistId, otherUserId, Role.ADMIN, {
      title: 'Admin-managed draft',
    });

    expect(result.id).toBe(trackId);
    expect(artists.findById).not.toHaveBeenCalled();
  });

  it('returns not found when a track id does not exist', async () => {
    tracks.findById.mockResolvedValue(null);

    await expect(service.findById(trackId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('increments play count and emits the listening event for a valid track', async () => {
    tracks.findById.mockResolvedValue(track);

    await service.registerPlay(trackId, userId, 30);

    expect(tracks.incrementPlayCount).toHaveBeenCalledWith(trackId);
    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit.mock.calls[0][1]).toMatchObject({
      userId,
      trackId,
      progressSec: 30,
    });
  });

  it('does not register plays for missing tracks', async () => {
    tracks.findById.mockResolvedValue(null);

    await expect(service.registerPlay(trackId, userId, 30)).rejects.toBeInstanceOf(NotFoundException);
    expect(tracks.incrementPlayCount).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
