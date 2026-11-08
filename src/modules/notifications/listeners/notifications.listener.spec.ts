import { Queue } from 'bullmq';
import { NotificationsRepository } from '../repositories/notifications.repository';
import { NotificationsEventListener } from './notifications.listener';
import { CommentCreatedEvent, LikeCreatedEvent, UserFollowedEvent } from '../../../events';
import { NOTIFICATION_JOBS } from '../../../queue/queue.constants';

describe('NotificationsEventListener', () => {
  let repository: { create: jest.Mock };
  let queue: { add: jest.Mock };
  let prisma: { notificationPreference: { findUnique: jest.Mock } };
  let listener: NotificationsEventListener;

  beforeEach(() => {
    repository = { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) };
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    prisma = {
      notificationPreference: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    listener = new NotificationsEventListener(
      repository as unknown as NotificationsRepository,
      prisma as unknown as never,
      queue as unknown as Queue,
    );
  });

  it('persists and queues a like notification for the content owner', async () => {
    await listener.onLikeCreated(
      new LikeCreatedEvent('listener-user', 'TRACK', 'track-1', 'artist-owner'),
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { connect: { id: 'artist-owner' } },
        type: 'LIKE_RECEIVED',
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(NOTIFICATION_JOBS.DISPATCH, {
      notificationId: 'notification-1',
      userId: 'artist-owner',
    });
  });

  it('does not notify for self-likes or events without a resolved owner', async () => {
    await listener.onLikeCreated(
      new LikeCreatedEvent('same-user', 'TRACK', 'track-1', 'same-user'),
    );
    await listener.onLikeCreated(new LikeCreatedEvent('actor', 'TRACK', 'track-1', null));

    expect(repository.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('persists and queues a comment notification for the content owner', async () => {
    await listener.onCommentCreated(
      new CommentCreatedEvent('comment-1', 'comment-author', 'TRACK', 'artist-owner'),
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { connect: { id: 'artist-owner' } },
        type: 'COMMENT_REPLY',
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(NOTIFICATION_JOBS.DISPATCH, {
      notificationId: 'notification-1',
      userId: 'artist-owner',
    });
  });

  it('does not notify a user about their own comment', async () => {
    await listener.onCommentCreated(
      new CommentCreatedEvent('comment-1', 'same-user', 'TRACK', 'same-user'),
    );

    expect(repository.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('persists and queues a NEW_FOLLOWER notification for the followee', async () => {
    await listener.onUserFollowed(new UserFollowedEvent('follower-user', 'saeed', 'artist-owner'));

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { connect: { id: 'artist-owner' } },
        type: 'NEW_FOLLOWER',
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(NOTIFICATION_JOBS.DISPATCH, {
      notificationId: 'notification-1',
      userId: 'artist-owner',
    });
  });

  it('skips notification creation when the target user disabled the category', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({ newFollower: false });

    await listener.onUserFollowed(new UserFollowedEvent('follower-user', 'saeed', 'artist-owner'));

    expect(repository.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('still notifies when no preference row exists (defaults enabled)', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue(null);

    await listener.onUserFollowed(new UserFollowedEvent('follower-user', 'saeed', 'artist-owner'));

    expect(repository.create).toHaveBeenCalledTimes(1);
  });
});
