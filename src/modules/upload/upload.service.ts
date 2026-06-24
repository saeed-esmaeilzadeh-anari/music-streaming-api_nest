import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { plainToInstance } from 'class-transformer';
import { S3Service } from './s3.service';
import { UploadsRepository } from './repositories/uploads.repository';
import { TracksRepository } from '../tracks/repositories/tracks.repository';
import { RequestUploadDto, ConfirmUploadDto, UploadResponseDto } from './dto';
import { QUEUE_NAMES, TRACK_PROCESSING_JOBS } from '../../queue/queue.constants';

const ASSET_TYPE_PREFIX: Record<string, string> = {
  TRACK_AUDIO: 'tracks/audio',
  TRACK_COVER: 'tracks/covers',
  ALBUM_COVER: 'albums/covers',
  ARTIST_AVATAR: 'artists/avatars',
  ARTIST_BANNER: 'artists/banners',
  PLAYLIST_COVER: 'playlists/covers',
  USER_AVATAR: 'users/avatars',
};

const ASSET_TYPES_REQUIRING_TRACK = new Set(['TRACK_AUDIO', 'TRACK_COVER']);

@Injectable()
export class UploadService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly uploadsRepository: UploadsRepository,
    private readonly tracksRepository: TracksRepository,
    @InjectQueue(QUEUE_NAMES.TRACK_PROCESSING) private readonly trackQueue: Queue,
  ) {}

  async requestUpload(userId: string, dto: RequestUploadDto) {
    if (ASSET_TYPES_REQUIRING_TRACK.has(dto.assetType) && !dto.trackId) {
      throw new BadRequestException(
        `assetType "${dto.assetType}" requires a trackId.`,
      );
    }

    if (dto.trackId) {
      const track = await this.tracksRepository.findById(dto.trackId);
      if (!track) {
        throw new NotFoundException('Track not found.');
      }
    }

    const prefix = ASSET_TYPE_PREFIX[dto.assetType] ?? 'misc';
    const s3Key = this.s3Service.buildKey(prefix, dto.originalName);

    const upload = await this.uploadsRepository.create({
      assetType: dto.assetType,
      status: 'PENDING',
      s3Key,
      s3Bucket: this.s3Service.bucketName,
      mimeType: dto.mimeType,
      originalName: dto.originalName,
      user: { connect: { id: userId } },
      ...(dto.trackId ? { track: { connect: { id: dto.trackId } } } : {}),
    });

    const { uploadUrl, expiresIn } = await this.s3Service.createPresignedUploadUrl(
      s3Key,
      dto.mimeType,
    );

    return {
      uploadId: upload.id,
      uploadUrl,
      s3Key,
      expiresIn,
    };
  }

  /**
   * Called by the client once the direct-to-S3 PUT succeeds. Marks the
   * upload as UPLOADED and, for audio assets, enqueues a BullMQ job to
   * extract metadata asynchronously rather than blocking this request.
   */
  async confirmUpload(userId: string, dto: ConfirmUploadDto): Promise<UploadResponseDto> {
    const upload = await this.uploadsRepository.findById(dto.uploadId);
    if (!upload || upload.userId !== userId) {
      throw new NotFoundException('Upload not found.');
    }

    const updated = await this.uploadsRepository.update(upload.id, {
      status: upload.assetType === 'TRACK_AUDIO' ? 'PROCESSING' : 'READY',
      sizeBytes: dto.sizeBytes,
    });

    if (upload.assetType === 'TRACK_AUDIO' && upload.trackId) {
      await this.tracksRepository.update(upload.trackId, { status: 'PROCESSING' });
      await this.trackQueue.add(
        TRACK_PROCESSING_JOBS.EXTRACT_METADATA,
        {
          uploadId: upload.id,
          trackId: upload.trackId,
          s3Key: upload.s3Key,
          s3Bucket: upload.s3Bucket,
        },
        { jobId: upload.id },
      );
    } else if (upload.assetType === 'TRACK_COVER' && upload.trackId) {
      await this.tracksRepository.update(upload.trackId, {
        coverUrl: this.s3Service.getPublicUrl(upload.s3Key),
      });
    }

    return plainToInstance(UploadResponseDto, updated, {
      excludeExtraneousValues: true,
    });
  }

  async findById(userId: string, id: string): Promise<UploadResponseDto> {
    const upload = await this.uploadsRepository.findById(id);
    if (!upload || upload.userId !== userId) {
      throw new NotFoundException('Upload not found.');
    }
    return plainToInstance(UploadResponseDto, upload, {
      excludeExtraneousValues: true,
    });
  }
}
