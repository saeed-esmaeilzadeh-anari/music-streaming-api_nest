import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QUEUE_NAMES, TRACK_PROCESSING_JOBS } from '../../../queue/queue.constants';
import { TrackProcessingJobData } from './track-processing.types';
import { UploadsRepository } from '../repositories/uploads.repository';
import { TracksRepository } from '../../tracks/repositories/tracks.repository';
import { S3Service } from '../s3.service';
import { DOMAIN_EVENTS, TrackProcessingCompletedEvent } from '../../../events';

/**
 * Consumes jobs from the `track-processing` queue. In a real deployment this
 * would shell out to ffmpeg/ffprobe (or call a media-processing microservice)
 * to extract duration, generate a waveform, and possibly transcode to a
 * streaming-friendly format. Here we model that workflow's shape and
 * boundaries so the integration point is obvious and swappable.
 *
 * Decoupling rationale: keeping this heavy/slow work off the request thread
 * (BullMQ + Redis) means the upload-confirmation endpoint responds instantly,
 * and processing failures can retry independently (configured via
 * defaultJobOptions in QueueModule) without affecting the API's availability.
 */
@Processor(QUEUE_NAMES.TRACK_PROCESSING)
export class TrackProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(TrackProcessingProcessor.name);

  constructor(
    private readonly uploadsRepository: UploadsRepository,
    private readonly tracksRepository: TracksRepository,
    private readonly s3Service: S3Service,
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

    await this.uploadsRepository.update(uploadId, { status: 'PROCESSING' });

    try {
      // Placeholder for real audio analysis (ffprobe/ffmpeg, a Lambda, etc).
      // We simulate extracting a duration so the rest of the pipeline (event
      // emission, status transitions) is fully wired and testable end-to-end.
      const durationSec = await this.simulateDurationExtraction();
      const audioUrl = this.s3Service.getPublicUrl(s3Key);

      await this.tracksRepository.update(trackId, {
        audioUrl,
        durationSec,
        status: 'PUBLISHED',
      });

      await this.uploadsRepository.update(uploadId, { status: 'READY' });

      this.eventEmitter.emit(
        DOMAIN_EVENTS.TRACK_PROCESSING_COMPLETED,
        new TrackProcessingCompletedEvent(trackId, durationSec, audioUrl),
      );
    } catch (error) {
      this.logger.error(`Track processing failed for upload ${uploadId}: ${error}`);
      await this.uploadsRepository.update(uploadId, {
        status: 'FAILED',
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      });
      await this.tracksRepository.update(trackId, { status: 'REJECTED' });
      throw error; // let BullMQ apply its retry/backoff policy
    }
  }

  private async simulateDurationExtraction(): Promise<number> {
    // Replace with real ffprobe output parsing in production.
    return 180;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} (${job.name}) failed after retries: ${error.message}`);
  }
}
