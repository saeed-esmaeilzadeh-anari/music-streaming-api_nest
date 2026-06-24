import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTrackDto {
  @ApiProperty({ example: 'Midnight City' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Album to attach this track to, if any.' })
  @IsOptional()
  @IsUUID()
  albumId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isExplicit?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Genre IDs to tag this track with.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  genreIds?: string[];
}
