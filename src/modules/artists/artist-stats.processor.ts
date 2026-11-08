import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ArtistStatsService } from './artist-stats.service';
import { QUEUE_NAMES, ARTIST_STATS_JOBS } from '../../queue/queue.constants';

/**
 * Hourly worker recomputing artists.monthlyListeners. The repeatable job is
 * registered by ArtistStatsScheduler on module init.
 */
@Processor(QUEUE_NAMES.ARTIST_STATS)
@Injectable()
export class ArtistStatsProcessor extends WorkerHost {
  private readonly logger = new Logger(ArtistStatsProcessor.name);

  constructor(private readonly artistStatsService: ArtistStatsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== ARTIST_STATS_JOBS.RECOMPUTE_MONTHLY_LISTENERS) {
      this.logger.warn(`Unknown artist-stats job: ${job.name}`);
      return;
    }
    await this.artistStatsService.recomputeMonthlyListeners();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Artist stats job ${job.name} failed after ${job.attemptsMade} attempts: ${error?.message}`,
    );
  }
}
