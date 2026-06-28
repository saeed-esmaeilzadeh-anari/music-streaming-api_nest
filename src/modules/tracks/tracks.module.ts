import { Module } from '@nestjs/common';
import { TracksController, TracksBrowseController } from './tracks.controller';
import { TracksService } from './tracks.service';
import { TracksRepository } from './repositories/tracks.repository';
import { ArtistsModule } from '../artists/artists.module';

@Module({
  imports: [ArtistsModule],
  controllers: [TracksController, TracksBrowseController],
  providers: [TracksService, TracksRepository],
  exports: [TracksService, TracksRepository],
})
export class TracksModule {}
