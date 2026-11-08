import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';
import { FollowsService } from './follows.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Get('following')
  @ApiOperation({ summary: 'List the artists the current user follows' })
  listFollowing(
    @CurrentUser('id') userId: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.followsService.listFollowing(userId, skip, Math.min(limit, 50));
  }
}
