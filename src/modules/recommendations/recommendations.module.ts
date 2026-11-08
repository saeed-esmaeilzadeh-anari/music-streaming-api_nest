import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { FollowsModule } from '../follows/follows.module';

@Module({
  imports: [FollowsModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, OptionalJwtAuthGuard],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
