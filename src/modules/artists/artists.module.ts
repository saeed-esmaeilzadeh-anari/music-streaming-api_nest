import { Module } from '@nestjs/common';
import { ArtistsController } from './artists.controller';
import { ArtistsService } from './artists.service';
import { ArtistsRepository } from './repositories/artists.repository';

@Module({
  controllers: [ArtistsController],
  providers: [ArtistsService, ArtistsRepository],
  exports: [ArtistsService, ArtistsRepository],
})
export class ArtistsModule {}
