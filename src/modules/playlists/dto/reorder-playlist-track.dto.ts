import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ReorderPlaylistTrackDto {
  @ApiProperty({ description: 'New zero-based position for this track within the playlist.' })
  @IsInt()
  @Min(0)
  position: number;
}
