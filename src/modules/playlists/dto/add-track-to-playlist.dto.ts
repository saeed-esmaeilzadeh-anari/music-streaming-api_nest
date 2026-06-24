import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class AddTrackToPlaylistDto {
  @ApiProperty()
  @IsUUID()
  trackId: string;

  @ApiPropertyOptional({ description: 'Position to insert at; defaults to end of playlist.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
