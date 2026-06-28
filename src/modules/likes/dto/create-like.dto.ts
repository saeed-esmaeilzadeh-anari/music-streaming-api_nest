import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';

export enum LikeTargetTypeDto {
  TRACK = 'TRACK',
  ALBUM = 'ALBUM',
  PLAYLIST = 'PLAYLIST',
  COMMENT = 'COMMENT',
}

export class CreateLikeDto {
  @ApiProperty({ enum: LikeTargetTypeDto })
  @IsEnum(LikeTargetTypeDto)
  targetType: LikeTargetTypeDto;

  @ApiProperty()
  @IsUUID()
  targetId: string;
}
