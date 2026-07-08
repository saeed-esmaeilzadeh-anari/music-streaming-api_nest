import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlaylistsRepository } from './repositories/playlists.repository';
import {
  CreatePlaylistDto,
  UpdatePlaylistDto,
  AddTrackToPlaylistDto,
  PlaylistResponseDto,
} from './dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { DOMAIN_EVENTS, PlaylistTrackAddedEvent } from '../../events';

@Injectable()
export class PlaylistsService {
  constructor(
    private readonly playlistsRepository: PlaylistsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(ownerId: string, dto: CreatePlaylistDto): Promise<PlaylistResponseDto> {
    const playlist = await this.playlistsRepository.create({
      title: dto.title,
      description: dto.description,
      visibility: dto.visibility,
      owner: { connect: { id: ownerId } },
    });
    return this.toResponseDto(playlist);
  }

  async findById(id: string, requesterId?: string): Promise<PlaylistResponseDto> {
    const playlist = await this.playlistsRepository.findById(id);
    if (!playlist) {
      throw new NotFoundException('Playlist not found.');
    }
    this.assertReadAccess(playlist, requesterId);
    return this.toResponseDto(playlist);
  }

  async update(id: string, userId: string, dto: UpdatePlaylistDto): Promise<PlaylistResponseDto> {
    const playlist = await this.assertOwnership(id, userId);
    const updated = await this.playlistsRepository.update(playlist.id, dto);
    return this.toResponseDto(updated);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.assertOwnership(id, userId);
    await this.playlistsRepository.delete(id);
  }

  async findOwn(userId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { ownerId: userId };

    const [playlists, totalItems] = await Promise.all([
      this.playlistsRepository.findMany({
        skip: query.skip,
        take: limit,
        where,
        orderBy: { updatedAt: 'desc' },
      }),
      this.playlistsRepository.count(where),
    ]);

    return new PaginatedResultDto(
      playlists.map((p) => this.toResponseDto(p)),
      totalItems,
      page,
      limit,
    );
  }

  async addTrack(playlistId: string, userId: string, dto: AddTrackToPlaylistDto): Promise<void> {
    const playlist = await this.assertOwnership(playlistId, userId);

    const existingEntry = await this.playlistsRepository.findTrackEntry(playlist.id, dto.trackId);
    if (existingEntry) {
      throw new ConflictException('This track is already in the playlist.');
    }

    const position =
      dto.position ?? (await this.playlistsRepository.getMaxTrackPosition(playlist.id)) + 1;

    await this.playlistsRepository.addTrack(playlist.id, dto.trackId, position);

    this.eventEmitter.emit(
      DOMAIN_EVENTS.PLAYLIST_TRACK_ADDED,
      new PlaylistTrackAddedEvent(playlist.id, dto.trackId, userId),
    );
  }

  async removeTrack(playlistId: string, trackId: string, userId: string): Promise<void> {
    const playlist = await this.assertOwnership(playlistId, userId);
    const entry = await this.playlistsRepository.findTrackEntry(playlist.id, trackId);
    if (!entry) {
      throw new NotFoundException('This track is not in the playlist.');
    }
    await this.playlistsRepository.removeTrack(playlist.id, trackId);
  }

  async reorderTrack(
    playlistId: string,
    trackId: string,
    userId: string,
    position: number,
  ): Promise<void> {
    const playlist = await this.assertOwnership(playlistId, userId);
    const entry = await this.playlistsRepository.findTrackEntry(playlist.id, trackId);
    if (!entry) {
      throw new NotFoundException('This track is not in the playlist.');
    }
    await this.playlistsRepository.updateTrackPosition(playlist.id, trackId, position);
  }

  private async assertOwnership(playlistId: string, userId: string) {
    const playlist = await this.playlistsRepository.findById(playlistId);
    if (!playlist) {
      throw new NotFoundException('Playlist not found.');
    }
    if (playlist.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to manage this playlist.');
    }
    return playlist;
  }

  private assertReadAccess(
    playlist: { visibility: string; ownerId: string },
    requesterId?: string,
  ) {
    if (playlist.visibility === 'PRIVATE' && playlist.ownerId !== requesterId) {
      throw new ForbiddenException('This playlist is private.');
    }
  }

  private toResponseDto(playlist: Record<string, unknown>): PlaylistResponseDto {
    return plainToInstance(PlaylistResponseDto, playlist, { excludeExtraneousValues: true });
  }
}
