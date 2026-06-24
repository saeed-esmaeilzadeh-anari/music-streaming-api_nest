import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

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
}
