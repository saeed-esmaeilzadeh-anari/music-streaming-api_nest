import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ArtistResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  userId: string;

  @Expose()
  @ApiProperty()
  stageName: string;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  bio?: string | null;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  bannerUrl?: string | null;

  @Expose()
  @ApiProperty()
  isVerified: boolean;

  @Expose()
  @ApiProperty()
  monthlyListeners: number;

  @Expose()
  @ApiProperty()
  createdAt: Date;
}
