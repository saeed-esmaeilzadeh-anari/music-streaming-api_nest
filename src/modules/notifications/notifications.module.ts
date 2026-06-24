import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './repositories/notifications.repository';
import { NotificationsEventListener } from './listeners/notifications.listener';
import { NotificationsDispatchProcessor } from './listeners/notifications-dispatch.processor';
import { QUEUE_NAMES } from '../../queue/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS })],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsEventListener,
    NotificationsDispatchProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
