import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

/**
 * Thin wrapper around the AWS S3 SDK.
 *
 * Works with:
 *   - AWS S3              (no AWS_S3_ENDPOINT set)
 *   - MinIO               (AWS_S3_ENDPOINT=http://localhost:9000)
 *   - Cloudflare R2       (AWS_S3_ENDPOINT=https://<id>.r2.cloudflarestorage.com)
 *   - Any S3-compatible   (set AWS_S3_ENDPOINT accordingly)
 */
@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;
  private readonly presignExpirySeconds: number;
  private readonly endpoint?: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('aws.s3Bucket')!;
    this.publicBaseUrl = this.configService.get<string>('aws.publicBaseUrl');
    this.presignExpirySeconds = this.configService.get<number>('aws.presignedUrlExpirySeconds')!;
    this.endpoint = this.configService.get<string>('aws.s3Endpoint');

    this.client = new S3Client({
      region: this.configService.get<string>('aws.region'),
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId')!,
        secretAccessKey: this.configService.get<string>('aws.secretAccessKey')!,
      },
      // When endpoint is set (MinIO / R2 / etc), enable path-style addressing.
      // Path-style: http://localhost:9000/bucket/key
      // Virtual-hosted (AWS default): https://bucket.s3.amazonaws.com/key
      ...(this.endpoint ? { endpoint: this.endpoint, forcePathStyle: true } : {}),
    });

    if (this.endpoint) {
      this.logger.log(`S3Service using custom endpoint: ${this.endpoint}`);
    }
  }

  buildKey(prefix: string, originalName: string): string {
    const extension = originalName.includes('.')
      ? originalName.substring(originalName.lastIndexOf('.'))
      : '';
    return `${prefix}/${randomUUID()}${extension}`;
  }

  async createPresignedUploadUrl(
    key: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; expiresIn: number }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.presignExpirySeconds,
    });

    return { uploadUrl, expiresIn: this.presignExpirySeconds };
  }

  getPublicUrl(key: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      this.logger.error(`Failed to delete S3 object "${key}": ${error}`);
    }
  }

  get bucketName(): string {
    return this.bucket;
  }
}
