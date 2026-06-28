import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum CommentTargetTypeDto {
  TRACK = 'TRACK',
  ALBUM = 'ALBUM',
  PLAYLIST = 'PLAYLIST',
}

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  content: string;

  @ApiProperty({ enum: CommentTargetTypeDto })
  @IsEnum(CommentTargetTypeDto)
  targetType: CommentTargetTypeDto;

  @ApiProperty()
  @IsUUID()
  targetId: string;

  @ApiPropertyOptional({ description: 'Parent comment id, if this is a reply.' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
