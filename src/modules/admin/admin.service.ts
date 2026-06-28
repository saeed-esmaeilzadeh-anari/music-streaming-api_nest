import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersRepository } from '../users/repositories/users.repository';
import { AdminDashboardStatsDto, UpdateUserStatusDto } from './dto';

/**
 * Admin module deliberately has no Prisma model of its own - it's a
 * composition layer over existing repositories/PrismaService for
 * operational visibility (dashboard counts) and moderation actions
 * (suspend/reactivate users, etc). Reaching into PrismaService directly
 * for read-only aggregate counts mirrors the same rationale as SearchService.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async getDashboardStats(): Promise<AdminDashboardStatsDto> {
    const [totalUsers, totalArtists, totalTracks, totalAlbums, activeSubscriptions] =
      await Promise.all([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.artist.count(),
        this.prisma.track.count({ where: { status: 'PUBLISHED' } }),
        this.prisma.album.count({ where: { isPublished: true } }),
        this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      ]);

    return { totalUsers, totalArtists, totalTracks, totalAlbums, activeSubscriptions };
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    return this.usersRepository.update(userId, { status: dto.status });
  }
}
