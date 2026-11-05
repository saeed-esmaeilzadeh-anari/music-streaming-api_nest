import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlaylistsService } from './playlists.service';
import { PlaylistsRepository } from './repositories/playlists.repository';
import { PlaylistVisibilityDto } from './dto/create-playlist.dto';

describe('PlaylistsService', () => {
  const ownerId = 'owner-1';
  const otherUserId = 'other-1';
  const playlistId = 'playlist-1';
  const trackId = 'track-1';

  let repository: {
    create: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    getMaxTrackPosition: jest.Mock;
    addTrack: jest.Mock;
    removeTrack: jest.Mock;
    updateTrackPosition: jest.Mock;
    findTrackEntry: jest.Mock;
  };
  let events: { emit: jest.Mock };
  let service: PlaylistsService;

  const playlist = {
    id: playlistId,
    ownerId,
    title: 'Test playlist',
    description: null,
    coverUrl: null,
    visibility: PlaylistVisibilityDto.PRIVATE,
    createdAt: new Date(),
    tracks: [],
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      getMaxTrackPosition: jest.fn(),
      addTrack: jest.fn(),
      removeTrack: jest.fn(),
      updateTrackPosition: jest.fn(),
      findTrackEntry: jest.fn(),
    };
    events = { emit: jest.fn() };
    service = new PlaylistsService(
      repository as unknown as PlaylistsRepository,
      events as unknown as EventEmitter2,
    );
  });

  it('creates playlists with the authenticated user as owner', async () => {
    repository.create.mockResolvedValue(playlist);

    const result = await service.create(ownerId, {
      title: 'Test playlist',
      visibility: 'PRIVATE',
    });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Test playlist',
      owner: { connect: { id: ownerId } },
    }));
    expect(result).toMatchObject({ id: playlistId, ownerId });
  });

  it('does not let another user read a private playlist', async () => {
    repository.findById.mockResolvedValue(playlist);

    await expect(service.findById(playlistId, otherUserId))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an owner to read their private playlist', async () => {
    repository.findById.mockResolvedValue(playlist);

    const result = await service.findById(playlistId, ownerId);

    expect(result.id).toBe(playlistId);
  });

  it('rejects metadata updates from a non-owner', async () => {
    repository.findById.mockResolvedValue(playlist);

    await expect(service.update(playlistId, otherUserId, { title: 'Hijacked' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('adds a track at the end of the playlist and emits the domain event', async () => {
    repository.findById.mockResolvedValue(playlist);
    repository.findTrackEntry.mockResolvedValue(null);
    repository.getMaxTrackPosition.mockResolvedValue(2);
    repository.addTrack.mockResolvedValue({});

    await service.addTrack(playlistId, ownerId, { trackId });

    expect(repository.addTrack).toHaveBeenCalledWith(playlistId, trackId, 3);
    expect(events.emit).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate playlist tracks', async () => {
    repository.findById.mockResolvedValue(playlist);
    repository.findTrackEntry.mockResolvedValue({ playlistId, trackId });

    await expect(service.addTrack(playlistId, ownerId, { trackId }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(repository.addTrack).not.toHaveBeenCalled();
  });

  it('rejects changes to a playlist when it does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.remove(playlistId, ownerId)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('reorders only tracks that are already in the owned playlist', async () => {
    repository.findById.mockResolvedValue(playlist);
    repository.findTrackEntry.mockResolvedValue({ playlistId, trackId });
    repository.updateTrackPosition.mockResolvedValue({});

    await service.reorderTrack(playlistId, trackId, ownerId, 0);

    expect(repository.updateTrackPosition).toHaveBeenCalledWith(playlistId, trackId, 0);
  });
});
