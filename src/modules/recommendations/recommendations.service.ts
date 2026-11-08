import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../../redis/redis-cache.service';
import { FollowsService } from '../follows/follows.service';
import {
  toPlayableTrack,
  toPlayableArtist,
  toPlayablePlaylist,
} from '../../common/mappers/playable.mappers';
import { RecommendationsQueryDto, RecommendationsResponse, RecommendationSection } from './dto';

/**
 * Home-feed recommendations: six stable sections assembled from listening
 * history, the follow graph and global popularity signals.
 *
 * Cold-start contract: a user with no plays and no follows (or an anonymous
 * visitor) still gets a full six-section feed built from trending tracks,
 * top artists, new releases and public playlists - the response flags this
 * with `coldStart: true`.
 *
 * The endpoint is @Public(): personalized sections simply fall back when
 * request.user is absent. Per-user results are cached for a short TTL.
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
    const cacheKey = this.cacheService.buildKey('recommendations', 'v1', userId ?? 'anon', take);

    const cached = await this.cacheService.get<RecommendationsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const [recentTrackIds, followedArtistIds] = userId
      ? await Promise.all([
          this.recentTrackIds(userId, take),
          this.followsService.followedArtistIds(userId),
        ])
      : [[], []];

    const coldStart = !recentTrackIds.length && !followedArtistIds.length;

    const sections: RecommendationSection[] = await Promise.all([
      this.recentlyPlayedSection(recentTrackIds, take),
      this.newReleasesSection(take),
      this.trendingSection(take),
      this.artistsForYouSection(followedArtistIds, take),
      this.madeForYouSection(take),
      this.becauseYouFollowSection(followedArtistIds, take),
    ]);

    const response: RecommendationsResponse = {
      sections,
      coldStart,
      generatedAt: new Date().toISOString(),
    };

    await this.cacheService.set(cacheKey, response, 120);
    return response;
  }

  /** Distinct recently played track ids, newest first. */
  private async recentTrackIds(userId: string, take: number): Promise<string[]> {
    const rows = await this.prisma.listeningHistory.findMany({
      where: { userId },
      orderBy: { playedAt: 'desc' },
      select: { trackId: true },
      take: take * 5, // oversample, then dedupe preserving order
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

  private async tracksWhereIdsIn(ids: string[], take: number) {
    if (!ids.length) return [];
    return this.prisma.track.findMany({
      where: { id: { in: ids }, status: 'PUBLISHED' },
      take,
      include: {
        artist: { select: { id: true, stageName: true } },
        album: { select: { id: true } },
      },
    });
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
    // Fallback: trending tracks for cold-start users.
    return {
      id: 'recently-played',
      type: 'track',
      items: (await this.popularTracks(take)).map(toPlayableTrack),
    };
  }

  private async newReleasesSection(take: number): Promise<RecommendationSection> {
    const tracks = await this.prisma.track.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        artist: { select: { id: true, stageName: true } },
        album: { select: { id: true } },
      },
    });
    return { id: 'new-releases', type: 'track', items: tracks.map(toPlayableTrack) };
  }

  private async trendingSection(take: number): Promise<RecommendationSection> {
    return {
      id: 'trending',
      type: 'track',
      items: (await this.popularTracks(take)).map(toPlayableTrack),
    };
  }

  private async popularTracks(take: number) {
    return this.prisma.track.findMany({
      where: { status: 'PUBLISHED', audioUrl: { not: null } },
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
        ? { id: { notIn: followedArtistIds } } // surface NEW artists, not the ones you follow
        : {},
      orderBy: { monthlyListeners: 'desc' },
      take,
      include: { user: { select: { avatarUrl: true } } },
    });
    return { id: 'artists-for-you', type: 'artist', items: artists.map(toPlayableArtist) };
  }

  private async madeForYouSection(take: number): Promise<RecommendationSection> {
    const playlists = await this.prisma.playlist.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        owner: { select: { username: true } },
        _count: { select: { tracks: true } },
      },
    });
    return { id: 'made-for-you', type: 'playlist', items: playlists.map(toPlayablePlaylist) };
  }

  private async becauseYouFollowSection(
    followedArtistIds: string[],
    take: number,
  ): Promise<RecommendationSection> {
    if (followedArtistIds.length) {
      const tracks = await this.prisma.track.findMany({
        where: { status: 'PUBLISHED', artistId: { in: followedArtistIds } },
        orderBy: { playCount: 'desc' },
        take,
        include: {
          artist: { select: { id: true, stageName: true } },
          album: { select: { id: true } },
        },
      });
      if (tracks.length) {
        return { id: 'because-you-follow', type: 'track', items: tracks.map(toPlayableTrack) };
      }
    }
    // Cold-start fallback: trending section mirrors popular tracks.
    return {
      id: 'because-you-follow',
      type: 'track',
      items: (await this.popularTracks(take)).map(toPlayableTrack),
    };
  }
}
