import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TracksRepository, TrackWithArtist } from './repositories/tracks.repository';
import { ArtistsRepository } from '../artists/repositories/artists.repository';
import { CreateTrackDto, UpdateTrackDto, TrackQueryDto, TrackResponseDto } from './dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { RedisCacheService } from '../../redis/redis-cache.service';
import { DOMAIN_EVENTS, TrackPlayedEvent } from '../../events';
import { Role } from '../../common/constants/role.enum';

@Injectable()
export class TracksService {
  private readonly cachePrefix = 'tracks';

  constructor(
    private readonly tracksRepository: TracksRepository,
    private readonly artistsRepository: ArtistsRepository,
    private readonly cacheService: RedisCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    artistId: string,
    requesterId: string,
    requesterRole: Role,
    dto: CreateTrackDto,
  ): Promise<TrackResponseDto> {
    await this.assertArtistOwnership(artistId, requesterId, requesterRole);

    const track = await this.tracksRepository.create({
      title: dto.title,
      isExplicit: dto.isExplicit ?? false,
      artist: { connect: { id: artistId } },
      ...(dto.albumId ? { album: { connect: { id: dto.albumId } } } : {}),
      ...(dto.genreIds?.length
        ? { genres: { create: dto.genreIds.map((genreId) => ({ genreId })) } }
        : {}),
    });

    await this.invalidateListCache();
    return this.toResponseDto(track);
  }

  async findById(id: string): Promise<TrackResponseDto> {
    const track = await this.findOrThrow(id);
    return this.toResponseDto(track);
  }

  async update(
    id: string,
    requesterId: string,
    requesterRole: Role,
    dto: UpdateTrackDto,
  ): Promise<TrackResponseDto> {
    const track = await this.findOrThrow(id);
    await this.assertArtistOwnership(track.artistId, requesterId, requesterRole);

    const updated = await this.tracksRepository.update(id, {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.isExplicit !== undefined ? { isExplicit: dto.isExplicit } : {}),
      ...(dto.albumId !== undefined
        ? dto.albumId
          ? { album: { connect: { id: dto.albumId } } }
          : { album: { disconnect: true } }
        : {}),
    });

    if (dto.genreIds) {
      await this.tracksRepository.setGenres(id, dto.genreIds);
    }

    await this.invalidateListCache();
    await this.cacheService.del(this.cacheService.buildKey(this.cachePrefix, 'detail', id));

    return this.toResponseDto(updated);
  }

  async remove(id: string, requesterId: string, requesterRole: Role): Promise<void> {
    const track = await this.findOrThrow(id);
    await this.assertArtistOwnership(track.artistId, requesterId, requesterRole);
    await this.tracksRepository.delete(id);
    await this.invalidateListCache();
  }

  async findAll(query: TrackQueryDto): Promise<PaginatedResultDto<TrackResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.TrackWhereInput = {
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(query.artistId ? { artistId: query.artistId } : {}),
      ...(query.albumId ? { albumId: query.albumId } : {}),
      ...(query.status ? { status: query.status } : { status: 'PUBLISHED' }),
      ...(query.genreId ? { genres: { some: { genreId: query.genreId } } } : {}),
    };

    const [tracks, totalItems] = await Promise.all([
      this.tracksRepository.findMany({
        skip: query.skip,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.tracksRepository.count(where),
    ]);

    return new PaginatedResultDto(
      tracks.map((t) => this.toResponseDto(t)),
      totalItems,
      page,
      limit,
    );
  }

  /**
   * Records a play. Emits TRACK_PLAYED so ListeningHistory and Notifications
   * modules can react independently (event-driven decoupling) instead of
   * TracksService reaching into their repositories directly.
   */
  async registerPlay(trackId: string, userId: string, progressSec: number): Promise<void> {
    await this.findOrThrow(trackId);
    await this.tracksRepository.incrementPlayCount(trackId);
    this.eventEmitter.emit(
      DOMAIN_EVENTS.TRACK_PLAYED,
      new TrackPlayedEvent(userId, trackId, progressSec),
    );
  }

  private async findOrThrow(id: string): Promise<TrackWithArtist> {
    const track = await this.tracksRepository.findById(id);
    if (!track) {
      throw new NotFoundException('Track not found.');
    }
    return track;
  }

  private async assertArtistOwnership(artistId: string, userId: string, role: Role) {
    if (role === Role.ADMIN || role === Role.MODERATOR) {
      return; // staff can manage any track
    }
    const artist = await this.artistsRepository.findById(artistId);
    if (!artist) {
      throw new NotFoundException('Artist not found.');
    }
    if (artist.userId !== userId) {
      throw new ForbiddenException('You do not have permission to manage this track.');
    }
  }

  private async invalidateListCache(): Promise<void> {
    await this.cacheService.delByPrefix(this.cacheService.buildKey(this.cachePrefix, 'list'));
  }

  private toResponseDto(track: TrackWithArtist): TrackResponseDto {
    return plainToInstance(
      TrackResponseDto,
      { ...track, playCount: track.playCount.toString() },
      { excludeExtraneousValues: true },
    );
  }
}
