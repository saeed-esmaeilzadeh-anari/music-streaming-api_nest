import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsQueryDto, RecommendationsResponse } from './dto';
import { CurrentUser, Public } from '../../common/decorators';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('Recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  /**
   * Public: anonymous visitors receive the cold-start feed, authenticated
   * users receive a personalized one. When the route is public the JWT
   * guard is skipped, so an authenticated caller's user object is only
   * present when a valid Bearer token was attached.
   */
  @Public()
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
