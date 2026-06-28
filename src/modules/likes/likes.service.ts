import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LikesRepository } from './repositories/likes.repository';
import { CreateLikeDto, LikeResponseDto } from './dto';
import { DOMAIN_EVENTS, LikeCreatedEvent } from '../../events';

const TARGET_RELATION_KEY: Record<string, 'track' | 'album' | 'playlist' | 'comment'> = {
  TRACK: 'track',
  ALBUM: 'album',
  PLAYLIST: 'playlist',
  COMMENT: 'comment',
};

@Injectable()
export class LikesService {
  constructor(
    private readonly likesRepository: LikesRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async like(userId: string, dto: CreateLikeDto): Promise<LikeResponseDto> {
    const existing = await this.likesRepository.findOne(userId, dto.targetType, dto.targetId);
    if (existing) {
      throw new ConflictException('You have already liked this item.');
    }

    const relationKey = TARGET_RELATION_KEY[dto.targetType];
    const like = await this.likesRepository.create({
      user: { connect: { id: userId } },
      targetType: dto.targetType,
      [relationKey]: { connect: { id: dto.targetId } },
    });

    this.eventEmitter.emit(
      DOMAIN_EVENTS.LIKE_CREATED,
      new LikeCreatedEvent(userId, dto.targetType, dto.targetId, null),
    );

    return plainToInstance(LikeResponseDto, like, { excludeExtraneousValues: true });
  }

  async unlike(userId: string, targetType: string, targetId: string): Promise<void> {
    const existing = await this.likesRepository.findOne(userId, targetType, targetId);
    if (!existing) {
      throw new NotFoundException('Like not found.');
    }
    await this.likesRepository.delete(existing.id);
  }

  async count(targetType: string, targetId: string): Promise<number> {
    return this.likesRepository.countForTarget(targetType, targetId);
  }
}
