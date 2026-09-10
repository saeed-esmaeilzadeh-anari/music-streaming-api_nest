import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService }  from '@nestjs/config';
import { InjectQueue }    from '@nestjs/bullmq';
import { Queue }          from 'bullmq';
import { v4 as uuid }     from 'uuid';
import { UploadAssetType, UploadStatus } from '@prisma/client';

import { PrismaService }  from '../../prisma/prisma.service';
import { STORAGE_PROVIDER, IStorageProvider } from '../../storage/storage.interface';
import { RequestUploadDto }  from './dto/request-upload.dto';
import { ConfirmUploadDto }  from './dto/confirm-upload.dto';

/** Presigned URL TTL in seconds (S3 only — local URLs never expire) */
const PRESIGN_TTL = 900; // 15 minutes

/** Storage key prefix per asset type */
const KEY_PREFIX: Record<UploadAssetType, string> = {
  TRACK_AUDIO:    'tracks/audio',
  TRACK_COVER:    'tracks/covers',
  ALBUM_COVER:    'albums/covers',
  ARTIST_AVATAR:  'artists/avatars',
  ARTIST_BANNER:  'artists/banners',
  PLAYLIST_COVER: 'playlists/covers',
  USER_AVATAR:    'users/avatars',
};

/** Asset types that trigger the audio-processing BullMQ job after confirm */
const AUDIO_ASSET_TYPES = new Set<UploadAssetType>(['TRACK_AUDIO']);

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: IStorageProvider,
    @InjectQueue('audio-processing')
    private readonly audioQueue: Queue,
  ) {}

  // ─── Step 1: presign ─────────────────────────────────────────────────────────

  /**
   * Create an Upload row in PENDING state and return a URL the frontend
   * can PUT the file to.
   *
   * STORAGE_PROVIDER=s3    → real AWS presigned PUT URL (expires in PRESIGN_TTL)
   * STORAGE_PROVIDER=local → PUT /uploads/local-put/:uploadId on this NestJS server
   *
   * The frontend upload code is identical for both cases: raw PUT with the
   * file as the body and Content-Type matching the MIME type.
   */
  async requestPresignedUrl(userId: string, dto: RequestUploadDto) {
    const { assetType, originalName, mimeType, trackId } = dto;

    if (
      (assetType === 'TRACK_AUDIO' || assetType === 'TRACK_COVER') &&
      !trackId
    ) {
      throw new BadRequestException(
        `trackId is required when assetType is ${assetType}`,
      );
    }

    const ext        = originalName.split('.').pop()?.toLowerCase() ?? 'bin';
    const storageKey = `${KEY_PREFIX[assetType]}/${uuid()}.${ext}`;

    const upload = await this.prisma.upload.create({
      data: {
        userId,
        assetType,
        status:      'PENDING',
        s3Key:       storageKey,
        mimeType,
        originalName,
        trackId:     trackId ?? null,
      },
    });

    const uploadUrl = await this.buildUploadUrl(upload.id, storageKey);

    return {
      uploadId:  upload.id,
      uploadUrl,
      s3Key:     storageKey,
      expiresIn: PRESIGN_TTL,
    };
  }

  /**
   * Build the URL the frontend will PUT the raw file to.
   *
   * - local → our own /uploads/local-put/:uploadId endpoint
   * - s3    → real AWS presigned PUT URL via S3StorageProvider.presignPutUrl()
   */
  private async buildUploadUrl(uploadId: string, key: string): Promise<string> {
    const provider = this.config.get<string>('STORAGE_PROVIDER') ?? 'local';

    if (provider === 's3') {
      // presignPutUrl() exists only on S3StorageProvider (not on the interface).
      // We access it via a runtime check so the interface stays minimal.
      const s3 = this.storage as any;
      if (typeof s3.presignPutUrl === 'function') {
        return s3.presignPutUrl(key, PRESIGN_TTL) as Promise<string>;
      }
      // Fallback: proxy through our own endpoint if the method is somehow absent
    }

    // local (or fallback): proxy through NestJS
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3001';
    return `${appUrl}/api/v1/uploads/local-put/${uploadId}`;
  }

  // ─── Local PUT handler ────────────────────────────────────────────────────────

  /**
   * Receive raw bytes from the frontend (local provider only).
   * Called by PUT /uploads/local-put/:uploadId in UploadController.
   *
   * For S3 this endpoint is never called — the frontend PUT goes directly to AWS.
   */
  async receiveLocalUpload(
    uploadId: string,
    userId:   string,
    buffer:   Buffer,
  ): Promise<void> {
    const upload = await this.prisma.upload.findUnique({ where: { id: uploadId } });

    if (!upload)                  throw new NotFoundException('Upload not found');
    if (upload.userId !== userId) throw new ForbiddenException();
    if (upload.status !== 'PENDING') {
      throw new BadRequestException(`Upload is already in status: ${upload.status}`);
    }

    await this.storage.upload(
      upload.s3Key,
      buffer,
      upload.mimeType ?? 'application/octet-stream',
    );

    await this.prisma.upload.update({
      where: { id: uploadId },
      data:  { status: 'UPLOADED' },
    });

    this.logger.debug(`Local upload received — uploadId=${uploadId}, bytes=${buffer.length}`);
  }

  // ─── Step 3: confirm ─────────────────────────────────────────────────────────

  /**
   * Mark the upload PROCESSING (audio) or READY (images/covers) and
   * enqueue the BullMQ audio-processing job when applicable.
   *
   * Accepts both PENDING (S3 path — S3 never calls local-put so the record
   * stays PENDING until confirm) and UPLOADED (local path — local-put already
   * set it to UPLOADED).
   */
  async confirmUpload(userId: string, dto: ConfirmUploadDto) {
    const { uploadId, sizeBytes } = dto;

    const upload = await this.prisma.upload.findUnique({ where: { id: uploadId } });

    if (!upload)                  throw new NotFoundException('Upload not found');
    if (upload.userId !== userId) throw new ForbiddenException();

    const acceptedStatuses: UploadStatus[] = ['PENDING', 'UPLOADED'];
    if (!acceptedStatuses.includes(upload.status)) {
      throw new BadRequestException(`Upload is already in status: ${upload.status}`);
    }

    const isAudio   = AUDIO_ASSET_TYPES.has(upload.assetType);
    const newStatus: UploadStatus = isAudio ? 'PROCESSING' : 'READY';

    const updated = await this.prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: newStatus,
        ...(sizeBytes != null ? { sizeBytes } : {}),
      },
    });

    if (isAudio && upload.trackId) {
      await this.audioQueue.add('process-track-audio', {
        uploadId: upload.id,
        trackId:  upload.trackId,
        s3Key:    upload.s3Key,
      });
      this.logger.log(`Queued audio-processing — trackId=${upload.trackId}`);
    }

    return updated;
  }

  // ─── Polling ──────────────────────────────────────────────────────────────────

  async getUploadStatus(uploadId: string, userId: string) {
    const upload = await this.prisma.upload.findUnique({ where: { id: uploadId } });
    if (!upload)                  throw new NotFoundException('Upload not found');
    if (upload.userId !== userId) throw new ForbiddenException();
    return upload;
  }

  // ─── Helpers used by other services ──────────────────────────────────────────

  /**
   * Generate a readable URL for a stored file.
   * Called by TrackService, AlbumService, ArtistService when building responses.
   *
   * Returns a time-limited presigned GET URL for S3, or a plain static URL
   * for local.
   */
  async getReadUrl(s3Key: string, expiresIn = PRESIGN_TTL): Promise<string> {
    return this.storage.getSignedUrl(s3Key, expiresIn);
  }

  /** Delete a stored file — called when a track/album/artist is deleted */
  async deleteFile(s3Key: string): Promise<void> {
    await this.storage.delete(s3Key);
  }
}
