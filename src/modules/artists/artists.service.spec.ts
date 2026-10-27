import { ConflictException, NotFoundException } from '@nestjs/common';
import { ArtistsService } from './artists.service';
import { ArtistsRepository } from './repositories/artists.repository';

describe('ArtistsService artist onboarding', () => {
  const artist = {
    id: 'artist-id',
    userId: 'user-id',
    stageName: 'Test Artist',
    bio: 'Independent artist',
    bannerUrl: null,
    isVerified: false,
    monthlyListeners: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let repository: jest.Mocked<Pick<ArtistsRepository, 'createForUser' | 'findByUserId'>>;
  let service: ArtistsService;

  beforeEach(() => {
    repository = {
      createForUser: jest.fn(),
      findByUserId: jest.fn(),
    };
    service = new ArtistsService(repository as unknown as ArtistsRepository);
  });

  it('creates the profile and returns its public DTO', async () => {
    repository.createForUser.mockResolvedValue({ status: 'created', artist } as never);

    const result = await service.createProfile('user-id', {
      stageName: 'Test Artist',
      bio: 'Independent artist',
    });

    expect(repository.createForUser).toHaveBeenCalledWith('user-id', {
      stageName: 'Test Artist',
      bio: 'Independent artist',
    });
    expect(result).toMatchObject({
      id: 'artist-id',
      userId: 'user-id',
      stageName: 'Test Artist',
      bio: 'Independent artist',
    });
  });

  it('rejects duplicate artist profiles with a conflict', async () => {
    repository.createForUser.mockResolvedValue({ status: 'existing', artist } as never);

    await expect(
      service.createProfile('user-id', { stageName: 'Test Artist' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects onboarding for a missing or deleted account', async () => {
    repository.createForUser.mockResolvedValue({ status: 'missing-user' } as never);

    await expect(
      service.createProfile('missing-user', { stageName: 'Test Artist' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns null from the current-profile lookup when setup has not started', async () => {
    repository.findByUserId.mockResolvedValue(null);

    await expect(service.findOwnProfile('user-id')).resolves.toBeNull();
  });
});
