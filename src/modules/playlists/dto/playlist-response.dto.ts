import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { TrackResponseDto } from '../../tracks/dto/track-response.dto';

@Exclude()
export class PlaylistTrackEntryResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  trackId: string;

  @Expose()
  @ApiProperty()
  position: number;

  @Expose()
  @ApiProperty()
  addedAt: Date;

  @Expose()
  @Type(() => TrackResponseDto)
  @ApiProperty({ type: TrackResponseDto })
  track: TrackResponseDto;
}

@Exclude()
export class PlaylistResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  title: string;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  description?: string | null;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  coverUrl?: string | null;

  @Expose()
  @ApiProperty()
  visibility: string;

  @Expose()
  @ApiProperty()
  ownerId: string;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @Type(() => PlaylistTrackEntryResponseDto)
  @ApiProperty({ type: [PlaylistTrackEntryResponseDto] })
  tracks: PlaylistTrackEntryResponseDto[];
}
