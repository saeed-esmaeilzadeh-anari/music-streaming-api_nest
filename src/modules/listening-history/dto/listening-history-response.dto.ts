import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ListeningHistoryResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  trackId: string;

  @Expose()
  @ApiProperty()
  playedAt: Date;

  @Expose()
  @ApiProperty()
  progressSec: number;

  @Expose()
  @ApiProperty()
  completed: boolean;
}
