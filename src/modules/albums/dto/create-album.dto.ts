import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum AlbumTypeDto {
  ALBUM = 'ALBUM',
  SINGLE = 'SINGLE',
  EP = 'EP',
  COMPILATION = 'COMPILATION',
}

export class CreateAlbumDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ enum: AlbumTypeDto, default: AlbumTypeDto.ALBUM })
  @IsOptional()
  @IsEnum(AlbumTypeDto)
  type?: AlbumTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  genreIds?: string[];
}
