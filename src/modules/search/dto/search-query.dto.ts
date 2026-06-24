import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export enum SearchEntityType {
  ALL = 'ALL',
  TRACK = 'TRACK',
  ALBUM = 'ALBUM',
  ARTIST = 'ARTIST',
  PLAYLIST = 'PLAYLIST',
}

export class SearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'midnight' })
  @IsString()
  @MinLength(1)
  q: string;

  @ApiPropertyOptional({ enum: SearchEntityType, default: SearchEntityType.ALL })
  @IsOptional()
  @IsEnum(SearchEntityType)
  type?: SearchEntityType;
}
