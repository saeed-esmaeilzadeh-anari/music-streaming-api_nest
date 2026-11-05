import { ConflictException, NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { FavoritesRepository } from './repositories/favorites.repository';

describe('FavoritesService', () => {
  const userId = 'user-1';
  const trackId = 'track-1';
  let repository: {
    findOne: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  let service: FavoritesService;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    };
    service = new FavoritesService(repository as unknown as FavoritesRepository);
  });

  it('creates a favorite and returns only the public response fields', async () => {
    repository.findOne.mockResolvedValue(null);
    repository.create.mockResolvedValue({
      id: 'favorite-1',
      userId,
      trackId,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.add(userId, trackId);

    expect(repository.create).toHaveBeenCalledWith({
      user: { connect: { id: userId } },
      track: { connect: { id: trackId } },
    });
    expect(result).toMatchObject({ id: 'favorite-1', trackId });
    expect(result).not.toHaveProperty('userId');
  });

  it('rejects duplicate favorites instead of creating a second row', async () => {
    repository.findOne.mockResolvedValue({ id: 'favorite-1', trackId });

    await expect(service.add(userId, trackId)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('deletes only an existing favorite for the given user', async () => {
    repository.findOne.mockResolvedValue({ id: 'favorite-1', userId, trackId });
    repository.delete.mockResolvedValue({});

    await service.remove(userId, trackId);

    expect(repository.delete).toHaveBeenCalledWith(userId, trackId);
  });

  it('returns 404 semantics when removing a favorite that does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.remove(userId, trackId)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('returns a paginated list belonging only to the requested user', async () => {
    repository.findMany.mockResolvedValue([{ id: 'favorite-1', userId, trackId, createdAt: new Date() }]);
    repository.count.mockResolvedValue(1);

    const result = await service.findAll(userId, { page: 1, limit: 10 });

    expect(repository.findMany).toHaveBeenCalledWith({ userId, skip: 0, take: 10 });
    expect(repository.count).toHaveBeenCalledWith(userId);
    expect(result.items).toHaveLength(1);
    expect(result.totalItems).toBe(1);
  });
});
