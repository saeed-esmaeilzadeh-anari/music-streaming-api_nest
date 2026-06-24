import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { GenresRepository } from './repositories/genres.repository';
import { CreateGenreDto, UpdateGenreDto, GenreResponseDto } from './dto';
import { slugify } from '../../common/utils/slugify.util';
import { RedisCacheService } from '../../redis/redis-cache.service';

@Injectable()
export class GenresService {
  private readonly cacheKey = 'genres:all';

  constructor(
    private readonly genresRepository: GenresRepository,
    private readonly cacheService: RedisCacheService,
  ) {}

  async create(dto: CreateGenreDto): Promise<GenreResponseDto> {
    const slug = slugify(dto.name);
    const existing = await this.genresRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictException('A genre with this name already exists.');
    }

    const genre = await this.genresRepository.create({
      name: dto.name,
      slug,
      description: dto.description,
    });

    await this.cacheService.del(this.cacheKey);
    return this.toResponseDto(genre);
  }

  async findAll(): Promise<GenreResponseDto[]> {
    const cached = await this.cacheService.get<GenreResponseDto[]>(this.cacheKey);
    if (cached) {
      return cached;
    }

    const genres = await this.genresRepository.findAll();
    const dtos = genres.map((g) => this.toResponseDto(g));
    await this.cacheService.set(this.cacheKey, dtos, 300);
    return dtos;
  }

  async findById(id: string): Promise<GenreResponseDto> {
    const genre = await this.genresRepository.findById(id);
    if (!genre) {
      throw new NotFoundException('Genre not found.');
    }
    return this.toResponseDto(genre);
  }

  async update(id: string, dto: UpdateGenreDto): Promise<GenreResponseDto> {
    await this.findById(id);
    const updated = await this.genresRepository.update(id, {
      ...(dto.name ? { name: dto.name, slug: slugify(dto.name) } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
    });
    await this.cacheService.del(this.cacheKey);
    return this.toResponseDto(updated);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.genresRepository.delete(id);
    await this.cacheService.del(this.cacheKey);
  }

  private toResponseDto(genre: Record<string, unknown>): GenreResponseDto {
    return plainToInstance(GenreResponseDto, genre, { excludeExtraneousValues: true });
  }
}
