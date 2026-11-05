import { NotFoundException } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { NotificationsRepository } from './repositories/notifications.repository';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const userId = 'user-1';
  const notificationId = 'notification-1';
  const notification = {
    id: notificationId,
    userId,
    type: 'LIKE',
    title: 'New like',
    body: 'Someone liked your track',
    isRead: true,
    createdAt: new Date(),
  };
  let repository: {
    findMany: jest.Mock;
    count: jest.Mock;
    countUnread: jest.Mock;
    markRead: jest.Mock;
    markAllRead: jest.Mock;
  };
  let service: NotificationsService;

  beforeEach(() => {
    repository = {
      findMany: jest.fn(),
      count: jest.fn(),
      countUnread: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };
    service = new NotificationsService(repository as unknown as NotificationsRepository);
  });

  it('returns only notifications owned by the authenticated user', async () => {
    repository.findMany.mockResolvedValue([notification]);
    repository.count.mockResolvedValue(1);
    const query = Object.assign(new PaginationQueryDto(), { page: 1, limit: 10 });

    const result = await service.findOwn(userId, query);

    expect(repository.findMany).toHaveBeenCalledWith({ userId, skip: 0, take: 10 });
    expect(repository.count).toHaveBeenCalledWith(userId);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: notificationId, title: 'New like' });
    expect(result.meta.totalItems).toBe(1);
  });

  it('returns the unread count for the specified owner only', async () => {
    repository.countUnread.mockResolvedValue(3);

    await expect(service.unreadCount(userId)).resolves.toEqual({ count: 3 });
    expect(repository.countUnread).toHaveBeenCalledWith(userId);
  });

  it('marks a notification read only when it belongs to the requester', async () => {
    repository.markRead.mockResolvedValue(notification);

    const result = await service.markRead(notificationId, userId);

    expect(repository.markRead).toHaveBeenCalledWith(notificationId, userId);
    expect(result).toMatchObject({ id: notificationId, isRead: true });
  });

  it('returns not found when the notification is owned by another user or does not exist', async () => {
    repository.markRead.mockResolvedValue(null);

    await expect(service.markRead(notificationId, userId)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.markRead).toHaveBeenCalledWith(notificationId, userId);
  });

  it('marks all notifications read only for the requested user', async () => {
    repository.markAllRead.mockResolvedValue({ count: 4 });

    await service.markAllRead(userId);

    expect(repository.markAllRead).toHaveBeenCalledWith(userId);
  });
});
