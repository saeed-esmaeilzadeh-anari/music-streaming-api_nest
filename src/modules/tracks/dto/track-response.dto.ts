import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
class TrackArtistSummaryDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  stageName: string;
}

@Exclude()
export class TrackResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  title: string;

  @Expose()
  @ApiProperty()
  durationSec: number;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  audioUrl?: string | null;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  coverUrl?: string | null;

  @Expose()
  @ApiProperty()
  status: string;

  @Expose()
  @ApiProperty()
  isExplicit: boolean;

  @Expose()
  @ApiProperty({ description: 'Serialized as string to safely represent BigInt over JSON.' })
  @Type(() => String)
  playCount: string;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  albumId?: string | null;

  @Expose()
  @ApiProperty({ type: TrackArtistSummaryDto })
  @Type(() => TrackArtistSummaryDto)
  artist: TrackArtistSummaryDto;

  @Expose()
  @ApiProperty()
  createdAt: Date;
}
