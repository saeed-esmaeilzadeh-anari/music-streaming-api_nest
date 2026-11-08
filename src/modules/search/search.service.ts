import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../../redis/redis-cache.service';
import { SearchQueryDto, SearchEntityType, SearchResultDto } from './dto';
import {
  toPlayableTrack,
  toPlayableAlbum,
  toPlayableArtist,
  toPlayablePlaylist,
  toGenreDto,
} from '../../common/mappers/playable.mappers';

/**
 * Cross-entity search. Intentionally talks to PrismaService directly rather
 * than through per-entity repositories: search is a read-only fan-out query
 * that doesn't "own" any table, so adding a repository layer here would just
 * be indirection without a behavioral benefit. This is a deliberate
 * exception to the Repository Pattern used elsewhere, not an oversight -
 * if full-text search needs (e.g.) Postgres tsvector or an external engine
 * like Meilisearch/Elasticsearch later, this service is the single seam to
 * swap the implementation behind.
 *
 * Results are returned in "playable" shapes (see common/mappers): every
 * track carries its audio URL, cover, duration and artist/album references
 * so clients can queue and play a search hit without extra round-trips.
 * Genres matching the term are included so browse and search share one
 * endpoint.
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
      'v2',
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

    const [tracks, albums, artists, playlists, genres] = await Promise.all([
      type === SearchEntityType.ALL || type === SearchEntityType.TRACK
        ? this.prisma.track.findMany({
            where: { title: { contains: term, mode: 'insensitive' }, status: 'PUBLISHED' },
            take,
            skip,
            orderBy: { playCount: 'desc' },
            include: {
              artist: { select: { id: true, stageName: true } },
              album: { select: { id: true } },
            },
          })
        : Promise.resolve([]),
      type === SearchEntityType.ALL || type === SearchEntityType.ALBUM
        ? this.prisma.album.findMany({
            where: { title: { contains: term, mode: 'insensitive' }, isPublished: true },
            take,
            skip,
            include: { artist: { select: { id: true, stageName: true } } },
          })
        : Promise.resolve([]),
      type === SearchEntityType.ALL || type === SearchEntityType.ARTIST
        ? this.prisma.artist.findMany({
            where: { stageName: { contains: term, mode: 'insensitive' } },
            take,
            skip,
            orderBy: { monthlyListeners: 'desc' },
            include: { user: { select: { avatarUrl: true } } },
          })
        : Promise.resolve([]),
      type === SearchEntityType.ALL || type === SearchEntityType.PLAYLIST
        ? this.prisma.playlist.findMany({
            where: { title: { contains: term, mode: 'insensitive' }, visibility: 'PUBLIC' },
            take,
            skip,
            include: {
              owner: { select: { username: true } },
              _count: { select: { tracks: true } },
            },
          })
        : Promise.resolve([]),
      type === SearchEntityType.ALL
        ? this.prisma.genre.findMany({
            where: {
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { slug: { contains: term, mode: 'insensitive' } },
              ],
            },
            take: Math.min(take, 10),
          })
        : Promise.resolve([]),
    ]);

    const result: SearchResultDto = {
      tracks: tracks.map(toPlayableTrack),
      albums: albums.map(toPlayableAlbum),
      artists: artists.map(toPlayableArtist),
      playlists: playlists.map(toPlayablePlaylist),
      genres: genres.map(toGenreDto),
    };

    await this.cacheService.set(cacheKey, result, 30);
    return result;
  }
}
