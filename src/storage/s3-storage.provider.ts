import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { IStorageProvider } from './storage.interface';

/**
 * S3StorageProvider
 *
 * Production storage backend. Compatible with:
 *   - AWS S3
 *   - Cloudflare R2  (set AWS_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com)
 *   - MinIO          (set AWS_S3_ENDPOINT=http://localhost:9000)
 *   - DigitalOcean Spaces
 *   - Any S3-compatible endpoint
 *
 * Required env vars:
 *   AWS_REGION            e.g. "us-east-1"
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_S3_BUCKET         bucket name
 *   AWS_S3_ENDPOINT       optional — only for non-AWS S3-compatible endpoints
 *
 * Activated when: STORAGE_PROVIDER=s3
 */
@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const region   = this.config.getOrThrow<string>('AWS_REGION');
    const endpoint = this.config.get<string>('AWS_S3_ENDPOINT');

    this.bucket = this.config.getOrThrow<string>('AWS_S3_BUCKET');

    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId:     this.config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });

    this.logger.log(
      `S3StorageProvider ready — bucket: ${this.bucket}` +
      (endpoint ? `, endpoint: ${endpoint}` : ' (AWS)'),
    );
  }

  // ── IStorageProvider ──────────────────────────────────────────────────────

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket:      this.bucket,
        Key:         key,
        Body:        buffer,
        ContentType: mimeType,
      }),
    );
    this.logger.debug(`Uploaded s3://${this.bucket}/${key}`);
    return key;
  }

  /** Presigned GET URL for reading a stored file */
  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.logger.debug(`Deleted s3://${this.bucket}/${key}`);
    } catch (err: any) {
      if (err?.Code !== 'NoSuchKey') throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  // ── S3-specific ───────────────────────────────────────────────────────────

  /**
   * Presigned PUT URL — lets the frontend upload directly to S3.
   * Called by UploadService.buildUploadUrl() when STORAGE_PROVIDER=s3.
   */
  async presignPutUrl(key: string, expiresIn: number): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
