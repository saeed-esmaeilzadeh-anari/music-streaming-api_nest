import { Module } from '@nestjs/common';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';
import { LikesRepository } from './repositories/likes.repository';

@Module({
  controllers: [LikesController],
  providers: [LikesService, LikesRepository],
  exports: [LikesService],
})
export class LikesModule {}
