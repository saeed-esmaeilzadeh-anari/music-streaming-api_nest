import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS, UserFollowedEvent } from '../../events';

/**
 * Social graph over the existing Follow model (user follows user; artist
 * profiles are 1:1 with users, so "follow artist X" == "follow X's user").
 * Follow/unfollow are idempotent: re-following returns the existing edge
 * instead of a 409, unfollowing a missing edge is a no-op.
 */
@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async followArtist(userId: string, artistId: string): Promise<{ following: boolean }> {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
      select: { id: true, userId: true },
    });
    if (!artist) {
      throw new NotFoundException('Artist not found.');
    }
    if (artist.userId === userId) {
      throw new ConflictException('You cannot follow your own artist profile.');
    }

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId: userId, followeeId: artist.userId } },
      select: { id: true },
    });
    if (existing) {
      return { following: true };
    }

    try {
      await this.prisma.follow.create({
        data: { followerId: userId, followeeId: artist.userId },
      });
    } catch (error: unknown) {
      // Concurrent duplicate follow: the edge exists, treat as success.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
    }

    const follower = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    this.eventEmitter.emit(
      DOMAIN_EVENTS.USER_FOLLOWED,
      new UserFollowedEvent(userId, follower?.username ?? '', artist.userId),
    );

    return { following: true };
  }

  async unfollowArtist(userId: string, artistId: string): Promise<{ following: boolean }> {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
      select: { userId: true },
    });
    if (!artist) {
      throw new NotFoundException('Artist not found.');
    }

    await this.prisma.follow.deleteMany({
      where: { followerId: userId, followeeId: artist.userId },
    });

    return { following: false };
  }

  async isFollowing(userId: string, artistId: string): Promise<boolean> {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
      select: { userId: true },
    });
    if (!artist) {
      return false;
    }
    const edge = await this.prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId: userId, followeeId: artist.userId } },
      select: { id: true },
    });
    return Boolean(edge);
  }

  /** Artists the given user follows, ordered by follower count popularity. */
  async listFollowing(userId: string, skip = 0, take = 20) {
    const [edges, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          followeeId: true,
          createdAt: true,
          followee: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              artistProfile: {
                select: {
                  id: true,
                  stageName: true,
                  isVerified: true,
                  monthlyListeners: true,
                  bannerUrl: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);

    return {
      items: edges.map((edge) => ({
        followedAt: edge.createdAt,
        artist: edge.followee.artistProfile
          ? {
              id: edge.followee.artistProfile.id,
              stageName: edge.followee.artistProfile.stageName,
              imageUrl: edge.followee.avatarUrl,
              bannerUrl: edge.followee.artistProfile.bannerUrl,
              isVerified: edge.followee.artistProfile.isVerified,
              monthlyListeners: edge.followee.artistProfile.monthlyListeners,
            }
          : null,
      })),
      meta: { totalItems: total, skip, take },
    };
  }

  /** Followers of an artist (via the artist's underlying user id). */
  async listFollowers(artistId: string, skip = 0, take = 20) {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
      select: { id: true, userId: true, stageName: true },
    });
    if (!artist) {
      throw new NotFoundException('Artist not found.');
    }

    const [edges, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followeeId: artist.userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          follower: {
            select: { id: true, username: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.follow.count({ where: { followeeId: artist.userId } }),
    ]);

    return {
      items: edges.map((edge) => ({
        followedAt: edge.createdAt,
        user: {
          id: edge.follower.id,
          username: edge.follower.username,
          avatarUrl: edge.follower.avatarUrl,
        },
      })),
      meta: {
        totalItems: total,
        skip,
        take,
        artistId: artist.id,
        stageName: artist.stageName,
      },
    };
  }

  /** Distinct artist ids (as artist profile ids) the user follows. */
  async followedArtistIds(userId: string): Promise<string[]> {
    const edges = await this.prisma.follow.findMany({
      where: { followerId: userId, followee: { artistProfile: { isNot: null } } },
      select: { followee: { select: { artistProfile: { select: { id: true } } } } },
    });
    return edges.map((e) => e.followee.artistProfile?.id).filter((id): id is string => Boolean(id));
  }
}
