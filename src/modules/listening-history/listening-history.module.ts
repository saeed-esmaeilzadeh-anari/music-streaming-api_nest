import { Module } from '@nestjs/common';
import { ListeningHistoryController } from './listening-history.controller';
import { ListeningHistoryService } from './listening-history.service';
import { ListeningHistoryRepository } from './repositories/listening-history.repository';

@Module({
  controllers: [ListeningHistoryController],
  providers: [ListeningHistoryService, ListeningHistoryRepository],
  exports: [ListeningHistoryService],
})
export class ListeningHistoryModule {}
