import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum UploadAssetTypeDto {
  TRACK_AUDIO = 'TRACK_AUDIO',
  TRACK_COVER = 'TRACK_COVER',
  ALBUM_COVER = 'ALBUM_COVER',
  ARTIST_AVATAR = 'ARTIST_AVATAR',
  ARTIST_BANNER = 'ARTIST_BANNER',
  PLAYLIST_COVER = 'PLAYLIST_COVER',
  USER_AVATAR = 'USER_AVATAR',
}

export class RequestUploadDto {
  @ApiProperty({ enum: UploadAssetTypeDto })
  @IsEnum(UploadAssetTypeDto)
  assetType: UploadAssetTypeDto;

  @ApiProperty({ example: 'my-track.mp3' })
  @IsString()
  @MaxLength(255)
  originalName: string;

  @ApiProperty({ example: 'audio/mpeg' })
  @IsString()
  mimeType: string;

  @ApiProperty({
    required: false,
    description: 'Associate this upload with an existing track (required for TRACK_AUDIO / TRACK_COVER).',
  })
  @IsOptional()
  @IsUUID()
  trackId?: string;
}
