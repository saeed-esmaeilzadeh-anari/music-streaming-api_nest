import { Injectable, NotFoundException } from '@nestjs/common';
import { ThemePreference, AccentPreference, LanguagePreference } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UpdateUserPreferencesDto,
  UserPreferencesWire,
  UpdateNotificationPreferencesDto,
  NotificationPreferencesWire,
  ThemeWire,
  AccentWire,
  LanguageWire,
} from './dto/preferences.dto';

/**
 * Server-synced user preferences. GET creates nothing: when no row exists
 * the compiled defaults are returned (and persisted only on first PATCH).
 * Enums are stored UPPER (Prisma) and travel lowercase on the wire.
 */
@Injectable()
export class UserPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaults: UserPreferencesWire = {
    theme: ThemeWire.DARK,
    accent: AccentWire.EMERALD,
    language: LanguageWire.FA,
    reducedMotion: false,
    publicProfile: true,
    showListeningActivity: true,
  };

  async getForUser(userId: string): Promise<UserPreferencesWire> {
    const row = await this.prisma.userPreference.findUnique({ where: { userId } });
    if (!row) {
      return { ...this.defaults };
    }
    return this.toWire(row);
  }

  async updateForUser(userId: string, dto: UpdateUserPreferencesDto): Promise<UserPreferencesWire> {
    await this.assertUserExists(userId);

    const data: {
      theme?: ThemePreference;
      accent?: AccentPreference;
      language?: LanguagePreference;
      reducedMotion?: boolean;
      publicProfile?: boolean;
      showListeningActivity?: boolean;
    } = {};

    if (dto.theme !== undefined) data.theme = dto.theme as unknown as ThemePreference;
    if (dto.accent !== undefined) data.accent = dto.accent as unknown as AccentPreference;
    if (dto.language !== undefined) data.language = dto.language as unknown as LanguagePreference;
    if (dto.reducedMotion !== undefined) data.reducedMotion = dto.reducedMotion;
    if (dto.publicProfile !== undefined) data.publicProfile = dto.publicProfile;
    if (dto.showListeningActivity !== undefined) {
      data.showListeningActivity = dto.showListeningActivity;
    }

    const row = await this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return this.toWire(row);
  }

  private async assertUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found.');
    }
  }

  private toWire(row: {
    theme: ThemePreference;
    accent: AccentPreference;
    language: LanguagePreference;
    reducedMotion: boolean;
    publicProfile: boolean;
    showListeningActivity: boolean;
  }): UserPreferencesWire {
    return {
      theme: row.theme.toLowerCase() as ThemeWire,
      accent: row.accent.toLowerCase() as AccentWire,
      language: row.language.toLowerCase() as LanguageWire,
      reducedMotion: row.reducedMotion,
      publicProfile: row.publicProfile,
      showListeningActivity: row.showListeningActivity,
    };
  }
}

/**
 * Per-category notification toggles. Missing row == "all defaults"; the
 * first PATCH persists the row.
 */
@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaults: NotificationPreferencesWire = {
    newFollower: true,
    newRelease: true,
    playlistAdd: true,
    commentReply: true,
    likeReceived: true,
    subscriptionUpdate: true,
    paymentAlert: true,
    systemMessage: true,
    pushEnabled: true,
    emailDigest: false,
  };

  async getForUser(userId: string): Promise<NotificationPreferencesWire> {
    const row = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    if (!row) {
      return { ...this.defaults };
    }
    return this.toWire(row);
  }

  async updateForUser(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesWire> {
    await this.assertUserExists(userId);

    const data: Partial<Record<keyof NotificationPreferencesWire, boolean>> = {};
    for (const key of Object.keys(this.defaults) as Array<keyof NotificationPreferencesWire>) {
      const value = dto[key];
      if (value !== undefined) {
        data[key] = value;
      }
    }

    const row = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return this.toWire(row);
  }

  private async assertUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found.');
    }
  }

  private toWire(row: NotificationPreferencesWire): NotificationPreferencesWire {
    return {
      newFollower: row.newFollower,
      newRelease: row.newRelease,
      playlistAdd: row.playlistAdd,
      commentReply: row.commentReply,
      likeReceived: row.likeReceived,
      subscriptionUpdate: row.subscriptionUpdate,
      paymentAlert: row.paymentAlert,
      systemMessage: row.systemMessage,
      pushEnabled: row.pushEnabled,
      emailDigest: row.emailDigest,
    };
  }
}
