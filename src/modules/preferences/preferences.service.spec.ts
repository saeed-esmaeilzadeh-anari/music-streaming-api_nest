import { NotFoundException } from '@nestjs/common';
import { UserPreferencesService, NotificationPreferencesService } from './preferences.service';

describe('UserPreferencesService', () => {
  const userId = 'user-1';
  let prisma: {
    userPreference: { findUnique: jest.Mock; upsert: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  let service: UserPreferencesService;

  beforeEach(() => {
    prisma = {
      userPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: userId, deletedAt: null }) },
    };
    service = new UserPreferencesService(prisma as unknown as never);
  });

  it('returns lowercase defaults when no row exists yet', async () => {
    await expect(service.getForUser(userId)).resolves.toEqual({
      theme: 'dark',
      accent: 'emerald',
      language: 'fa',
      reducedMotion: false,
      publicProfile: true,
      showListeningActivity: true,
    });
    expect(prisma.userPreference.upsert).not.toHaveBeenCalled();
  });

  it('maps stored enum rows back to lowercase wire format', async () => {
    prisma.userPreference.findUnique.mockResolvedValue({
      theme: 'LIGHT',
      accent: 'VIOLET',
      language: 'EN',
      reducedMotion: true,
      publicProfile: false,
      showListeningActivity: false,
    });

    await expect(service.getForUser(userId)).resolves.toEqual({
      theme: 'light',
      accent: 'violet',
      language: 'en',
      reducedMotion: true,
      publicProfile: false,
      showListeningActivity: false,
    });
  });

  it('upserts only the provided fields and persists on first PATCH', async () => {
    prisma.userPreference.upsert.mockResolvedValue({
      theme: 'DARK',
      accent: 'EMERALD',
      language: 'FA',
      reducedMotion: false,
      publicProfile: true,
      showListeningActivity: false,
    });

    const result = await service.updateForUser(userId, {
      theme: 'DARK' as never, // DTO already normalized the wire value
      showListeningActivity: false,
    } as never);

    expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId },
      create: { userId, theme: 'DARK', showListeningActivity: false },
      update: { theme: 'DARK', showListeningActivity: false },
    });
    expect(result).toMatchObject({ theme: 'dark', showListeningActivity: false });
  });

  it('rejects preference changes for soft-deleted users', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: userId, deletedAt: new Date() });

    await expect(service.getForUser(userId)).resolves.toBeTruthy(); // read stays safe
    await expect(service.updateForUser(userId, { theme: 'DARK' } as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('NotificationPreferencesService', () => {
  const userId = 'user-2';
  let prisma: {
    notificationPreference: { findUnique: jest.Mock; upsert: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  let service: NotificationPreferencesService;

  beforeEach(() => {
    prisma = {
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: userId, deletedAt: null }) },
    };
    service = new NotificationPreferencesService(prisma as unknown as never);
  });

  it('returns full defaults when no row exists', async () => {
    await expect(service.getForUser(userId)).resolves.toEqual({
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
    });
  });

  it('upserts only provided toggles', async () => {
    prisma.notificationPreference.upsert.mockResolvedValue({
      newFollower: false,
      newRelease: true,
      playlistAdd: true,
      commentReply: true,
      likeReceived: true,
      subscriptionUpdate: true,
      paymentAlert: true,
      systemMessage: true,
      pushEnabled: true,
      emailDigest: false,
    });

    await service.updateForUser(userId, { newFollower: false } as never);

    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
      where: { userId },
      create: { userId, newFollower: false },
      update: { newFollower: false },
    });
  });
});
