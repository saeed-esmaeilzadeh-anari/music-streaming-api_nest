import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

/**
 * Thin wrapper around the AWS S3 SDK. Generates presigned PUT URLs so the
 * client uploads directly to S3 (avoiding routing large audio files through
 * the API server), and exposes helpers to build public URLs and delete
 * objects when a track/asset is removed.
 */
@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;
  private readonly presignExpirySeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('aws.s3Bucket')!;
    this.publicBaseUrl = this.configService.get<string>('aws.publicBaseUrl');
    this.presignExpirySeconds = this.configService.get<number>('aws.presignedUrlExpirySeconds')!;

    this.client = new S3Client({
      region: this.configService.get<string>('aws.region'),
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId')!,
        secretAccessKey: this.configService.get<string>('aws.secretAccessKey')!,
      },
    });
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
