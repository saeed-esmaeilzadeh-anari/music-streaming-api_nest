import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { NotificationsRepository } from './repositories/notifications.repository';
import { NotificationResponseDto } from './dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  async findOwn(userId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [notifications, totalItems] = await Promise.all([
      this.notificationsRepository.findMany({ userId, skip: query.skip, take: limit }),
      this.notificationsRepository.count(userId),
    ]);

    return new PaginatedResultDto(
      notifications.map((n) =>
        plainToInstance(NotificationResponseDto, n, { excludeExtraneousValues: true }),
      ),
      totalItems,
      page,
      limit,
    );
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationsRepository.countUnread(userId);
    return { count };
  }

  async markRead(id: string): Promise<NotificationResponseDto> {
    const notification = await this.notificationsRepository.markRead(id);
    return plainToInstance(NotificationResponseDto, notification, {
      excludeExtraneousValues: true,
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationsRepository.markAllRead(userId);
  }
}
