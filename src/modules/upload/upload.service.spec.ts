import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { IStorageProvider } from '../../storage/storage.interface';
import { UploadService } from './upload.service';
import { TRACK_PROCESSING_JOBS } from '../../queue/queue.constants';

describe('UploadService', () => {
  const ownerId = 'owner-user-id';
  const otherUserId = 'other-user-id';
  const trackId = 'track-id';
  const uploadId = 'upload-id';

  let prisma: {
    upload: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
    };
    track: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let config: { get: jest.Mock };
  let storage: jest.Mocked<IStorageProvider>;
  let queue: jest.Mocked<Pick<Queue, 'add'>>;
  let service: UploadService;

  const audioUpload = {
    id: uploadId,
    userId: ownerId,
    assetType: 'TRACK_AUDIO',
    status: 'UPLOADED',
    s3Key: 'tracks/audio/test.mp3',
    mimeType: 'audio/mpeg',
    originalName: 'test.mp3',
    trackId,
  };

  beforeEach(() => {
    prisma = {
      upload: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      track: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    config = {
      get: jest.fn((key: string) => {
        if (key === 'STORAGE_PROVIDER') return 'local';
        if (key === 'APP_URL') return 'http://localhost:3001';
        return undefined;
      }),
    };

    storage = {
      upload: jest.fn().mockResolvedValue('tracks/audio/test.mp3'),
      getSignedUrl: jest.fn().mockResolvedValue('http://storage.test/audio.mp3'),
      delete: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
    };

    queue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' } as never),
    };

    service = new UploadService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      storage,
      queue as unknown as Queue,
    );
  });

  it('requires a track id for audio uploads', async () => {
    await expect(
      service.requestPresignedUrl(ownerId, {
        assetType: 'TRACK_AUDIO',
        originalName: 'song.mp3',
        mimeType: 'audio/mpeg',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.upload.create).not.toHaveBeenCalled();
  });

  it('does not create an upload for a track owned by another user', async () => {
    prisma.track.findUnique.mockResolvedValue({
      id: trackId,
      artist: { userId: ownerId },
    });

    await expect(
      service.requestPresignedUrl(otherUserId, {
        assetType: 'TRACK_AUDIO',
        originalName: 'song.mp3',
        mimeType: 'audio/mpeg',
        trackId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.upload.create).not.toHaveBeenCalled();
  });

  it('rejects a non-audio MIME type for track audio', async () => {
    prisma.track.findUnique.mockResolvedValue({
      id: trackId,
      artist: { userId: ownerId },
    });

    await expect(
      service.requestPresignedUrl(ownerId, {
        assetType: 'TRACK_AUDIO',
        originalName: 'song.jpg',
        mimeType: 'image/jpeg',
        trackId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.upload.create).not.toHaveBeenCalled();
  });

  it('creates a local upload URL without requiring AWS configuration', async () => {
    prisma.upload.create.mockResolvedValue({ id: uploadId });

    const result = await service.requestPresignedUrl(ownerId, {
      assetType: 'USER_AVATAR',
      originalName: 'avatar.png',
      mimeType: 'image/png',
    });

    expect(result.uploadUrl).toBe(`http://localhost:3001/api/v1/uploads/local-put/${uploadId}`);
    expect(prisma.upload.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: ownerId,
        assetType: 'USER_AVATAR',
        status: 'PENDING',
      }),
    });
  });

  it('fails explicitly when S3 presigning is not supported by the selected provider', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'STORAGE_PROVIDER') return 's3';
      return undefined;
    });
    prisma.upload.create.mockResolvedValue({ id: uploadId });

    await expect(
      service.requestPresignedUrl(ownerId, {
        assetType: 'USER_AVATAR',
        originalName: 'avatar.png',
        mimeType: 'image/png',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('rejects empty local upload bodies before touching storage', async () => {
    await expect(service.receiveLocalUpload(uploadId, Buffer.alloc(0))).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.upload.findUnique).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('stores a non-empty local upload and marks it UPLOADED', async () => {
    prisma.upload.findUnique.mockResolvedValue({ ...audioUpload, status: 'PENDING' });
    prisma.upload.update.mockResolvedValue({ ...audioUpload, status: 'UPLOADED' });
    const bytes = Buffer.from('audio bytes');

    await service.receiveLocalUpload(uploadId, bytes);

    expect(storage.upload).toHaveBeenCalledWith(audioUpload.s3Key, bytes, audioUpload.mimeType);
    expect(prisma.upload.update).toHaveBeenCalledWith({
      where: { id: uploadId },
      data: { status: 'UPLOADED' },
    });
  });

  it('does not confirm an upload owned by another user', async () => {
    prisma.upload.findUnique.mockResolvedValue({ ...audioUpload, userId: ownerId });

    await expect(service.confirmUpload(otherUserId, { uploadId })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(storage.exists).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects confirmation if the object does not exist in storage', async () => {
    prisma.upload.findUnique.mockResolvedValue(audioUpload);
    storage.exists.mockResolvedValue(false);

    await expect(service.confirmUpload(ownerId, { uploadId })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.upload.update).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('queues audio processing only after verifying the stored object', async () => {
    prisma.upload.findUnique.mockResolvedValue(audioUpload);
    prisma.upload.update.mockResolvedValue({ ...audioUpload, status: 'PROCESSING' });

    await service.confirmUpload(ownerId, { uploadId, sizeBytes: 2048 });

    expect(storage.exists).toHaveBeenCalledWith(audioUpload.s3Key);
    expect(prisma.upload.update).toHaveBeenCalledWith({
      where: { id: uploadId },
      data: { status: 'PROCESSING', sizeBytes: 2048 },
    });
    expect(queue.add).toHaveBeenCalledWith(TRACK_PROCESSING_JOBS.EXTRACT_METADATA, {
      uploadId,
      trackId,
      s3Key: audioUpload.s3Key,
    });
  });

  it('does not confirm an already processed upload twice', async () => {
    prisma.upload.findUnique.mockResolvedValue({ ...audioUpload, status: 'READY' });

    await expect(service.confirmUpload(ownerId, { uploadId })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(storage.exists).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
