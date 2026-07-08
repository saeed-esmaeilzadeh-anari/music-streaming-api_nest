import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../../redis/redis-cache.service';
import { SearchQueryDto, SearchEntityType, SearchResultDto } from './dto';

/**
 * Cross-entity search. Intentionally talks to PrismaService directly rather
 * than through per-entity repositories: search is a read-only fan-out query
 * that doesn't "own" any table, so adding a repository layer here would just
 * be indirection without a behavioral benefit. This is a deliberate
 * exception to the Repository Pattern used elsewhere, not an oversight -
 * if full-text search needs (e.g.) Postgres tsvector or an external engine
 * like Meilisearch/Elasticsearch later, this service is the single seam to
 * swap the implementation behind.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: RedisCacheService,
  ) {}

  async search(query: SearchQueryDto): Promise<SearchResultDto> {
    const cacheKey = this.cacheService.buildKey(
      'search',
      query.type ?? 'ALL',
      query.q,
      query.page ?? 1,
    );
    const cached = await this.cacheService.get<SearchResultDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const type = query.type ?? SearchEntityType.ALL;
    const take = query.limit ?? 20;
    const skip = query.skip;
    const term = query.q;

    const [tracks, albums, artists, playlists] = await Promise.all([
      type === SearchEntityType.ALL || type === SearchEntityType.TRACK
        ? this.prisma.track.findMany({
            where: { title: { contains: term, mode: 'insensitive' }, status: 'PUBLISHED' },
            take,
            skip,
            include: { artist: { select: { stageName: true } } },
          })
        : Promise.resolve([]),
      type === SearchEntityType.ALL || type === SearchEntityType.ALBUM
        ? this.prisma.album.findMany({
            where: { title: { contains: term, mode: 'insensitive' }, isPublished: true },
            take,
            skip,
            include: { artist: { select: { stageName: true } } },
          })
        : Promise.resolve([]),
      type === SearchEntityType.ALL || type === SearchEntityType.ARTIST
        ? this.prisma.artist.findMany({
            where: { stageName: { contains: term, mode: 'insensitive' } },
            take,
            skip,
          })
        : Promise.resolve([]),
      type === SearchEntityType.ALL || type === SearchEntityType.PLAYLIST
        ? this.prisma.playlist.findMany({
            where: { title: { contains: term, mode: 'insensitive' }, visibility: 'PUBLIC' },
            take,
            skip,
          })
        : Promise.resolve([]),
    ]);

    const result: SearchResultDto = {
      tracks: tracks.map((t) => ({ id: t.id, title: t.title, artistName: t.artist.stageName })),
      albums: albums.map((a) => ({ id: a.id, title: a.title, artistName: a.artist.stageName })),
      artists: artists.map((a) => ({ id: a.id, stageName: a.stageName })),
      playlists: playlists.map((p) => ({ id: p.id, title: p.title })),
    };

    await this.cacheService.set(cacheKey, result, 30);
    return result;
  }
}
