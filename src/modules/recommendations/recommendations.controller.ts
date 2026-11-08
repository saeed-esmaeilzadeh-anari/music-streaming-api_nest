import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsQueryDto, RecommendationsResponse } from './dto';
import { CurrentUser } from '../../common/decorators';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@ApiTags('Recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  /**
   * Anonymous visitors receive the cold-start feed. A supplied Bearer token
   * is validated and, when valid, drives the user's personalized feed.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({
    summary: 'Six-section personalized home feed with cold-start fallback',
  })
  getRecommendations(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: RecommendationsQueryDto,
  ): Promise<RecommendationsResponse> {
    return this.recommendationsService.getForUser(user?.id, query);
  }
}
