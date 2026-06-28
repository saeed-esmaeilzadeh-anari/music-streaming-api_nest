import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationsRepository } from '../repositories/notifications.repository';
import {
  DOMAIN_EVENTS,
  CommentCreatedEvent,
  LikeCreatedEvent,
  SubscriptionRenewedEvent,
  PaymentFailedEvent,
} from '../../../events';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../../../queue/queue.constants';
// test
/**
 * Central place where cross-module domain events become persisted
 * notifications. Each handler is intentionally defensive (no throwing) so a
 * failure to notify never breaks the originating action (e.g. liking a
 * track should never fail because a notification couldn't be written).
 *
 * After persisting, a lightweight BullMQ job is enqueued to handle actual
 * delivery (push/email/websocket) asynchronously - this service only owns
 * the "what happened" record, not the delivery mechanism.
 */
@Injectable()
export class NotificationsEventListener {
  private readonly logger = new Logger(NotificationsEventListener.name);

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
  ) {}

  @OnEvent(DOMAIN_EVENTS.COMMENT_CREATED, { async: true })
  async onCommentCreated(event: CommentCreatedEvent): Promise<void> {
    if (!event.targetOwnerId || event.targetOwnerId === event.authorId) return;
    await this.createAndDispatch(event.targetOwnerId, 'COMMENT_REPLY', {
      title: 'New comment',
      body: 'Someone commented on your content.',
      metadata: { commentId: event.commentId },
    });
  }

  @OnEvent(DOMAIN_EVENTS.LIKE_CREATED, { async: true })
  async onLikeCreated(event: LikeCreatedEvent): Promise<void> {
    if (!event.targetOwnerId || event.targetOwnerId === event.userId) return;
    await this.createAndDispatch(event.targetOwnerId, 'LIKE_RECEIVED', {
      title: 'New like',
      body: `Someone liked your ${event.targetType.toLowerCase()}.`,
      metadata: { targetId: event.targetId, targetType: event.targetType },
    });
  }

  @OnEvent(DOMAIN_EVENTS.SUBSCRIPTION_RENEWED, { async: true })
  async onSubscriptionRenewed(event: SubscriptionRenewedEvent): Promise<void> {
    await this.createAndDispatch(event.userId, 'SUBSCRIPTION_RENEWED', {
      title: 'Subscription renewed',
      body: `Your subscription has been renewed through ${event.currentPeriodEnd.toDateString()}.`,
      metadata: { subscriptionId: event.subscriptionId },
    });
  }

  @OnEvent(DOMAIN_EVENTS.PAYMENT_FAILED, { async: true })
  async onPaymentFailed(event: PaymentFailedEvent): Promise<void> {
    await this.createAndDispatch(event.userId, 'PAYMENT_FAILED', {
      title: 'Payment failed',
      body: `We couldn't process your payment: ${event.reason}`,
      metadata: { paymentId: event.paymentId },
    });
  }

  private async createAndDispatch(
    userId: string,
    type: string,
    payload: { title: string; body: string; metadata?: Record<string, unknown> },
  ): Promise<void> {
    try {
      const notification = await this.notificationsRepository.create({
        user: { connect: { id: userId } },
        type: type as never,
        title: payload.title,
        body: payload.body,
        metadata: payload.metadata,
      });

      await this.notificationsQueue.add(NOTIFICATION_JOBS.DISPATCH, {
        notificationId: notification.id,
        userId,
      });
    } catch (error) {
      this.logger.error(`Failed to create notification for user ${userId}: ${error}`);
    }
  }
}
