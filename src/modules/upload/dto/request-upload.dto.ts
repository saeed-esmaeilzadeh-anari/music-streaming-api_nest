import { IsEnum, IsString, IsOptional, IsUUID } from 'class-validator';
import { UploadAssetType } from '@prisma/client';

export class RequestUploadDto {
  @IsEnum(UploadAssetType)
  assetType: UploadAssetType;

  @IsString()
  originalName: string;

  @IsString()
  mimeType: string;

  /** Required when assetType is TRACK_AUDIO or TRACK_COVER */
  @IsOptional()
  @IsUUID()
  trackId?: string;
}
