import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { AddFavoriteDto, FavoriteResponseDto } from './dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's favorite tracks" })
  findAll(@CurrentUser('id') userId: string, @Query() query: PaginationQueryDto) {
    return this.favoritesService.findAll(userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Add a track to favorites' })
  @ApiResponse({ status: 201, type: FavoriteResponseDto })
  add(@CurrentUser('id') userId: string, @Body() dto: AddFavoriteDto) {
    return this.favoritesService.add(userId, dto.trackId);
  }

  @Delete(':trackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a track from favorites' })
  @ApiResponse({ status: 204 })
  remove(@CurrentUser('id') userId: string, @Param('trackId', ParseUUIDPipe) trackId: string) {
    return this.favoritesService.remove(userId, trackId);
  }
}
