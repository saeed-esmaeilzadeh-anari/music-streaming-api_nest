import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto, SearchResultDto } from './dto';
import { Public } from '../../common/decorators';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search across tracks, albums, artists, and playlists' })
  @ApiResponse({ status: 200, type: SearchResultDto })
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }
}
