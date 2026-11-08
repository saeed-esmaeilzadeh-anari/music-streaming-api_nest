import { Module } from '@nestjs/common';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

/**
 * Social graph module. FollowsService is exported so ArtistsController can
 * expose follow/unfollow/followers under /artists/:id/... and
 * RecommendationsService can reuse followedArtistIds().
 */
@Module({
  controllers: [FollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
