import { IsUUID, IsOptional, IsInt, Min } from 'class-validator';

export class ConfirmUploadDto {
  @IsUUID()
  uploadId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}
