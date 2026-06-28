import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ArtistsService } from './artists.service';
import { CreateArtistDto, UpdateArtistDto, ArtistResponseDto } from './dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Public, Roles, CacheTTL } from '../../common/decorators';
import { Role } from '../../common/constants/role.enum';

@ApiTags('Artists')
@Controller('artists')
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  @Public()
  @Get()
  @CacheTTL(60, 'artists:list')
  @ApiOperation({ summary: 'List artists, ordered by monthly listeners' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.artistsService.findAll(query);
  }

  @Public()
  @Get(':id')
  @CacheTTL(60, 'artists:detail')
  @ApiOperation({ summary: 'Get an artist profile by id' })
  @ApiResponse({ status: 200, type: ArtistResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.artistsService.findById(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST, Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create an artist profile for the current user' })
  @ApiResponse({ status: 201, type: ArtistResponseDto })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateArtistDto) {
    return this.artistsService.createProfile(userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST, Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update an artist profile (owner only)' })
  @ApiResponse({ status: 200, type: ArtistResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateArtistDto,
  ) {
    return this.artistsService.update(id, userId, dto);
  }
}
