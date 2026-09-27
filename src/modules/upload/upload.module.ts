import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StorageModule } from '../../storage/storage.module';
import { TracksModule } from '../tracks/tracks.module';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { TrackProcessingProcessor } from './processors/track-processing.processor';
import { QUEUE_NAMES } from '../../queue/queue.constants';

/**
 * UploadModule — canonical upload module (src/modules/upload)
 *
 * Responsibilities:
 *   1. Presign / local-put / confirm endpoints (UploadController)
 *   2. Storage abstraction via IStorageProvider (StorageModule)
 *   3. BullMQ job production in UploadService.confirmUpload()
 *   4. BullMQ job consumption in TrackProcessingProcessor
 *
 * Why TrackProcessingProcessor lives here (not in upload1):
 *   - upload1 is the old module — it uses S3Service directly
 *   - This module uses IStorageProvider (works for local AND s3)
 *   - app.module.ts imports UploadModule (this file), not upload1
 *   - The processor must be in a module that NestJS actually loads
 *
 * Switching between local and S3:
 *   Set STORAGE_PROVIDER=local  → LocalStorageProvider
 *   Set STORAGE_PROVIDER=s3     → S3StorageProvider
 *   No code changes needed.
 */
@Module({
  imports: [
    StorageModule,                                              // STORAGE_PROVIDER token
    TracksModule,                                               // TracksRepository
    BullModule.registerQueue({ name: QUEUE_NAMES.TRACK_PROCESSING }),
  ],
  controllers: [UploadController],
  providers: [
    UploadService,
    TrackProcessingProcessor,   // ← THIS was the missing piece
  ],
  exports: [UploadService],
})
export class UploadModule {}
