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
import { AlbumsService } from './albums.service';
import { CreateAlbumDto, UpdateAlbumDto, AlbumResponseDto, AlbumQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Public, Roles, CacheTTL } from '../../common/decorators';
import { Role } from '../../common/constants/role.enum';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('Albums')
@Controller('artists/:artistId/albums')
export class AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST, Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create an album under an artist (owner only)' })
  @ApiResponse({ status: 201, type: AlbumResponseDto })
  create(
    @Param('artistId', ParseUUIDPipe) artistId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAlbumDto,
  ) {
    return this.albumsService.create(artistId, userId, dto);
  }
}

@ApiTags('Albums')
@Controller('albums')
export class AlbumsBrowseController {
  constructor(private readonly albumsService: AlbumsService) {}

  @Public()
  @Get()
  @CacheTTL(60, 'albums:list')
  @ApiOperation({ summary: 'List published albums' })
  findAll(@Query() query: AlbumQueryDto) {
    return this.albumsService.findAll(query);
  }

  @Public()
  @Get(':id')
  @CacheTTL(60, 'albums:detail')
  @ApiOperation({ summary: 'Get an album by id' })
  @ApiResponse({ status: 200, type: AlbumResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.albumsService.findById(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST, Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update an album (owner or admin)' })
  @ApiResponse({ status: 200, type: AlbumResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAlbumDto,
  ) {
    return this.albumsService.update(id, user.id, user.role, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST, Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an album (owner or admin)' })
  @ApiResponse({ status: 204 })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.albumsService.remove(id, user.id, user.role);
  }
}
