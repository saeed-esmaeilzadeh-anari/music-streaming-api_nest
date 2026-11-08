import { UsersRepository } from '../users/repositories/users.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let prisma: {
    user: { count: jest.Mock };
    artist: { count: jest.Mock };
    track: { count: jest.Mock };
    album: { count: jest.Mock };
    subscription: { count: jest.Mock };
  };
  let usersRepository: { update: jest.Mock };
  let service: AdminService;

  beforeEach(() => {
    prisma = {
      user: { count: jest.fn().mockResolvedValue(10) },
      artist: { count: jest.fn().mockResolvedValue(3) },
      track: { count: jest.fn().mockResolvedValue(12) },
      album: { count: jest.fn().mockResolvedValue(4) },
      subscription: { count: jest.fn().mockResolvedValue(2) },
    };
    usersRepository = {
      update: jest.fn().mockResolvedValue({ id: 'user-1', status: 'SUSPENDED' }),
    };
    service = new AdminService(
      prisma as unknown as PrismaService,
      usersRepository as unknown as UsersRepository,
    );
  });

  it('returns dashboard counts derived from active database records', async () => {
    await expect(service.getDashboardStats()).resolves.toEqual({
      totalUsers: 10,
      totalArtists: 3,
      totalTracks: 12,
      totalAlbums: 4,
      activeSubscriptions: 2,
    });
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { deletedAt: null } });
    expect(prisma.track.count).toHaveBeenCalledWith({ where: { status: 'PUBLISHED' } });
    expect(prisma.album.count).toHaveBeenCalledWith({ where: { isPublished: true } });
    expect(prisma.subscription.count).toHaveBeenCalledWith({ where: { status: 'ACTIVE' } });
  });

  it('updates a user status through the existing users repository', async () => {
    await service.updateUserStatus('user-1', { status: 'SUSPENDED' as never });

    expect(usersRepository.update).toHaveBeenCalledWith('user-1', { status: 'SUSPENDED' });
  });
});
