import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FollowsService } from './follows.service';

describe('FollowsService', () => {
  const userId = 'listener-1';
  const artistId = 'artist-1';
  const artistUserId = 'artist-user-1';

  let prisma: Record<string, Record<string, jest.Mock>>;
  let events: { emit: jest.Mock };
  let service: FollowsService;

  const artist = { id: artistId, userId: artistUserId };
  const edge = { followerId: userId, followeeId: artistUserId };

  beforeEach(() => {
    prisma = {
      artist: {
        findUnique: jest.fn().mockResolvedValue(artist),
      },
      follow: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(edge),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ username: 'listener' }) },
    };
    events = { emit: jest.fn() };
    service = new FollowsService(prisma as unknown as never, events as unknown as EventEmitter2);
  });

  it('follows an artist, emits USER_FOLLOWED and returns following=true', async () => {
    const result = await service.followArtist(userId, artistId);

    expect(prisma.follow.create).toHaveBeenCalledWith({
      data: { followerId: userId, followeeId: artistUserId },
    });
    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit.mock.calls[0][0]).toBe('user.followed');
    expect(events.emit.mock.calls[0][1]).toMatchObject({
      followerId: userId,
      followeeId: artistUserId,
    });
    expect(result).toEqual({ following: true });
  });

  it('is idempotent when the edge already exists (no duplicate event)', async () => {
    prisma.follow.findUnique.mockResolvedValue({ id: 'edge-1' });

    const result = await service.followArtist(userId, artistId);

    expect(prisma.follow.create).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
    expect(result).toEqual({ following: true });
  });

  it('rejects following your own artist profile', async () => {
    prisma.artist.findUnique.mockResolvedValue({ id: artistId, userId });

    await expect(service.followArtist(userId, artistId)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.follow.create).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing artist', async () => {
    prisma.artist.findUnique.mockResolvedValue(null);

    await expect(service.followArtist(userId, artistId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unfollows via deleteMany and reports following=false', async () => {
    const result = await service.unfollowArtist(userId, artistId);

    expect(prisma.follow.deleteMany).toHaveBeenCalledWith({
      where: { followerId: userId, followeeId: artistUserId },
    });
    expect(result).toEqual({ following: false });
  });

  it('treats unfollowing a missing edge as a no-op success', async () => {
    prisma.follow.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.unfollowArtist(userId, artistId)).resolves.toEqual({
      following: false,
    });
  });
});
