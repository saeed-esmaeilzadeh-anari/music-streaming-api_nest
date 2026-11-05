import { ListeningHistoryRepository } from './repositories/listening-history.repository';
import { ListeningHistoryService } from './listening-history.service';
import { TrackPlayedEvent } from '../../events';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

describe('ListeningHistoryService', () => {
  const userId = 'user-1';
  const trackId = 'track-1';
  let repository: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  let service: ListeningHistoryService;

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn(),
      count: jest.fn(),
    };
    service = new ListeningHistoryService(repository as unknown as ListeningHistoryRepository);
  });

  it('persists a play event and marks a 30-second listen completed', async () => {
    await service.handleTrackPlayed(new TrackPlayedEvent(userId, trackId, 30));

    expect(repository.create).toHaveBeenCalledWith({
      user: { connect: { id: userId } },
      track: { connect: { id: trackId } },
      progressSec: 30,
      completed: true,
    });
  });

  it('keeps short listens incomplete', async () => {
    await service.handleTrackPlayed(new TrackPlayedEvent(userId, trackId, 12));

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      progressSec: 12,
      completed: false,
    }));
  });

  it('does not throw when history persistence fails', async () => {
    repository.create.mockRejectedValue(new Error('database unavailable'));

    await expect(service.handleTrackPlayed(new TrackPlayedEvent(userId, trackId, 5)))
      .resolves.toBeUndefined();
  });

  it('returns only the current user history in a paginated response', async () => {
    repository.findMany.mockResolvedValue([{
      id: 'history-1',
      userId,
      trackId,
      progressSec: 31,
      completed: true,
      playedAt: new Date(),
    }]);
    repository.count.mockResolvedValue(1);
    const query = Object.assign(new PaginationQueryDto(), { page: 1, limit: 5 });

    const result = await service.findOwn(userId, query);

    expect(repository.findMany).toHaveBeenCalledWith({ userId, skip: 0, take: 5 });
    expect(result.items).toHaveLength(1);
    expect(result.meta.totalItems).toBe(1);
  });
});
