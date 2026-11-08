import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../../redis/redis-cache.service';
import { FollowsService } from '../follows/follows.service';
import {
  toPlayableTrack,
  toPlayableArtist,
  toPlayablePlaylist,
} from '../../common/mappers/playable.mappers';
import { RecommendationsQueryDto, RecommendationsResponse, RecommendationSection } from './dto';

type RecommendationTrack = {
  id: string;
  title: string;
  audioUrl: string | null;
  coverUrl: string | null;
  durationSec: number;
  isExplicit: boolean;
  artist: { id: string; stageName: string };
  album: { id: string } | null;
};

/**
 * Home-feed recommendations assembled from listening history, favorites,
 * followed artists and genre affinity. Anonymous visitors receive a cold-start
 * feed; authenticated users receive a feed scoped to their own signals.
 */
@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: RedisCacheService,
    private readonly followsService: FollowsService,
  ) {}

  async getForUser(
    userId: string | undefined,
    query: RecommendationsQueryDto,
  ): Promise<RecommendationsResponse> {
    const take = query.limit ?? 10;
    const cacheKey = this.cacheService.buildKey('recommendations', 'v2', userId ?? 'anon', take);

    const cached = await this.cacheService.get<RecommendationsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const [recentTrackIds, followedArtistIds, genreIds] = userId
      ? await Promise.all([
          this.recentTrackIds(userId, take),
          this.followsService.followedArtistIds(userId),
          this.topGenreIds(userId, take),
        ])
      : [[], [], []];

    const coldStart = !recentTrackIds.length && !followedArtistIds.length && !genreIds.length;
    const seenTrackIds = new Set<string>();
    const sections: RecommendationSection[] = [];

    const addSection = (section: RecommendationSection) => {
      sections.push(this.removeSeenTracks(section, seenTrackIds));
    };

    addSection(await this.recentlyPlayedSection(recentTrackIds, take));
    addSection(await this.newReleasesSection(take, [...seenTrackIds]));
    addSection(await this.trendingSection(take, [...seenTrackIds]));

    const [artists, playlists] = await Promise.all([
      this.artistsForYouSection(followedArtistIds, take),
      this.madeForYouSection(genreIds, followedArtistIds, take),
    ]);
    addSection(artists);
    addSection(playlists);

    addSection(
      await this.becauseYouFollowSection(
        followedArtistIds,
        genreIds,
        take,
        [...seenTrackIds],
      ),
    );

    const response: RecommendationsResponse = {
      sections,
      coldStart,
      generatedAt: new Date().toISOString(),
    };

    await this.cacheService.set(cacheKey, response, 120);
    return response;
  }

  /** Preserve section order while preventing a track from appearing twice. */
  private removeSeenTracks(
    section: RecommendationSection,
    seenTrackIds: Set<string>,
  ): RecommendationSection {
    if (section.type !== 'track') {
      return section;
    }

    const items = section.items.filter((item) => {
      if (!item || typeof item !== 'object' || !('id' in item)) {
        return true;
      }

      const id = (item as { id?: unknown }).id;
      if (typeof id !== 'string') {
        return true;
      }
      if (seenTrackIds.has(id)) {
        return false;
      }

      seenTrackIds.add(id);
      return true;
    });

    return { ...section, items };
  }

  /** Distinct recently played track ids, newest first. */
  private async recentTrackIds(userId: string, take: number): Promise<string[]> {
    const rows = await this.prisma.listeningHistory.findMany({
      where: { userId },
      orderBy: { playedAt: 'desc' },
      select: { trackId: true },
      take: take * 5,
    });
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const row of rows) {
      if (!seen.has(row.trackId)) {
        seen.add(row.trackId);
        ids.push(row.trackId);
      }
      if (ids.length >= take) break;
    }
    return ids;
  }

  /** Rank genres from both recent listening history and explicit favorites. */
  private async topGenreIds(userId: string, take: number): Promise<string[]> {
    const [historyRows, favoriteRows] = await Promise.all([
      this.prisma.listeningHistory.findMany({
        where: { userId },
        orderBy: { playedAt: 'desc' },
        take: take * 5,
        select: {
          track: {
            select: { genres: { select: { genreId: true } } },
          },
        },
      }),
      this.prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: take * 5,
        select: {
          track: {
            select: { genres: { select: { genreId: true } } },
          },
        },
      }),
    ]);

    const counts = new Map<string, number>();
    for (const row of [...historyRows, ...favoriteRows]) {
      for (const genre of row.track?.genres ?? []) {
        counts.set(genre.genreId, (counts.get(genre.genreId) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, Math.min(5, take))
      .map(([genreId]) => genreId);
  }

  private async tracksWhereIdsIn(ids: string[], take: number) {
    if (!ids.length) return [];
    const rows = await this.prisma.track.findMany({
      where: {
        id: { in: ids },
        status: 'PUBLISHED',
        audioUrl: { not: null },
      },
      take,
      include: {
        artist: { select: { id: true, stageName: true } },
        album: { select: { id: true } },
      },
    });
    const byId = new Map(rows.map((track) => [track.id, track]));
    return ids.map((id) => byId.get(id)).filter((track): track is (typeof rows)[number] => Boolean(track));
  }

  private async recentlyPlayedSection(
    recentTrackIds: string[],
    take: number,
  ): Promise<RecommendationSection> {
    if (recentTrackIds.length) {
      const tracks = await this.tracksWhereIdsIn(recentTrackIds, take);
      if (tracks.length) {
        return {
          id: 'recently-played',
          type: 'track',
          items: tracks.map(toPlayableTrack),
        };
      }
    }
    return {
      id: 'recently-played',
      type: 'track',
      items: (await this.popularTracks(take)).map(toPlayableTrack),
    };
  }

  private async newReleasesSection(
    take: number,
    excludeIds: string[] = [],
  ): Promise<RecommendationSection> {
    const tracks = await this.prisma.track.findMany({
      where: {
        status: 'PUBLISHED',
        audioUrl: { not: null },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        artist: { select: { id: true, stageName: true } },
        album: { select: { id: true } },
      },
    });
    return { id: 'new-releases', type: 'track', items: tracks.map(toPlayableTrack) };
  }

  private async trendingSection(
    take: number,
    excludeIds: string[] = [],
  ): Promise<RecommendationSection> {
    return {
      id: 'trending',
      type: 'track',
      items: (await this.popularTracks(take, excludeIds)).map(toPlayableTrack),
    };
  }

  private async popularTracks(take: number, excludeIds: string[] = []) {
    return this.prisma.track.findMany({
      where: {
        status: 'PUBLISHED',
        audioUrl: { not: null },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      orderBy: { playCount: 'desc' },
      take,
      include: {
        artist: { select: { id: true, stageName: true } },
        album: { select: { id: true } },
      },
    });
  }

  private async artistsForYouSection(
    followedArtistIds: string[],
    take: number,
  ): Promise<RecommendationSection> {
    const artists = await this.prisma.artist.findMany({
      where: followedArtistIds.length
        ? { id: { notIn: followedArtistIds } }
        : {},
      orderBy: { monthlyListeners: 'desc' },
      take,
      include: { user: { select: { avatarUrl: true } } },
    });
    return { id: 'artists-for-you', type: 'artist', items: artists.map(toPlayableArtist) };
  }

  private async publicPlaylists(take: number): Promise<RecommendationSection> {
    const playlists = await this.prisma.playlist.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: { updatedAt: 'desc' },
      take,
      include: {
        owner: { select: { username: true } },
        _count: { select: { tracks: true } },
      },
    });
    return { id: 'made-for-you', type: 'playlist', items: playlists.map(toPlayablePlaylist) };
  }

  private async madeForYouSection(
    genreIds: string[],
    followedArtistIds: string[],
    take: number,
  ): Promise<RecommendationSection> {
    const filters: Prisma.PlaylistWhereInput[] = [
      ...(genreIds.length
        ? [{
            tracks: {
              some: {
                track: {
                  genres: { some: { genreId: { in: genreIds } } },
                },
              },
            },
          }]
        : []),
      ...(followedArtistIds.length
        ? [{
            tracks: {
              some: {
                track: { artistId: { in: followedArtistIds } },
              },
            },
          }]
        : []),
    ];

    if (!filters.length) {
      return this.publicPlaylists(take);
    }

    const playlists = await this.prisma.playlist.findMany({
      where: {
        visibility: 'PUBLIC',
        OR: filters,
      },
      orderBy: { updatedAt: 'desc' },
      take,
      include: {
        owner: { select: { username: true } },
        _count: { select: { tracks: true } },
      },
    });

    return playlists.length
      ? { id: 'made-for-you', type: 'playlist', items: playlists.map(toPlayablePlaylist) }
      : this.publicPlaylists(take);
  }

  private async becauseYouFollowSection(
    followedArtistIds: string[],
    genreIds: string[],
    take: number,
    excludeIds: string[] = [],
  ): Promise<RecommendationSection> {
    const include = {
      artist: { select: { id: true, stageName: true } },
      album: { select: { id: true } },
    };
    const commonWhere = {
      status: 'PUBLISHED' as const,
      audioUrl: { not: null },
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
    };

    let tracks: RecommendationTrack[] = [];

    if (followedArtistIds.length) {
      tracks = await this.prisma.track.findMany({
        where: { ...commonWhere, artistId: { in: followedArtistIds } },
        orderBy: { playCount: 'desc' },
        take,
        include,
      });
    }

    if (!tracks.length && genreIds.length) {
      tracks = await this.prisma.track.findMany({
        where: {
          ...commonWhere,
          genres: { some: { genreId: { in: genreIds } } },
        },
        orderBy: { playCount: 'desc' },
        take,
        include,
      });
    }

    if (!tracks.length) {
      tracks = await this.popularTracks(take, excludeIds);
    }

    return {
      id: 'because-you-follow',
      type: 'track',
      items: tracks.map(toPlayableTrack),
    };
  }
}
