import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersRepository } from '../users/repositories/users.repository';
import { AdminDashboardStatsDto, UpdateUserStatusDto } from './dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';

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

  async listArtistsByVerification(
    query: { skip?: number; page?: number; limit?: number },
    verification?: 'PENDING' | 'APPROVED' | 'REJECTED',
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ArtistWhereInput = verification ? { verificationStatus: verification } : {};

    const [items, totalItems] = await Promise.all([
      this.prisma.artist.findMany({
        where,
        skip: query.skip,
        take: limit,
        orderBy: verification === 'PENDING' ? { createdAt: 'asc' } : { monthlyListeners: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, email: true, avatarUrl: true, status: true },
          },
        },
      }),
      this.prisma.artist.count({ where }),
    ]);

    return new PaginatedResultDto(
      items.map((a) => ({
        id: a.id,
        stageName: a.stageName,
        bio: a.bio,
        isVerified: a.isVerified,
        verificationStatus: a.verificationStatus,
        monthlyListeners: a.monthlyListeners,
        createdAt: a.createdAt,
        user: a.user,
      })),
      totalItems,
      page,
      limit,
    );
  }

  /**
   * Approve/reject an artist profile. `isVerified` stays in sync with the
   * decision so existing checks that read the boolean keep working.
   */
  async setArtistVerification(artistId: string, status: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const artist = await this.prisma.artist.findUnique({ where: { id: artistId } });
    if (!artist) {
      throw new NotFoundException('Artist not found.');
    }

    return this.prisma.artist.update({
      where: { id: artistId },
      data: {
        verificationStatus: status,
        isVerified: status === 'APPROVED',
      },
    });
  }
}
