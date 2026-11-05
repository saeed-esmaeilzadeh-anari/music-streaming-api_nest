import { Module } from '@nestjs/common';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';
import { PlaylistsRepository } from './repositories/playlists.repository';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Module({
  controllers: [PlaylistsController],
  providers: [PlaylistsService, PlaylistsRepository, OptionalJwtAuthGuard],
  exports: [PlaylistsService, PlaylistsRepository],
})
export class PlaylistsModule {}
