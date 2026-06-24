import { Module } from '@nestjs/common';
import { AlbumsController, AlbumsBrowseController } from './albums.controller';
import { AlbumsService } from './albums.service';
import { AlbumsRepository } from './repositories/albums.repository';
import { ArtistsModule } from '../artists/artists.module';

@Module({
  imports: [ArtistsModule],
  controllers: [AlbumsController, AlbumsBrowseController],
  providers: [AlbumsService, AlbumsRepository],
  exports: [AlbumsService, AlbumsRepository],
})
export class AlbumsModule {}
