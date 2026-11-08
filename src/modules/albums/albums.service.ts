import { Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AlbumsRepository } from './repositories/albums.repository';
import { ArtistsService } from '../artists/artists.service';
import { CreateAlbumDto, UpdateAlbumDto, AlbumResponseDto, AlbumQueryDto } from './dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { Role } from '../../common/constants/role.enum';

@Injectable()
export class AlbumsService {
  constructor(
    private readonly albumsRepository: AlbumsRepository,
    private readonly artistsService: ArtistsService,
  ) {}

  async create(artistId: string, userId: string, dto: CreateAlbumDto): Promise<AlbumResponseDto> {
    await this.artistsService.assertOwnership(artistId, userId);

    const album = await this.albumsRepository.create({
      title: dto.title,
      type: dto.type,
      releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : undefined,
      artist: { connect: { id: artistId } },
      ...(dto.genreIds?.length
        ? { genres: { create: dto.genreIds.map((genreId) => ({ genreId })) } }
        : {}),
    });

    return this.toResponseDto(album);
  }

  async findById(id: string): Promise<AlbumResponseDto> {
    const album = await this.albumsRepository.findById(id);
    if (!album) {
      throw new NotFoundException('Album not found.');
    }
    return this.toResponseDto(album);
  }

  async update(
    id: string,
    userId: string,
    role: Role,
    dto: UpdateAlbumDto,
  ): Promise<AlbumResponseDto> {
    const album = await this.albumsRepository.findById(id);
    if (!album) {
      throw new NotFoundException('Album not found.');
    }
    if (role !== Role.ADMIN) {
      await this.artistsService.assertOwnership(album.artistId, userId);
    }

    const updated = await this.albumsRepository.update(id, {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.releaseDate !== undefined ? { releaseDate: new Date(dto.releaseDate) } : {}),
    });

    if (dto.genreIds) {
      await this.albumsRepository.setGenres(id, dto.genreIds);
    }

    return this.toResponseDto(updated);
  }

  async remove(id: string, userId: string, role: Role): Promise<void> {
    const album = await this.albumsRepository.findById(id);
    if (!album) {
      throw new NotFoundException('Album not found.');
    }
    if (role !== Role.ADMIN) {
      await this.artistsService.assertOwnership(album.artistId, userId);
    }
    await this.albumsRepository.delete(id);
  }

  async findAll(query: AlbumQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = query.artistId
      ? { artistId: query.artistId, isPublished: true }
      : { isPublished: true };

    const [albums, totalItems] = await Promise.all([
      this.albumsRepository.findMany({
        skip: query.skip,
        take: limit,
        where,
        orderBy: { releaseDate: 'desc' },
      }),
      this.albumsRepository.count(where),
    ]);

    return new PaginatedResultDto(
      albums.map((a) => this.toResponseDto(a)),
      totalItems,
      page,
      limit,
    );
  }

  private toResponseDto(album: Record<string, unknown>): AlbumResponseDto {
    return plainToInstance(AlbumResponseDto, album, { excludeExtraneousValues: true });
  }
}
