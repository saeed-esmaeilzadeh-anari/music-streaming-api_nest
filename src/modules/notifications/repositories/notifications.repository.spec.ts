import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsRepository } from './notifications.repository';

describe('NotificationsRepository', () => {
  const notificationId = 'notification-1';
  const userId = 'user-1';
  let prisma: {
    notification: {
      updateMany: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
    };
  };
  let repository: NotificationsRepository;

  beforeEach(() => {
    prisma = {
      notification: {
        updateMany: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
    };
    repository = new NotificationsRepository(prisma as unknown as PrismaService);
  });

  it('uses both notification id and owner id when marking a notification read', async () => {
    const notification = { id: notificationId, userId, isRead: true };
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    prisma.notification.findFirst.mockResolvedValue(notification);

    const result = await repository.markRead(notificationId, userId);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: notificationId, userId },
    });
    expect(result).toEqual(notification);
  });

  it('does not reveal or update notifications that belong to another user', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });

    const result = await repository.markRead(notificationId, userId);

    expect(result).toBeNull();
    expect(prisma.notification.findFirst).not.toHaveBeenCalled();
  });

  it('marks all unread notifications only for the current user', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 2 });

    await repository.markAllRead(userId);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  });

  it('paginates notifications for a single owner in reverse chronological order', async () => {
    prisma.notification.findMany.mockResolvedValue([]);

    await repository.findMany({ userId, skip: 10, take: 5 });

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId },
      skip: 10,
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
  });
});
