import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LikesService } from './likes.service';
import { CreateLikeDto, LikeResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, Public } from '../../common/decorators';

@ApiTags('Likes')
@Controller('likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Like a track, album, playlist, or comment' })
  @ApiResponse({ status: 201, type: LikeResponseDto })
  like(@CurrentUser('id') userId: string, @Body() dto: CreateLikeDto) {
    return this.likesService.like(userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a like' })
  @ApiResponse({ status: 204 })
  unlike(
    @CurrentUser('id') userId: string,
    @Query('targetType') targetType: string,
    @Query('targetId') targetId: string,
  ) {
    return this.likesService.unlike(userId, targetType, targetId);
  }

  @Public()
  @Get('count')
  @ApiOperation({ summary: 'Get the like count for a target' })
  count(@Query('targetType') targetType: string, @Query('targetId') targetId: string) {
    return this.likesService.count(targetType, targetId);
  }
}
