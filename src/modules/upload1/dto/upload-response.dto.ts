import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UploadResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  assetType: string;

  @Expose()
  @ApiProperty()
  status: string;

  @Expose()
  @ApiProperty()
  s3Key: string;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  trackId?: string | null;

  @Expose()
  @ApiProperty()
  createdAt: Date;
}
