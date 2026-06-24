import { Injectable } from '@nestjs/common';
import { ListeningHistory, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ListeningHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ListeningHistoryCreateInput): Promise<ListeningHistory> {
    return this.prisma.listeningHistory.create({ data });
  }

  async findMany(params: {
    userId: string;
    skip?: number;
    take?: number;
  }): Promise<ListeningHistory[]> {
    return this.prisma.listeningHistory.findMany({
      where: { userId: params.userId },
      skip: params.skip,
      take: params.take,
      orderBy: { playedAt: 'desc' },
      include: { track: { include: { artist: { select: { id: true, stageName: true } } } } },
    });
  }

  count(userId: string): Promise<number> {
    return this.prisma.listeningHistory.count({ where: { userId } });
  }
}
