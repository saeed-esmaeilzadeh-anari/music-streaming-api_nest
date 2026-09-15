import { ApiProperty } from '@nestjs/swagger';

export class PresignedUploadResponseDto {
  @ApiProperty()
  uploadId: string;

  @ApiProperty({ description: 'PUT this URL directly with the file body to upload to S3.' })
  uploadUrl: string;

  @ApiProperty()
  s3Key: string;

  @ApiProperty({ description: 'Seconds until the presigned URL expires.' })
  expiresIn: number;
}
