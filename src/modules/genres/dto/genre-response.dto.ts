import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class GenreResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty()
  slug: string;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  description?: string | null;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  imageUrl?: string | null;
}
