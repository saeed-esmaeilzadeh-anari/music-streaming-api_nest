import { Injectable, Inject, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { UploadAssetType, UploadStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER, IStorageProvider } from '../storage/storage.interface';
import { RequestUploadDto } from './dto/request-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { QUEUE_NAMES, TRACK_PROCESSING_JOBS } from '@/queue/queue.constants';

const PRESIGN_TTL = 900; // 15 minutes

const KEY_PREFIX: Record<UploadAssetType, string> = {
  TRACK_AUDIO: 'tracks/audio',
  TRACK_COVER: 'tracks/covers',
  ALBUM_COVER: 'albums/covers',
  ARTIST_AVATAR: 'artists/avatars',
  ARTIST_BANNER: 'artists/banners',
  PLAYLIST_COVER: 'playlists/covers',
  USER_AVATAR: 'users/avatars',
};

const AUDIO_ASSET_TYPES = new Set<UploadAssetType>(['TRACK_AUDIO']);

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: IStorageProvider,
    // @InjectQueue('audio-processing')
    @InjectQueue(QUEUE_NAMES.TRACK_PROCESSING)
    private readonly audioQueue: Queue,
  ) {}

  // ─── Step 1: presign ─────────────────────────────────────────────────────────

  async requestPresignedUrl(userId: string, dto: RequestUploadDto) {
    const { assetType, originalName, mimeType, trackId } = dto;

    if ((assetType === 'TRACK_AUDIO' || assetType === 'TRACK_COVER') && !trackId) {
      throw new BadRequestException(`trackId is required when assetType is ${assetType}`);
    }

    const ext = originalName.split('.').pop()?.toLowerCase() ?? 'bin';
    const storageKey = `${KEY_PREFIX[assetType]}/${uuid()}.${ext}`;

    const upload = await this.prisma.upload.create({
      data: {
        userId,
        assetType,
        status: 'PENDING',
        s3Key: storageKey,
        mimeType,
        originalName,
        trackId: trackId ?? null,
      },
    });

    const uploadUrl = await this.buildUploadUrl(upload.id, storageKey);

    return {
      uploadId: upload.id,
      uploadUrl,
      s3Key: storageKey,
      expiresIn: PRESIGN_TTL,
    };
  }

  private async buildUploadUrl(uploadId: string, key: string): Promise<string> {
    const provider = this.config.get<string>('STORAGE_PROVIDER') ?? 'local';

    if (provider === 's3') {
      const s3 = this.storage as any;
      if (typeof s3.presignPutUrl === 'function') {
        return s3.presignPutUrl(key, PRESIGN_TTL) as Promise<string>;
      }
    }

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3001';
    return `${appUrl}/api/v1/uploads/local-put/${uploadId}`;
  }

  // ─── Step 2: receive local file ──────────────────────────────────────────────

  /**
   * No userId param — this endpoint is @Public().
   * The uploadId UUID is the credential (unguessable, single-use).
   * Status check ensures the uploadId can only be used once.
   */
  async receiveLocalUpload(uploadId: string, buffer: Buffer): Promise<void> {
    const upload = await this.prisma.upload.findUnique({ where: { id: uploadId } });

    if (!upload) {
      throw new NotFoundException('Upload not found');
    }
    if (upload.status !== 'PENDING') {
      throw new BadRequestException(
        `Upload already used (status: ${upload.status}). Request a new presigned URL.`,
      );
    }

    await this.storage.upload(upload.s3Key, buffer, upload.mimeType ?? 'application/octet-stream');

    await this.prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'UPLOADED' },
    });

    this.logger.debug(
      `Local upload received — id=${uploadId} key=${upload.s3Key} bytes=${buffer.length}`,
    );
  }

  // ─── Step 3: confirm ─────────────────────────────────────────────────────────

  async confirmUpload(userId: string, dto: ConfirmUploadDto) {
    const { uploadId, sizeBytes } = dto;

    const upload = await this.prisma.upload.findUnique({ where: { id: uploadId } });

    if (!upload) throw new NotFoundException('Upload not found');

    // Re-assert ownership at confirm time (upload.userId was set at presign)
    if (upload.userId !== userId) {
      throw new NotFoundException('Upload not found'); // don't leak existence to wrong user
    }

    const acceptedStatuses: UploadStatus[] = ['PENDING', 'UPLOADED'];
    if (!acceptedStatuses.includes(upload.status)) {
      throw new BadRequestException(`Upload is already in status: ${upload.status}`);
    }

    const isAudio = AUDIO_ASSET_TYPES.has(upload.assetType);
    const newStatus: UploadStatus = isAudio ? 'PROCESSING' : 'READY';

    const updated = await this.prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: newStatus,
        ...(sizeBytes != null ? { sizeBytes } : {}),
      },
    });

    // if (isAudio && upload.trackId) {
    //   await this.audioQueue.add('process-track-audio', {
    //     uploadId: upload.id,
    //     trackId: upload.trackId,
    //     s3Key: upload.s3Key,
    //   });
    //   this.logger.log(`Queued audio-processing — trackId=${upload.trackId}`);
    // }

    if (isAudio && upload.trackId) {
      await this.audioQueue.add(TRACK_PROCESSING_JOBS.EXTRACT_METADATA, {
        uploadId: upload.id,
        trackId: upload.trackId,
        s3Key: upload.s3Key,
      });
      this.logger.log(`Queued audio-processing — trackId=${upload.trackId}`);
    }

    return updated;
  }

  // ─── Polling ──────────────────────────────────────────────────────────────────

  async getUploadStatus(uploadId: string, userId: string) {
    const upload = await this.prisma.upload.findUnique({ where: { id: uploadId } });
    if (!upload || upload.userId !== userId) {
      throw new NotFoundException('Upload not found');
    }
    return upload;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  async getReadUrl(s3Key: string, expiresIn = PRESIGN_TTL): Promise<string> {
    return this.storage.getSignedUrl(s3Key, expiresIn);
  }

  async deleteFile(s3Key: string): Promise<void> {
    await this.storage.delete(s3Key);
  }
}
