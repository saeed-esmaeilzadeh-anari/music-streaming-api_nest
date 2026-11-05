import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { Job } from 'bullmq';
import { TracksRepository } from '../../tracks/repositories/tracks.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { IStorageProvider } from '../../../storage/storage.interface';
import { TRACK_PROCESSING_JOBS } from '../../../queue/queue.constants';
import { TrackProcessingProcessor } from './track-processing.processor';

jest.mock('node:child_process', () => {
  const mockedExecFile = jest.fn();
  Object.defineProperty(mockedExecFile, Symbol.for('nodejs.util.promisify.custom'), {
    value: jest.fn(),
  });
  return { execFile: mockedExecFile };
});

describe('TrackProcessingProcessor', () => {
  const uploadId = 'upload-id';
  const trackId = 'track-id';
  const s3Key = 'tracks/audio/test.mp3';
  const execFileAsync = (
    execFile as unknown as { [key: symbol]: jest.Mock }
  )[Symbol.for('nodejs.util.promisify.custom')];

  let transaction: {
    upload: { update: jest.Mock };
    track: { update: jest.Mock };
  };
  let prisma: {
    upload: { update: jest.Mock };
    $transaction: jest.Mock;
  };
  let storage: jest.Mocked<IStorageProvider>;
  let config: jest.Mocked<Pick<ConfigService, 'get'>>;
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>;
  let processor: TrackProcessingProcessor;

  const makeJob = (attemptsMade = 0) => ({
    id: 'job-1',
    name: TRACK_PROCESSING_JOBS.EXTRACT_METADATA,
    data: { uploadId, trackId, s3Key },
    opts: { attempts: 3 },
    attemptsMade,
  }) as unknown as Job<{ uploadId: string; trackId: string; s3Key: string }>;

  beforeEach(() => {
    jest.clearAllMocks();

    transaction = {
      upload: { update: jest.fn().mockResolvedValue({}) },
      track: { update: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      upload: { update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };

    storage = {
      upload: jest.fn(),
      getSignedUrl: jest.fn().mockResolvedValue('http://127.0.0.1:3001/uploads/test.mp3'),
      delete: jest.fn(),
      exists: jest.fn(),
    };

    config = {
      get: jest.fn((key: string) => {
        if (key === 'APP_URL') return 'http://localhost:3001';
        if (key === 'app.apiPrefix') return 'api/v1';
        return undefined;
      }),
    };

    eventEmitter = { emit: jest.fn() };

    processor = new TrackProcessingProcessor(
      prisma as unknown as PrismaService,
      {} as TracksRepository,
      config as unknown as ConfigService,
      eventEmitter as unknown as EventEmitter2,
      storage,
    );
  });

  it('publishes a track only after ffprobe returns a positive duration', async () => {
    execFileAsync.mockResolvedValue({ stdout: '42.6', stderr: '' });

    await processor.process(makeJob());

    expect(storage.getSignedUrl).toHaveBeenCalledWith(s3Key, 300);
    expect(execFileAsync).toHaveBeenCalledWith(
      'ffprobe',
      expect.arrayContaining(['-show_entries', 'format=duration']),
      expect.objectContaining({ timeout: 60_000 }),
    );
    expect(transaction.upload.update).toHaveBeenCalledWith({
      where: { id: uploadId },
      data: { status: 'READY', failureReason: null },
    });
    expect(transaction.track.update).toHaveBeenCalledWith({
      where: { id: trackId },
      data: expect.objectContaining({
        durationSec: 43,
        status: 'PUBLISHED',
        audioUrl: expect.stringContaining('/api/v1/uploads/tracks/track-id/audio'),
      }),
    });
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });

  it('does not publish an audio file when ffprobe cannot read its duration', async () => {
    execFileAsync.mockResolvedValue({ stdout: 'not-a-duration', stderr: '' });

    await expect(processor.process(makeJob(0))).rejects.toThrow(
      'ffprobe could not determine a valid audio duration',
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transaction.track.update).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('marks the upload and track failed only after the final BullMQ attempt', async () => {
    execFileAsync.mockResolvedValue({ stdout: '', stderr: '' });

    await expect(processor.process(makeJob(2))).rejects.toThrow(
      'ffprobe could not determine a valid audio duration',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.upload.update).toHaveBeenLastCalledWith({
      where: { id: uploadId },
      data: {
        status: 'FAILED',
        failureReason: 'ffprobe could not determine a valid audio duration',
      },
    });
    expect(transaction.track.update).toHaveBeenCalledWith({
      where: { id: trackId },
      data: { status: 'REJECTED' },
    });
  });
});
