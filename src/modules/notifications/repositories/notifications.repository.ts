import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.NotificationCreateInput): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  markRead(id: string): Promise<Notification> {
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  markAllRead(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async findMany(params: {
    userId: string;
    skip?: number;
    take?: number;
  }): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId: params.userId },
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  count(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId } });
  }

  countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }
}
