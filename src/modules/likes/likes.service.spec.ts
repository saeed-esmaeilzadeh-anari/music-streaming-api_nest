import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LikesRepository } from './repositories/likes.repository';
import { LikesService } from './likes.service';
import { LikeTargetTypeDto } from './dto/create-like.dto';

describe('LikesService', () => {
  const userId = 'user-1';
  const trackId = 'track-1';
  let repository: {
    findOne: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    countForTarget: jest.Mock;
    findTargetOwnerId: jest.Mock;
  };
  let events: { emit: jest.Mock };
  let service: LikesService;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      countForTarget: jest.fn(),
      findTargetOwnerId: jest.fn(),
    };
    events = { emit: jest.fn() };
    service = new LikesService(
      repository as unknown as LikesRepository,
      events as unknown as EventEmitter2,
    );
  });

  it('creates a TRACK relation with the authenticated user and emits an event', async () => {
    repository.findOne.mockResolvedValue(null);
    repository.findTargetOwnerId.mockResolvedValue('artist-owner');
    repository.create.mockResolvedValue({
      id: 'like-1',
      userId,
      targetType: LikeTargetTypeDto.TRACK,
      trackId,
      createdAt: new Date(),
    });

    const result = await service.like(userId, { targetType: LikeTargetTypeDto.TRACK, targetId: trackId });

    expect(repository.create).toHaveBeenCalledWith({
      user: { connect: { id: userId } },
      targetType: LikeTargetTypeDto.TRACK,
      track: { connect: { id: trackId } },
    });
    expect(result).toMatchObject({ id: 'like-1', targetType: 'TRACK' });
    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit.mock.calls[0][1]).toMatchObject({ targetOwnerId: 'artist-owner' });
  });

  it('rejects likes for missing targets', async () => {
    repository.findOne.mockResolvedValue(null);
    repository.findTargetOwnerId.mockResolvedValue(null);

    await expect(service.like(userId, {
      targetType: LikeTargetTypeDto.TRACK,
      targetId: trackId,
    })).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.create).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('rejects duplicate likes', async () => {
    repository.findOne.mockResolvedValue({ id: 'like-1' });

    await expect(service.like(userId, { targetType: LikeTargetTypeDto.TRACK, targetId: trackId }))
      .rejects.toBeInstanceOf(ConflictException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('deletes an existing like', async () => {
    repository.findOne.mockResolvedValue({ id: 'like-1' });
    repository.delete.mockResolvedValue({});

    await service.unlike(userId, 'TRACK', trackId);

    expect(repository.delete).toHaveBeenCalledWith('like-1');
  });

  it('returns not found when unliking a missing relation', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.unlike(userId, 'TRACK', trackId))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('returns the current count for a target', async () => {
    repository.countForTarget.mockResolvedValue(7);

    await expect(service.count('TRACK', trackId)).resolves.toBe(7);
    expect(repository.countForTarget).toHaveBeenCalledWith('TRACK', trackId);
  });
});
