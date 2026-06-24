import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum PlaylistVisibilityDto {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  UNLISTED = 'UNLISTED',
}

export class CreatePlaylistDto {
  @ApiProperty({ example: 'Late Night Drive' })
  @IsString()
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: PlaylistVisibilityDto, default: PlaylistVisibilityDto.PRIVATE })
  @IsOptional()
  @IsEnum(PlaylistVisibilityDto)
  visibility?: PlaylistVisibilityDto;
}
