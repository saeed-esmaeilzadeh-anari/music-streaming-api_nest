import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { QUEUE_NAMES, TRACK_PROCESSING_JOBS } from '../../../queue/queue.constants';
import { TracksRepository } from '../../tracks/repositories/tracks.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { DOMAIN_EVENTS, TrackProcessingCompletedEvent } from '../../../events';
import { IStorageProvider, STORAGE_PROVIDER } from '../../../storage/storage.interface';

const execFileAsync = promisify(execFile);
const FFMPEG_PROBE_TIMEOUT_MS = 60_000;
const SIGNED_MEDIA_URL_TTL_SECONDS = 5 * 60;

interface TrackProcessingJobData {
  uploadId: string;
  trackId: string;
  s3Key: string;
}

/**
 * Processes uploaded audio with the system ffprobe binary.
 *
 * The worker requires ffprobe to be installed in its runtime image. The media
 * is read through the configured storage provider, so local and S3-compatible
 * storage use the same processing path. A failed probe never publishes a track.
 */
@Processor(QUEUE_NAMES.TRACK_PROCESSING)
export class TrackProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(TrackProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tracksRepository: TracksRepository,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {
    super();
  }

  async process(job: Job<TrackProcessingJobData>): Promise<void> {
    switch (job.name) {
      case TRACK_PROCESSING_JOBS.EXTRACT_METADATA:
        return this.extractMetadata(job);
      default:
        this.logger.warn(`Unknown job name "${job.name}" on track-processing queue`);
    }
  }

  private async extractMetadata(job: Job<TrackProcessingJobData>): Promise<void> {
    const { uploadId, trackId, s3Key } = job.data;
    this.logger.log(`Processing upload ${uploadId} for track ${trackId}`);

    await this.prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'PROCESSING' },
    });

    try {
      const mediaUrl = await this.storage.getSignedUrl(s3Key, SIGNED_MEDIA_URL_TTL_SECONDS);
      const durationSec = await this.extractDuration(mediaUrl);
      const audioUrl = this.getStableAudioUrl(trackId);

      await this.prisma.$transaction(async (transaction) => {
        await transaction.upload.update({
          where: { id: uploadId },
          data: { status: 'READY', failureReason: null },
        });
        await transaction.track.update({
          where: { id: trackId },
          data: { audioUrl, durationSec, status: 'PUBLISHED' },
        });
      });

      this.eventEmitter.emit(
        DOMAIN_EVENTS.TRACK_PROCESSING_COMPLETED,
        new TrackProcessingCompletedEvent(trackId, durationSec, audioUrl),
      );

      this.logger.log(`Track ${trackId} published after ffprobe validation (${durationSec}s)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown audio processing error';
      const attempts = Number(job.opts.attempts ?? 1);
      const isFinalAttempt = job.attemptsMade + 1 >= attempts;

      this.logger.error(
        `Track processing failed for upload ${uploadId} (attempt ${job.attemptsMade + 1}/${attempts}): ${message}`,
      );

      // Keep the upload retryable while BullMQ still has attempts remaining.
      // Only mark the upload and track failed after the final failed attempt.
      if (isFinalAttempt) {
        try {
          await this.prisma.$transaction(async (transaction) => {
            await transaction.upload.update({
              where: { id: uploadId },
              data: { status: 'FAILED', failureReason: message.slice(0, 1000) },
            });
            await transaction.track.update({
              where: { id: trackId },
              data: { status: 'REJECTED' },
            });
          });
        } catch (persistenceError) {
          this.logger.error(
            `Could not persist final processing failure for upload ${uploadId}: ${persistenceError instanceof Error ? persistenceError.message : 'unknown error'}`,
          );
        }
      }

      throw error;
    }
  }

  private async extractDuration(mediaUrl: string): Promise<number> {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        mediaUrl,
      ],
      { timeout: FFMPEG_PROBE_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
    );

    const duration = Number.parseFloat(stdout.trim());
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('ffprobe could not determine a valid audio duration');
    }

    return Math.ceil(duration);
  }

  private getStableAudioUrl(trackId: string): string {
    const configuredAppUrl = (this.config.get<string>('APP_URL') ?? 'http://localhost:3001').trim();
    const appUrl = /^https?:\/\//i.test(configuredAppUrl)
      ? configuredAppUrl
      : /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredAppUrl)
        ? `http://${configuredAppUrl}`
        : `https://${configuredAppUrl}`;
    const apiPrefix = (
      this.config.get<string>('app.apiPrefix') ??
      this.config.get<string>('API_PREFIX') ??
      'api/v1'
    ).replace(/^\/+|\/+$/g, '');

    return `${appUrl.replace(/\/+$/g, '')}/${apiPrefix}/uploads/tracks/${trackId}/audio`;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} (${job.name}) failed after retries: ${error.message}`);
  }
}
