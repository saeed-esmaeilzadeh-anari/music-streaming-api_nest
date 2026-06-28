import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ArtistsRepository } from './repositories/artists.repository';
import { CreateArtistDto, UpdateArtistDto, ArtistResponseDto } from './dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';

@Injectable()
export class ArtistsService {
  constructor(private readonly artistsRepository: ArtistsRepository) {}

  async createProfile(userId: string, dto: CreateArtistDto): Promise<ArtistResponseDto> {
    const existing = await this.artistsRepository.findByUserId(userId);
    if (existing) {
      throw new ConflictException('An artist profile already exists for this account.');
    }

    const artist = await this.artistsRepository.create({
      stageName: dto.stageName,
      bio: dto.bio,
      user: { connect: { id: userId } },
    });

    return this.toResponseDto(artist);
  }

  async findById(id: string): Promise<ArtistResponseDto> {
    const artist = await this.artistsRepository.findById(id);
    if (!artist) {
      throw new NotFoundException('Artist not found.');
    }
    return this.toResponseDto(artist);
  }

  async findByUserId(userId: string): Promise<ArtistResponseDto> {
    const artist = await this.artistsRepository.findByUserId(userId);
    if (!artist) {
      throw new NotFoundException('No artist profile exists for this account.');
    }
    return this.toResponseDto(artist);
  }

  async update(id: string, userId: string, dto: UpdateArtistDto): Promise<ArtistResponseDto> {
    const artist = await this.assertOwnership(id, userId);
    const updated = await this.artistsRepository.update(artist.id, dto);
    return this.toResponseDto(updated);
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResultDto<ArtistResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [artists, totalItems] = await Promise.all([
      this.artistsRepository.findMany({
        skip: query.skip,
        take: limit,
        orderBy: { monthlyListeners: 'desc' },
      }),
      this.artistsRepository.count(),
    ]);

    return new PaginatedResultDto(
      artists.map((a) => this.toResponseDto(a)),
      totalItems,
      page,
      limit,
    );
  }

  /**
   * Used by TracksService/AlbumsService to confirm the requesting user owns
   * the artist profile they're trying to publish content under. Admins and
   * moderators bypass this check at the controller/service call site instead
   * of here, since ownership is purely about the artist<->user relationship.
   */
  async assertOwnership(artistId: string, userId: string) {
    const artist = await this.artistsRepository.findById(artistId);
    if (!artist) {
      throw new NotFoundException('Artist not found.');
    }
    if (artist.userId !== userId) {
      throw new ForbiddenException('You do not have permission to manage this artist profile.');
    }
    return artist;
  }

  private toResponseDto(artist: Record<string, unknown>): ArtistResponseDto {
    return plainToInstance(ArtistResponseDto, artist, {
      excludeExtraneousValues: true,
    });
  }
}
