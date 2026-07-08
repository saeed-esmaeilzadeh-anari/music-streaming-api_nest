import { Injectable } from '@nestjs/common';
import { Favorite, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FavoritesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.FavoriteCreateInput): Promise<Favorite> {
    return this.prisma.favorite.create({ data });
  }

  findOne(userId: string, trackId: string): Promise<Favorite | null> {
    return this.prisma.favorite.findUnique({ where: { userId_trackId: { userId, trackId } } });
  }

  delete(userId: string, trackId: string): Promise<Favorite> {
    return this.prisma.favorite.delete({ where: { userId_trackId: { userId, trackId } } });
  }

  async findMany(params: { skip?: number; take?: number; userId: string }): Promise<Favorite[]> {
    return this.prisma.favorite.findMany({
      where: { userId: params.userId },
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
      include: { track: { include: { artist: { select: { id: true, stageName: true } } } } },
    });
  }

  count(userId: string): Promise<number> {
    return this.prisma.favorite.count({ where: { userId } });
  }
}
