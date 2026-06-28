import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { ListeningHistoryRepository } from './repositories/listening-history.repository';
import { ListeningHistoryResponseDto } from './dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { DOMAIN_EVENTS, TrackPlayedEvent } from '../../events';

/**
 * Demonstrates the event-driven architecture requirement end to end:
 * TracksService.registerPlay() has zero knowledge of this module - it just
 * emits DOMAIN_EVENTS.TRACK_PLAYED. This listener reacts independently,
 * writing the history record. New consumers (analytics, recommendations)
 * can subscribe to the same event without touching TracksService.
 */
@Injectable()
export class ListeningHistoryService {
  private readonly logger = new Logger(ListeningHistoryService.name);

  constructor(private readonly listeningHistoryRepository: ListeningHistoryRepository) {}

  @OnEvent(DOMAIN_EVENTS.TRACK_PLAYED, { async: true })
  async handleTrackPlayed(event: TrackPlayedEvent): Promise<void> {
    try {
      await this.listeningHistoryRepository.create({
        user: { connect: { id: event.userId } },
        track: { connect: { id: event.trackId } },
        progressSec: event.progressSec,
        completed: event.progressSec >= 30, // simplistic completion heuristic
      });
    } catch (error) {
      this.logger.error(
        `Failed to record listening history for user ${event.userId} / track ${event.trackId}: ${error}`,
      );
    }
  }

  async findOwn(userId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [history, totalItems] = await Promise.all([
      this.listeningHistoryRepository.findMany({ userId, skip: query.skip, take: limit }),
      this.listeningHistoryRepository.count(userId),
    ]);

    return new PaginatedResultDto(
      history.map((h) =>
        plainToInstance(ListeningHistoryResponseDto, h, { excludeExtraneousValues: true }),
      ),
      totalItems,
      page,
      limit,
    );
  }
}
