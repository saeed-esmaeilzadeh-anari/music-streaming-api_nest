import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class ConfirmUploadDto {
  @ApiProperty({ description: 'The uploadId returned when the presigned URL was requested.' })
  @IsUUID()
  uploadId: string;

  @ApiProperty({ required: false, description: 'Size of the uploaded file in bytes, if known.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}
