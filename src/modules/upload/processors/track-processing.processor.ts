import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { QUEUE_NAMES, TRACK_PROCESSING_JOBS } from '../../../queue/queue.constants';
import { STORAGE_PROVIDER, IStorageProvider } from '../../../storage/storage.interface';
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
    @Inject(STORAGE_PROVIDER)
    private readonly storage: IStorageProvider,
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
    const { uploadId, trackId, s3Key } = job.data;
    this.logger.log(`Processing upload ${uploadId} for track ${trackId}`);

    // Mark upload as PROCESSING
    await this.prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'PROCESSING' },
    });

    try {
      // Generate the public URL via the storage provider.
      // LocalStorageProvider returns: http://localhost:3001/uploads/<key>
      // S3StorageProvider returns a presigned GET URL (time-limited)
      // For a permanent public URL with S3/MinIO, use getSignedUrl with
      // a long TTL or configure the bucket as public.
      const audioUrl = await this.storage.getSignedUrl(s3Key, 60 * 60 * 24 * 365); // 1 year

      // Placeholder for real audio metadata extraction (ffprobe/ffmpeg).
      const durationSec = await this.simulateDurationExtraction();

      await this.tracksRepository.update(trackId, {
        audioUrl,
        durationSec,
        status: 'PUBLISHED',
      });

      await this.prisma.upload.update({
        where: { id: uploadId },
        data: { status: 'READY' },
      });

      this.eventEmitter.emit(
        DOMAIN_EVENTS.TRACK_PROCESSING_COMPLETED,
        new TrackProcessingCompletedEvent(trackId, durationSec, audioUrl),
      );

      this.logger.log(
        `Track ${trackId} published — audioUrl: ${audioUrl}, duration: ${durationSec}s`,
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

  /** Replace with real ffprobe output parsing in production. */
  private async simulateDurationExtraction(): Promise<number> {
    return 180;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} (${job.name}) failed after retries: ${error.message}`);
  }
}
