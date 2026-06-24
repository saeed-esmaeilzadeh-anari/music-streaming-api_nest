import { Injectable } from '@nestjs/common';
import { Like, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

const TARGET_RELATION_KEY: Record<string, 'trackId' | 'albumId' | 'playlistId' | 'commentId'> = {
  TRACK: 'trackId',
  ALBUM: 'albumId',
  PLAYLIST: 'playlistId',
  COMMENT: 'commentId',
};

@Injectable()
export class LikesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.LikeCreateInput): Promise<Like> {
    return this.prisma.like.create({ data });
  }

  findOne(userId: string, targetType: string, targetId: string): Promise<Like | null> {
    const column = TARGET_RELATION_KEY[targetType];
    return this.prisma.like.findFirst({
      where: { userId, targetType: targetType as never, [column]: targetId },
    });
  }

  delete(id: string): Promise<Like> {
    return this.prisma.like.delete({ where: { id } });
  }

  countForTarget(targetType: string, targetId: string): Promise<number> {
    const column = TARGET_RELATION_KEY[targetType];
    return this.prisma.like.count({
      where: { targetType: targetType as never, [column]: targetId },
    });
  }
}
