import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../../queue/queue.constants';

interface DispatchJobData {
  notificationId: string;
  userId: string;
}
// test 1
/**
 * Handles actual delivery of a persisted notification - push notification,
 * websocket emit, or email, depending on user preferences. Kept as a
 * separate worker from the listener that creates the DB record so delivery
 * retries (flaky push provider, etc) don't risk re-creating duplicate
 * notification rows.
 */
@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationsDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsDispatchProcessor.name);

  async process(job: Job<DispatchJobData>): Promise<void> {
    const { notificationId, userId } = job.data;
    // Placeholder integration point: push provider (FCM/APNs), websocket
    // gateway broadcast, or transactional email - swap in the real client here.
    this.logger.log(`Dispatching notification ${notificationId} to user ${userId}`);
  }
}
