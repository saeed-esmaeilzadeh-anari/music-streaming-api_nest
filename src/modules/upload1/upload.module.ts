import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { S3Service } from './s3.service';
import { UploadsRepository } from './repositories/uploads.repository';
import { TrackProcessingProcessor } from './processors/track-processing.processor';
import { TracksModule } from '../tracks/tracks.module';
import { QUEUE_NAMES } from '../../queue/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.TRACK_PROCESSING }), TracksModule],
  controllers: [UploadController],
  providers: [UploadService, S3Service, UploadsRepository, TrackProcessingProcessor],
  exports: [S3Service, UploadService],
})
export class UploadModule {}
