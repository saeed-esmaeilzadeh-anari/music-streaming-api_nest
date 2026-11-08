import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

/**
 * Wire contract: preference enums travel LOWERCASE ("dark", "emerald", "fa").
 * The DTO deliberately accepts either case and normalizes to the Prisma enum
 * (UPPER) before hitting the service; responses are mapped back to lowercase.
 */
export enum ThemeWire {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

export enum AccentWire {
  EMERALD = 'emerald',
  VIOLET = 'violet',
  ROSE = 'rose',
  AMBER = 'amber',
  BLUE = 'blue',
}

export enum LanguageWire {
  FA = 'fa',
  EN = 'en',
}

const upperCase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class UpdateUserPreferencesDto {
  @ApiPropertyOptional({ enum: Object.values(ThemeWire) })
  @IsOptional()
  @Transform(upperCase)
  @IsEnum(ThemeWire)
  theme?: ThemeWire;

  @ApiPropertyOptional({ enum: Object.values(AccentWire) })
  @IsOptional()
  @Transform(upperCase)
  @IsEnum(AccentWire)
  accent?: AccentWire;

  @ApiPropertyOptional({ enum: Object.values(LanguageWire) })
  @IsOptional()
  @Transform(upperCase)
  @IsEnum(LanguageWire)
  language?: LanguageWire;

  @ApiPropertyOptional({ description: 'Reduce animations/transitions across the UI' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  reducedMotion?: boolean;

  @ApiPropertyOptional({ description: 'Whether the profile is publicly visible' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  publicProfile?: boolean;

  @ApiPropertyOptional({ description: 'Whether friends can see listening activity' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  showListeningActivity?: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  newFollower?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  newRelease?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  playlistAdd?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  commentReply?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  likeReceived?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  subscriptionUpdate?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  paymentAlert?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  systemMessage?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  emailDigest?: boolean;
}

/** Wire shape returned by GET/PATCH /users/me/preferences (lowercase enums). */
export interface UserPreferencesWire {
  theme: ThemeWire;
  accent: AccentWire;
  language: LanguageWire;
  reducedMotion: boolean;
  publicProfile: boolean;
  showListeningActivity: boolean;
}

/** Wire shape returned by GET/PATCH /notifications/preferences. */
export interface NotificationPreferencesWire {
  newFollower: boolean;
  newRelease: boolean;
  playlistAdd: boolean;
  commentReply: boolean;
  likeReceived: boolean;
  subscriptionUpdate: boolean;
  paymentAlert: boolean;
  systemMessage: boolean;
  pushEnabled: boolean;
  emailDigest: boolean;
}
