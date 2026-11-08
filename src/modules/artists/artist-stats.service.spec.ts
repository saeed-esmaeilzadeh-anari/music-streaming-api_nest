import { ArtistStatsService } from './artist-stats.service';

describe('ArtistStatsService', () => {
  let prisma: { $executeRaw: jest.Mock };
  let cache: { delByPrefix: jest.Mock };
  let service: ArtistStatsService;

  beforeEach(() => {
    prisma = { $executeRaw: jest.fn().mockResolvedValue(2) };
    cache = { delByPrefix: jest.fn().mockResolvedValue(undefined) };
    service = new ArtistStatsService(prisma as unknown as never, cache as unknown as never);
  });

  it('runs the set-based recompute and invalidates artist caches', async () => {
    const result = await service.recomputeMonthlyListeners();

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(cache.delByPrefix).toHaveBeenCalledWith('artists:');
    expect(result).toEqual({ updated: 2, reset: 2 });
  });

  it('propagates SQL failures so the queue can retry the job', async () => {
    prisma.$executeRaw.mockRejectedValue(new Error('db down'));

    await expect(service.recomputeMonthlyListeners()).rejects.toThrow('db down');
    expect(cache.delByPrefix).not.toHaveBeenCalled();
  });
});
