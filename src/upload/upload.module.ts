import { Module }          from '@nestjs/common';
import { BullModule }      from '@nestjs/bullmq';
import { StorageModule }   from '../storage/storage.module';
import { UploadService }   from './upload.service';
import { UploadController } from './upload.controller';
import { QUEUE_NAMES } from '@/queue/queue.constants';

@Module({
  imports: [
    StorageModule,                              // provides STORAGE_PROVIDER token
    // BullModule.registerQueue({ name: 'audio-processing' }),
    BullModule.registerQueue({name: QUEUE_NAMES.TRACK_PROCESSING,})
  ],
  controllers: [UploadController],
  providers:   [UploadService],
  exports:     [UploadService],                 // exported so TrackService etc. can call getReadUrl()
})
export class UploadModule {}
