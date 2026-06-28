import { Module } from '@nestjs/common';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';
import { PlaylistsRepository } from './repositories/playlists.repository';

@Module({
  controllers: [PlaylistsController],
  providers: [PlaylistsService, PlaylistsRepository],
  exports: [PlaylistsService, PlaylistsRepository],
})
export class PlaylistsModule {}
