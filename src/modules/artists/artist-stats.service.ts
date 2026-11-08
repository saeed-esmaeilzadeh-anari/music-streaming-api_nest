import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../../redis/redis-cache.service';

/**
 * Computes artists.monthlyListeners = COUNT(DISTINCT user) with at least one
 * play of that artist's tracks in the last 30 days. Runs as an hourly
 * BullMQ job (see ArtistStatsProcessor); also callable on demand.
 *
 * Implemented as set-based SQL (UPDATE ... FROM) instead of row-by-row
 * Prisma updates so the cost stays flat as the catalog grows. Artists with
 * no recent plays are reset to 0 in a second statement.
 */
@Injectable()
export class ArtistStatsService {
  private readonly logger = new Logger(ArtistStatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: RedisCacheService,
  ) {}

  async recomputeMonthlyListeners(): Promise<{ updated: number; reset: number }> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.$executeRaw`
      UPDATE "artists" AS a
      SET "monthlyListeners" = s.listeners
      FROM (
        SELECT t."artistId" AS artist_id, COUNT(DISTINCT lh."userId")::int AS listeners
        FROM "listening_history" lh
        JOIN "tracks" t ON t."id" = lh."trackId"
        WHERE lh."playedAt" > ${cutoff}
        GROUP BY t."artistId"
      ) AS s
      WHERE a."id" = s.artist_id
        AND a."monthlyListeners" IS DISTINCT FROM s.listeners`;

    const reset = await this.prisma.$executeRaw`
      UPDATE "artists"
      SET "monthlyListeners" = 0
      WHERE "monthlyListeners" <> 0
        AND "id" NOT IN (
          SELECT DISTINCT t."artistId"
          FROM "listening_history" lh
          JOIN "tracks" t ON t."id" = lh."trackId"
          WHERE lh."playedAt" > ${cutoff}
            AND t."artistId" IS NOT NULL
        )`;

    // Artist ordering/cards depend on monthlyListeners; drop stale caches.
    await this.cacheService.delByPrefix('artists:');

    this.logger.log(`Monthly listeners recomputed: ${updated} updated, ${reset} reset.`);
    return { updated, reset };
  }
}
