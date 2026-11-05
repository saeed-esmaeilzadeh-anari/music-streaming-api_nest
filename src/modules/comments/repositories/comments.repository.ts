import { Injectable } from '@nestjs/common';
import { Comment, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CommentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.CommentCreateInput): Promise<Comment> {
    return this.prisma.comment.create({ data });
  }

  findById(id: string): Promise<Comment | null> {
    return this.prisma.comment.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.CommentUpdateInput): Promise<Comment> {
    return this.prisma.comment.update({ where: { id }, data });
  }

  delete(id: string): Promise<Comment> {
    return this.prisma.comment.delete({ where: { id } });
  }

  async findTargetOwnerId(targetType: string, targetId: string): Promise<string | null> {
    switch (targetType) {
      case 'TRACK': {
        const target = await this.prisma.track.findUnique({
          where: { id: targetId },
          select: { artist: { select: { userId: true } } },
        });
        return target?.artist.userId ?? null;
      }
      case 'ALBUM': {
        const target = await this.prisma.album.findUnique({
          where: { id: targetId },
          select: { artist: { select: { userId: true } } },
        });
        return target?.artist.userId ?? null;
      }
      case 'PLAYLIST': {
        const target = await this.prisma.playlist.findUnique({
          where: { id: targetId },
          select: { ownerId: true },
        });
        return target?.ownerId ?? null;
      }
      default:
        return null;
    }
  }

  async findByTarget(params: {
    targetType: string;
    targetId: string;
    skip?: number;
    take?: number;
  }): Promise<Comment[]> {
    const targetColumn = this.targetColumn(params.targetType);
    return this.prisma.comment.findMany({
      where: {
        targetType: params.targetType as never,
        [targetColumn]: params.targetId,
        parentId: null,
      },
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
      include: { replies: { orderBy: { createdAt: 'asc' } } },
    });
  }

  countByTarget(targetType: string, targetId: string): Promise<number> {
    const targetColumn = this.targetColumn(targetType);
    return this.prisma.comment.count({
      where: { targetType: targetType as never, [targetColumn]: targetId, parentId: null },
    });
  }

  private targetColumn(targetType: string): 'trackId' | 'albumId' | 'playlistId' {
    switch (targetType) {
      case 'TRACK':
        return 'trackId';
      case 'ALBUM':
        return 'albumId';
      case 'PLAYLIST':
        return 'playlistId';
      default:
        throw new Error(`Unsupported comment target type: ${targetType}`);
    }
  }
}
