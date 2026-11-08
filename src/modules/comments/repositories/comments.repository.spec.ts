import { PrismaService } from '../../../prisma/prisma.service';
import { CommentsRepository } from './comments.repository';

describe('CommentsRepository', () => {
  let prisma: {
    track: { findUnique: jest.Mock };
    album: { findUnique: jest.Mock };
    playlist: { findUnique: jest.Mock };
  };
  let repository: CommentsRepository;

  beforeEach(() => {
    prisma = {
      track: { findUnique: jest.fn() },
      album: { findUnique: jest.fn() },
      playlist: { findUnique: jest.fn() },
    };
    repository = new CommentsRepository(prisma as unknown as PrismaService);
  });

  it('resolves the owner of a track through its artist profile', async () => {
    prisma.track.findUnique.mockResolvedValue({ artist: { userId: 'artist-owner' } });

    await expect(repository.findTargetOwnerId('TRACK', 'track-1')).resolves.toBe('artist-owner');
    expect(prisma.track.findUnique).toHaveBeenCalledWith({
      where: { id: 'track-1' },
      select: { artist: { select: { userId: true } } },
    });
  });

  it('resolves the owner of an album through its artist profile', async () => {
    prisma.album.findUnique.mockResolvedValue({ artist: { userId: 'album-owner' } });

    await expect(repository.findTargetOwnerId('ALBUM', 'album-1')).resolves.toBe('album-owner');
  });

  it('resolves playlist owners and returns null for missing or unsupported targets', async () => {
    prisma.playlist.findUnique.mockResolvedValue({ ownerId: 'playlist-owner' });

    await expect(repository.findTargetOwnerId('PLAYLIST', 'playlist-1')).resolves.toBe(
      'playlist-owner',
    );
    await expect(repository.findTargetOwnerId('UNKNOWN', 'missing')).resolves.toBeNull();
  });
});
