import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListeningHistoryService } from './listening-history.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Listening History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('listening-history')
export class ListeningHistoryController {
  constructor(private readonly listeningHistoryService: ListeningHistoryService) {}

  @Get()
  @ApiOperation({ summary: "Get the current user's listening history" })
  findOwn(@CurrentUser('id') userId: string, @Query() query: PaginationQueryDto) {
    return this.listeningHistoryService.findOwn(userId, query);
  }
}
