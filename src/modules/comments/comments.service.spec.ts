import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CommentsRepository } from './repositories/comments.repository';
import { CommentsService } from './comments.service';
import { CommentTargetTypeDto } from './dto/create-comment.dto';

describe('CommentsService', () => {
  const userId = 'user-1';
  const otherUserId = 'user-2';
  const commentId = 'comment-1';
  const trackId = 'track-1';
  let repository: {
    create: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findByTarget: jest.Mock;
    countByTarget: jest.Mock;
  };
  let events: { emit: jest.Mock };
  let service: CommentsService;

  const comment = {
    id: commentId,
    userId,
    content: 'A comment',
    targetType: CommentTargetTypeDto.TRACK,
    trackId,
    parentId: null,
    isEdited: false,
    createdAt: new Date(),
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByTarget: jest.fn(),
      countByTarget: jest.fn(),
    };
    events = { emit: jest.fn() };
    service = new CommentsService(
      repository as unknown as CommentsRepository,
      events as unknown as EventEmitter2,
    );
  });

  it('creates a track comment and emits the comment-created event', async () => {
    repository.create.mockResolvedValue(comment);

    const result = await service.create(userId, {
      content: 'A comment',
      targetType: CommentTargetTypeDto.TRACK,
      targetId: trackId,
    });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      content: 'A comment',
      targetType: CommentTargetTypeDto.TRACK,
      user: { connect: { id: userId } },
      track: { connect: { id: trackId } },
    }));
    expect(result).toMatchObject({ id: commentId, userId, content: 'A comment' });
    expect(events.emit).toHaveBeenCalledTimes(1);
  });

  it('requires an existing parent comment before creating a reply', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.create(userId, {
      content: 'A reply',
      targetType: CommentTargetTypeDto.TRACK,
      targetId: trackId,
      parentId: 'missing-parent',
    })).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('allows the author to edit their comment', async () => {
    repository.findById.mockResolvedValue(comment);
    repository.update.mockResolvedValue({ ...comment, content: 'Edited', isEdited: true });

    const result = await service.update(commentId, userId, { content: 'Edited' });

    expect(repository.update).toHaveBeenCalledWith(commentId, {
      content: 'Edited',
      isEdited: true,
    });
    expect(result.content).toBe('Edited');
  });

  it('blocks a different user from editing the comment', async () => {
    repository.findById.mockResolvedValue(comment);

    await expect(service.update(commentId, otherUserId, { content: 'Hijacked' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('allows only the author or staff to delete a comment', async () => {
    repository.findById.mockResolvedValue(comment);

    await expect(service.remove(commentId, otherUserId, false))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.delete).not.toHaveBeenCalled();

    await service.remove(commentId, otherUserId, true);
    expect(repository.delete).toHaveBeenCalledWith(commentId);
  });

  it('returns paginated comments for a target', async () => {
    repository.findByTarget.mockResolvedValue([comment]);
    repository.countByTarget.mockResolvedValue(1);
    const query = Object.assign(new PaginationQueryDto(), { page: 1, limit: 10 });

    const result = await service.findByTarget('TRACK', trackId, query);

    expect(repository.findByTarget).toHaveBeenCalledWith({
      targetType: CommentTargetTypeDto.TRACK,
      targetId: trackId,
      skip: 0,
      take: 10,
    });
    expect(result.items).toHaveLength(1);
    expect(result.meta.totalItems).toBe(1);
  });
});
