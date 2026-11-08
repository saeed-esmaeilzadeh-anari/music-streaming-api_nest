import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export enum ReportTargetTypeWire {
  TRACK = 'TRACK',
  ALBUM = 'ALBUM',
  PLAYLIST = 'PLAYLIST',
  COMMENT = 'COMMENT',
  USER = 'USER',
  ARTIST = 'ARTIST',
}

export enum ReportReasonWire {
  COPYRIGHT = 'COPYRIGHT',
  EXPLICIT_CONTENT = 'EXPLICIT_CONTENT',
  SPAM = 'SPAM',
  HARASSMENT = 'HARASSMENT',
  MISINFORMATION = 'MISINFORMATION',
  OTHER = 'OTHER',
}

export enum ResolveActionWire {
  RESOLVE = 'RESOLVE',
  DISMISS = 'DISMISS',
}

const upperCase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateReportDto {
  @ApiProperty({ enum: Object.values(ReportTargetTypeWire) })
  @Transform(upperCase)
  @IsEnum(ReportTargetTypeWire)
  targetType!: ReportTargetTypeWire;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetId!: string;

  @ApiProperty({ enum: Object.values(ReportReasonWire) })
  @Transform(upperCase)
  @IsEnum(ReportReasonWire)
  reason!: ReportReasonWire;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  details?: string;
}

export class ResolveReportDto {
  @ApiProperty({ enum: Object.values(ResolveActionWire) })
  @Transform(upperCase)
  @IsEnum(ResolveActionWire)
  action!: ResolveActionWire;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNote?: string;
}

export enum ArtistVerificationActionWire {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class SetArtistVerificationDto {
  @ApiProperty({ enum: Object.values(ArtistVerificationActionWire) })
  @Transform(upperCase)
  @IsEnum(ArtistVerificationActionWire)
  status!: ArtistVerificationActionWire;
}
