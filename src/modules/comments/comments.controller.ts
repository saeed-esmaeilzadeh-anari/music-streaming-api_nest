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
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto, CommentResponseDto } from './dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, Public } from '../../common/decorators';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { Role } from '../../common/constants/role.enum';

@ApiTags('Comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Post a comment (or reply) on a track, album, or playlist' })
  @ApiResponse({ status: 201, type: CommentResponseDto })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateCommentDto) {
    return this.commentsService.create(userId, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List top-level comments for a target' })
  findByTarget(
    @Query('targetType') targetType: string,
    @Query('targetId', ParseUUIDPipe) targetId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.commentsService.findByTarget(targetType, targetId, query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Edit a comment (author only)' })
  @ApiResponse({ status: 200, type: CommentResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(id, userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment (author or moderator/admin)' })
  @ApiResponse({ status: 204 })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    const isStaff = user.role === Role.ADMIN || user.role === Role.MODERATOR;
    return this.commentsService.remove(id, user.id, isStaff);
  }
}
