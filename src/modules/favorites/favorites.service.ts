import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { FavoritesRepository } from './repositories/favorites.repository';
import { FavoriteResponseDto } from './dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';

@Injectable()
export class FavoritesService {
  constructor(private readonly favoritesRepository: FavoritesRepository) {}

  async add(userId: string, trackId: string): Promise<FavoriteResponseDto> {
    const existing = await this.favoritesRepository.findOne(userId, trackId);
    if (existing) {
      throw new ConflictException('This track is already in your favorites.');
    }
    const favorite = await this.favoritesRepository.create({
      user: { connect: { id: userId } },
      track: { connect: { id: trackId } },
    });
    return plainToInstance(FavoriteResponseDto, favorite, { excludeExtraneousValues: true });
  }

  async remove(userId: string, trackId: string): Promise<void> {
    const existing = await this.favoritesRepository.findOne(userId, trackId);
    if (!existing) {
      throw new NotFoundException('This track is not in your favorites.');
    }
    await this.favoritesRepository.delete(userId, trackId);
  }

  async findAll(userId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [favorites, totalItems] = await Promise.all([
      this.favoritesRepository.findMany({ userId, skip: query.skip, take: limit }),
      this.favoritesRepository.count(userId),
    ]);

    return new PaginatedResultDto(
      favorites.map((f) =>
        plainToInstance(FavoriteResponseDto, f, { excludeExtraneousValues: true }),
      ),
      totalItems,
      page,
      limit,
    );
  }
}
