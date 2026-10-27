import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { QUEUE_NAMES, TRACK_PROCESSING_JOBS } from '../../../queue/queue.constants';
import { TracksRepository } from '../../tracks/repositories/tracks.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { DOMAIN_EVENTS, TrackProcessingCompletedEvent } from '../../../events';

interface TrackProcessingJobData {
  uploadId: string;
  trackId: string;
  s3Key: string;
}

/**
 * TrackProcessingProcessor
 *
 * Consumes jobs from the `track-processing` queue.
 *
 * Uses IStorageProvider (not S3Service directly) so it works with both
 * LocalStorageProvider (STORAGE_PROVIDER=local) and S3StorageProvider
 * (STORAGE_PROVIDER=s3) without any code change.
 *
 * audioUrl generation:
 *   local → http://localhost:3001/uploads/tracks/audio/<uuid>.mp3
 *   s3    → https://bucket.s3.amazonaws.com/tracks/audio/<uuid>.mp3
 *           (or MinIO: http://localhost:9000/soundwave/tracks/audio/<uuid>.mp3)
 */
@Processor(QUEUE_NAMES.TRACK_PROCESSING)
export class TrackProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(TrackProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tracksRepository: TracksRepository,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
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
    const { uploadId, trackId } = job.data;
    this.logger.log(`Processing upload ${uploadId} for track ${trackId}`);

    // Mark upload as PROCESSING
    await this.prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'PROCESSING' },
    });

    try {
      // Store a stable backend URL instead of a time-limited S3 URL.
      // The endpoint redirects to a freshly signed storage URL for each playback request.
      const audioUrl = this.getStableAudioUrl(trackId);

      // Placeholder for real audio metadata extraction (ffprobe/ffmpeg).
      const durationSec = await this.simulateDurationExtraction();

      // Mark the upload READY before publishing the track so playback can resolve its object.
      await this.prisma.upload.update({
        where: { id: uploadId },
        data: { status: 'READY' },
      });

      await this.tracksRepository.update(trackId, {
        audioUrl,
        durationSec,
        status: 'PUBLISHED',
      });

      this.eventEmitter.emit(
        DOMAIN_EVENTS.TRACK_PROCESSING_COMPLETED,
        new TrackProcessingCompletedEvent(trackId, durationSec, audioUrl),
      );

      this.logger.log(
        `Track ${trackId} published — stable audio endpoint saved, duration: ${durationSec}s`,
      );
    } catch (error) {
      this.logger.error(`Track processing failed for upload ${uploadId}: ${error}`);

      await this.prisma.upload.update({
        where: { id: uploadId },
        data: {
          status: 'FAILED',
          failureReason: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      await this.tracksRepository.update(trackId, { status: 'REJECTED' });

      throw error; // let BullMQ apply its retry/backoff policy
    }
  }

  private getStableAudioUrl(trackId: string): string {
    const configuredAppUrl = (
      this.config.get<string>('APP_URL') ?? 'http://localhost:3001'
    ).trim();
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

  /** Replace with real ffprobe output parsing in production. */
  private async simulateDurationExtraction(): Promise<number> {
    return 180;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} (${job.name}) failed after retries: ${error.message}`);
  }
}
