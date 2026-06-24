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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GenresService } from './genres.service';
import { CreateGenreDto, UpdateGenreDto, GenreResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public, Roles } from '../../common/decorators';
import { Role } from '../../common/constants/role.enum';

@ApiTags('Genres')
@Controller('genres')
export class GenresController {
  constructor(private readonly genresService: GenresService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all genres' })
  @ApiResponse({ status: 200, type: [GenreResponseDto] })
  findAll() {
    return this.genresService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a genre by id' })
  @ApiResponse({ status: 200, type: GenreResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.genresService.findById(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a genre (admin only)' })
  @ApiResponse({ status: 201, type: GenreResponseDto })
  create(@Body() dto: CreateGenreDto) {
    return this.genresService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a genre (admin only)' })
  @ApiResponse({ status: 200, type: GenreResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGenreDto) {
    return this.genresService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a genre (admin only)' })
  @ApiResponse({ status: 204 })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.genresService.remove(id);
  }
}
