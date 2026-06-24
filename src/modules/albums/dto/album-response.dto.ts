import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class AlbumResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  title: string;

  @Expose()
  @ApiProperty()
  type: string;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  coverUrl?: string | null;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  releaseDate?: Date | null;

  @Expose()
  @ApiProperty()
  artistId: string;

  @Expose()
  @ApiProperty()
  isPublished: boolean;

  @Expose()
  @ApiProperty()
  createdAt: Date;
}
