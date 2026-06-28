import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommentsRepository } from './repositories/comments.repository';
import { CreateCommentDto, UpdateCommentDto, CommentResponseDto } from './dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { DOMAIN_EVENTS, CommentCreatedEvent } from '../../events';

const TARGET_RELATION_KEY: Record<string, 'track' | 'album' | 'playlist'> = {
  TRACK: 'track',
  ALBUM: 'album',
  PLAYLIST: 'playlist',
};

@Injectable()
export class CommentsService {
  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(userId: string, dto: CreateCommentDto): Promise<CommentResponseDto> {
    const relationKey = TARGET_RELATION_KEY[dto.targetType];

    if (dto.parentId) {
      const parent = await this.commentsRepository.findById(dto.parentId);
      if (!parent) {
        throw new NotFoundException('Parent comment not found.');
      }
    }

    const comment = await this.commentsRepository.create({
      content: dto.content,
      targetType: dto.targetType,
      user: { connect: { id: userId } },
      [relationKey]: { connect: { id: dto.targetId } },
      ...(dto.parentId ? { parent: { connect: { id: dto.parentId } } } : {}),
    });

    this.eventEmitter.emit(
      DOMAIN_EVENTS.COMMENT_CREATED,
      new CommentCreatedEvent(comment.id, userId, dto.targetType, null),
    );

    return this.toResponseDto(comment);
  }

  async update(id: string, userId: string, dto: UpdateCommentDto): Promise<CommentResponseDto> {
    const comment = await this.assertOwnership(id, userId);
    const updated = await this.commentsRepository.update(comment.id, {
      content: dto.content,
      isEdited: true,
    });
    return this.toResponseDto(updated);
  }

  async remove(id: string, userId: string, isStaff: boolean): Promise<void> {
    const comment = await this.commentsRepository.findById(id);
    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }
    if (comment.userId !== userId && !isStaff) {
      throw new ForbiddenException('You do not have permission to delete this comment.');
    }
    await this.commentsRepository.delete(id);
  }

  async findByTarget(targetType: string, targetId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [comments, totalItems] = await Promise.all([
      this.commentsRepository.findByTarget({
        targetType,
        targetId,
        skip: query.skip,
        take: limit,
      }),
      this.commentsRepository.countByTarget(targetType, targetId),
    ]);

    return new PaginatedResultDto(
      comments.map((c) => this.toResponseDto(c)),
      totalItems,
      page,
      limit,
    );
  }

  private async assertOwnership(id: string, userId: string) {
    const comment = await this.commentsRepository.findById(id);
    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }
    if (comment.userId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this comment.');
    }
    return comment;
  }

  private toResponseDto(comment: Record<string, unknown>): CommentResponseDto {
    return plainToInstance(CommentResponseDto, comment, { excludeExtraneousValues: true });
  }
}
