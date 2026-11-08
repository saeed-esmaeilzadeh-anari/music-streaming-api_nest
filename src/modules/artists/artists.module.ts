import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ArtistsController } from './artists.controller';
import { ArtistsService } from './artists.service';
import { ArtistsRepository } from './repositories/artists.repository';
import { ArtistStatsService } from './artist-stats.service';
import { ArtistStatsProcessor } from './artist-stats.processor';
import { ArtistStatsScheduler } from './artist-stats.scheduler';
import { FollowsModule } from '../follows/follows.module';
import { QUEUE_NAMES } from '../../queue/queue.constants';

@Module({
  imports: [FollowsModule, BullModule.registerQueue({ name: QUEUE_NAMES.ARTIST_STATS })],
  controllers: [ArtistsController],
  providers: [
    ArtistsService,
    ArtistsRepository,
    ArtistStatsService,
    ArtistStatsProcessor,
    ArtistStatsScheduler,
  ],
  exports: [ArtistsService, ArtistsRepository, ArtistStatsService],
})
export class ArtistsModule {}
