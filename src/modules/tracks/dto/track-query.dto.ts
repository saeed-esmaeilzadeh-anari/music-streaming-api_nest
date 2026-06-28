import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export enum TrackStatusFilter {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

export class TrackQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by partial title match (case-insensitive).' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  artistId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  albumId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  genreId?: string;

  @ApiPropertyOptional({ enum: TrackStatusFilter })
  @IsOptional()
  @IsEnum(TrackStatusFilter)
  status?: TrackStatusFilter;
}
