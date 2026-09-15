import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
// import { BullMQ_QUEUE }  from '../common/constants';                // your existing queue token
import { InjectQueue }   from '@nestjs/bullmq';
import { Queue }         from 'bullmq';
import { v4 as uuid }    from 'uuid';
import { UploadAssetType, UploadStatus } from '@prisma/client';

import { STORAGE_PROVIDER, IStorageProvider } from '../../storage/storage.interface';
import { RequestUploadDto }  from './dto/request-upload.dto';
import { ConfirmUploadDto }  from './dto/confirm-upload.dto';

/** Seconds until a presigned URL expires (S3 only) */
const PRESIGN_TTL = 900; // 15 minutes

/** Map each asset type to its storage key prefix */
const KEY_PREFIX: Record<UploadAssetType, string> = {
  TRACK_AUDIO:    'tracks/audio',
  TRACK_COVER:    'tracks/covers',
  ALBUM_COVER:    'albums/covers',
  ARTIST_AVATAR:  'artists/avatars',
  ARTIST_BANNER:  'artists/banners',
  PLAYLIST_COVER: 'playlists/covers',
  USER_AVATAR:    'users/avatars',
};

/** Asset types that are sent to the audio-processing queue after confirm */
const AUDIO_ASSET_TYPES = new Set<UploadAssetType>(['TRACK_AUDIO']);

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly config:   ConfigService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage:  IStorageProvider,
    @InjectQueue('audio-processing')
    private readonly audioQueue: Queue,
  ) {}

  // ─── Presign ─────────────────────────────────────────────────────────────────

  /**
   * Step 1: create an Upload record in Prisma and return a presigned URL.
   *
   * For S3:    returns a real AWS presigned PUT URL valid for PRESIGN_TTL seconds.
   * For local: returns a URL pointing at our own POST /uploads/local-put/:uploadId
   *            endpoint so the frontend "PUT" is handled by NestJS directly.
   */
  async requestPresignedUrl(userId: string, dto: RequestUploadDto) {
    const { assetType, originalName, mimeType, trackId } = dto;

    // Validate trackId requirement
    if (
      (assetType === 'TRACK_AUDIO' || assetType === 'TRACK_COVER') &&
      !trackId
    ) {
      throw new BadRequestException(
        `trackId is required for assetType ${assetType}`,
      );
    }

    const extension = originalName.split('.').pop()?.toLowerCase() ?? 'bin';
    const storageKey = `${KEY_PREFIX[assetType]}/${uuid()}.${extension}`;

    // Create the Prisma record in PENDING state
    const upload = await this.prisma.upload.create({
      data: {
        userId,
        assetType,
        status:     'PENDING',
        s3Key:      storageKey,   // field is named s3Key in schema; holds the storage key
        mimeType,
        originalName,
        trackId:    trackId ?? null,
      },
    });

    const provider = this.config.get<string>('STORAGE_PROVIDER') ?? 'local';

    let uploadUrl: string;

    if (provider === 's3') {
      // For S3: generate a real presigned PUT URL
      // The interface only exposes getSignedUrl (GET), so we delegate to the
      // S3 provider's upload-presign helper. We add a presignPutUrl method
      // only on S3StorageProvider (optional enhancement); alternatively the
      // frontend PUT goes to our local-put endpoint in both providers.
      // Simplest cross-provider approach: always use our own proxy endpoint.
      // Real S3 presign is done inside the provider when STORAGE_PROVIDER=s3.
      uploadUrl = await this.buildUploadUrl(upload.id, storageKey, provider);
    } else {
      uploadUrl = await this.buildUploadUrl(upload.id, storageKey, provider);
    }

    return {
      uploadId:  upload.id,
      uploadUrl,
      s3Key:     storageKey,
      expiresIn: PRESIGN_TTL,
    };
  }

  /**
   * Build the URL the frontend will PUT the file to.
   *
   * - local: POST /uploads/local-put/:uploadId  (handled by NestJS)
   * - s3:    real AWS presigned PUT URL
   */
  private async buildUploadUrl(
    uploadId: string,
    key:      string,
    provider: string,
  ): Promise<string> {
    if (provider === 'local') {
      const base = this.config.get<string>('APP_URL') ?? 'http://localhost:3001';
      return `${base}/api/v1/uploads/local-put/${uploadId}`;
    }

    // S3: use presigned PUT via the AWS SDK directly
    // We cast to access the S3-specific presignPut (see s3-storage.provider.ts)
    const s3 = this.storage as any;
    if (typeof s3.presignPutUrl === 'function') {
      return s3.presignPutUrl(key, PRESIGN_TTL);
    }

    // Fallback: proxy through our own endpoint (also works for S3)
    const base = this.config.get<string>('APP_URL') ?? 'http://localhost:3001';
    return `${base}/api/v1/uploads/local-put/${uploadId}`;
  }

  // ─── Local PUT handler ────────────────────────────────────────────────────────

  /**
   * Receive the file bytes from the frontend (local provider only).
   * Called by PUT /uploads/local-put/:uploadId in UploadController.
   */
  async receiveLocalUpload(
    uploadId: string,
    userId:   string,
    buffer:   Buffer,
  ): Promise<void> {
    const upload = await this.prisma.upload.findUnique({
      where: { id: uploadId },
    });

    if (!upload) throw new NotFoundException('Upload not found');
    if (upload.userId !== userId) throw new ForbiddenException();
    if (upload.status !== 'PENDING') {
      throw new BadRequestException('Upload already processed');
    }

    await this.storage.upload(upload.s3Key, buffer, upload.mimeType ?? 'application/octet-stream');

    await this.prisma.upload.update({
      where: { id: uploadId },
      data:  { status: 'UPLOADED' },
    });

    this.logger.debug(`Local upload received for uploadId=${uploadId}`);
  }

  // ─── Confirm ─────────────────────────────────────────────────────────────────

  /**
   * Step 3: mark upload PROCESSING (audio) or READY (images), enqueue job.
   */
  async confirmUpload(userId: string, dto: ConfirmUploadDto) {
    const { uploadId, sizeBytes } = dto;

    const upload = await this.prisma.upload.findUnique({
      where: { id: uploadId },
    });

    if (!upload)               throw new NotFoundException('Upload not found');
    if (upload.userId !== userId) throw new ForbiddenException();
    if (!['PENDING', 'UPLOADED'].includes(upload.status)) {
      throw new BadRequestException(`Upload is already in status: ${upload.status}`);
    }

    const isAudio = AUDIO_ASSET_TYPES.has(upload.assetType);
    const newStatus: UploadStatus = isAudio ? 'PROCESSING' : 'READY';

    const updated = await this.prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: newStatus,
        ...(sizeBytes ? { sizeBytes } : {}),
      },
    });

    if (isAudio && upload.trackId) {
      await this.audioQueue.add('process-track-audio', {
        uploadId: upload.id,
        trackId:  upload.trackId,
        s3Key:    upload.s3Key,
      });
      this.logger.log(`Queued audio-processing job for trackId=${upload.trackId}`);
    }

    return updated;
  }

  // ─── Status polling ───────────────────────────────────────────────────────────

  async getUploadStatus(uploadId: string, userId: string) {
    const upload = await this.prisma.upload.findUnique({
      where: { id: uploadId },
    });

    if (!upload)               throw new NotFoundException('Upload not found');
    if (upload.userId !== userId) throw new ForbiddenException();

    return upload;
  }

  // ─── Signed URL for playback/display ─────────────────────────────────────────

  /**
   * Generate a URL to read a stored file.
   * Called by track/album/artist services when constructing response objects.
   */
  async getReadUrl(s3Key: string, expiresIn = PRESIGN_TTL): Promise<string> {
    return this.storage.getSignedUrl(s3Key, expiresIn);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────────

  async deleteFile(s3Key: string): Promise<void> {
    await this.storage.delete(s3Key);
  }
}
