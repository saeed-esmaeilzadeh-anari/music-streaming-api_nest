import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PlaylistsService } from './playlists.service';
import {
  CreatePlaylistDto,
  UpdatePlaylistDto,
  AddTrackToPlaylistDto,
  ReorderPlaylistTrackDto,
  PlaylistResponseDto,
} from './dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, Public } from '../../common/decorators';

@ApiTags('Playlists')
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Create a playlist owned by the current user' })
  @ApiResponse({ status: 201, type: PlaylistResponseDto })
  create(@CurrentUser('id') userId: string, @Body() dto: CreatePlaylistDto) {
    return this.playlistsService.create(userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: "List the current user's own playlists" })
  findOwn(@CurrentUser('id') userId: string, @Query() query: PaginationQueryDto) {
    return this.playlistsService.findOwn(userId, query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a playlist by id (private playlists require ownership)' })
  @ApiResponse({ status: 200, type: PlaylistResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId?: string) {
    return this.playlistsService.findById(id, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update playlist metadata (owner only)' })
  @ApiResponse({ status: 200, type: PlaylistResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlistsService.update(id, userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a playlist (owner only)' })
  @ApiResponse({ status: 204 })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.playlistsService.remove(id, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/tracks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a track to a playlist (owner only)' })
  @ApiResponse({ status: 201 })
  addTrack(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddTrackToPlaylistDto,
  ) {
    return this.playlistsService.addTrack(id, userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/tracks/:trackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a track from a playlist (owner only)' })
  @ApiResponse({ status: 204 })
  removeTrack(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('trackId', ParseUUIDPipe) trackId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.playlistsService.removeTrack(id, trackId, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/tracks/:trackId/position')
  @ApiOperation({ summary: 'Reorder a track within a playlist (owner only)' })
  reorderTrack(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('trackId', ParseUUIDPipe) trackId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReorderPlaylistTrackDto,
  ) {
    return this.playlistsService.reorderTrack(id, trackId, userId, dto.position);
  }
}
