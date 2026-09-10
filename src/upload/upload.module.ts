import { Module }          from '@nestjs/common';
import { BullModule }      from '@nestjs/bullmq';
import { StorageModule }   from '../storage/storage.module';
import { UploadService }   from './upload.service';
import { UploadController } from './upload.controller';

@Module({
  imports: [
    StorageModule,                              // provides STORAGE_PROVIDER token
    BullModule.registerQueue({ name: 'audio-processing' }),
  ],
  controllers: [UploadController],
  providers:   [UploadService],
  exports:     [UploadService],                 // exported so TrackService etc. can call getReadUrl()
})
export class UploadModule {}
