import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  QUEUE_NAMES,
  ARTIST_STATS_JOBS,
  ARTIST_STATS_RECOMPUTE_INTERVAL_MS,
} from '../../queue/queue.constants';

/**
 * Registers the hourly repeatable job once per boot. BullMQ dedupes by
 * (name + repeat options), so re-adding on every deploy is safe.
 */
@Injectable()
export class ArtistStatsScheduler implements OnModuleInit {
  private readonly logger = new Logger(ArtistStatsScheduler.name);

  constructor(@InjectQueue(QUEUE_NAMES.ARTIST_STATS) private readonly artistStatsQueue: Queue) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.artistStatsQueue.add(
        ARTIST_STATS_JOBS.RECOMPUTE_MONTHLY_LISTENERS,
        {},
        {
          repeat: { every: ARTIST_STATS_RECOMPUTE_INTERVAL_MS },
          jobId: ARTIST_STATS_JOBS.RECOMPUTE_MONTHLY_LISTENERS,
          removeOnComplete: { age: 3600, count: 100 },
          removeOnFail: { age: 24 * 3600 },
        },
      );
      this.logger.log('Hourly monthly-listeners recompute scheduled.');
    } catch (error) {
      // Never block boot because the queue backend is unavailable.
      this.logger.error(`Failed to schedule artist stats job: ${error}`);
    }
  }
}
