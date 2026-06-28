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
import { TracksService } from './tracks.service';
import {
  CreateTrackDto,
  UpdateTrackDto,
  TrackQueryDto,
  TrackResponseDto,
  RegisterPlayDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Public, Roles, CacheTTL } from '../../common/decorators';
import { Role } from '../../common/constants/role.enum';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('Tracks')
@Controller('artists/:artistId/tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST, Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Upload track metadata under an artist (owner only)' })
  @ApiResponse({ status: 201, type: TrackResponseDto })
  create(
    @Param('artistId', ParseUUIDPipe) artistId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTrackDto,
  ) {
    return this.tracksService.create(artistId, user.id, user.role, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST, Role.ADMIN)
  @Patch(':trackId')
  @ApiOperation({ summary: 'Update a track (owner only)' })
  @ApiResponse({ status: 200, type: TrackResponseDto })
  update(
    @Param('trackId', ParseUUIDPipe) trackId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTrackDto,
  ) {
    return this.tracksService.update(trackId, user.id, user.role, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST, Role.ADMIN)
  @Delete(':trackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a track (owner only)' })
  @ApiResponse({ status: 204 })
  remove(@Param('trackId', ParseUUIDPipe) trackId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tracksService.remove(trackId, user.id, user.role);
  }
}

/**
 * Separate controller for read/listen endpoints that aren't scoped to a
 * single artist path - kept in the same file for cohesion since both serve
 * the Tracks domain, but registered as a distinct route root (/tracks).
 */
@ApiTags('Tracks')
@Controller('tracks')
export class TracksBrowseController {
  constructor(private readonly tracksService: TracksService) {}

  @Public()
  @Get()
  @CacheTTL(30, 'tracks:list')
  @ApiOperation({ summary: 'Browse/search published tracks' })
  findAll(@Query() query: TrackQueryDto) {
    return this.tracksService.findAll(query);
  }

  @Public()
  @Get(':id')
  @CacheTTL(30, 'tracks:detail')
  @ApiOperation({ summary: 'Get a single track by id' })
  @ApiResponse({ status: 200, type: TrackResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tracksService.findById(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/play')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Register a play event for listening history & play count' })
  @ApiResponse({ status: 204 })
  registerPlay(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterPlayDto,
  ) {
    return this.tracksService.registerPlay(id, userId, dto.progressSec ?? 0);
  }
}
