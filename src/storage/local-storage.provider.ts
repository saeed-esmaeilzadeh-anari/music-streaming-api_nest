import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs   from 'fs/promises';
import * as path from 'path';

import type { IStorageProvider } from './storage.interface';

/**
 * LocalStorageProvider
 *
 * Development storage backend. Files are saved to a local directory
 * (default: <project-root>/uploads/) and served by NestJS's built-in
 * static-file middleware via ServeStaticModule.
 *
 * The "presigned URL" the frontend receives is a plain local URL:
 *   http://localhost:3001/uploads/<key>
 * The frontend PUT goes to our own /uploads/local-put/:key endpoint
 * (see upload.controller.ts) instead of S3.
 *
 * Nothing is encrypted or time-limited — this is only for local dev.
 *
 * Optional env vars:
 *   LOCAL_STORAGE_DIR   — absolute path to the uploads folder
 *                         (default: process.cwd() + "/uploads")
 *   LOCAL_STORAGE_URL   — public base URL for serving files
 *                         (default: "http://localhost:3001/uploads")
 *
 * Activated when: STORAGE_PROVIDER=local
 */
@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly logger  = new Logger(LocalStorageProvider.name);
  private readonly baseDir: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseDir = this.config.get<string>('LOCAL_STORAGE_DIR')
      ?? path.join(process.cwd(), 'uploads');

    this.baseUrl = this.config.get<string>('LOCAL_STORAGE_URL')
      ?? 'http://localhost:3001/uploads';

    this.logger.log(
      `LocalStorageProvider initialised — dir: ${this.baseDir}, url: ${this.baseUrl}`,
    );
  }

  /** Resolve a storage key to an absolute filesystem path */
  private resolve(key: string): string {
    // Guard against path traversal
    const normalised = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    return path.join(this.baseDir, normalised);
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const dest = this.resolve(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
    this.logger.debug(`Saved file locally: ${dest}`);
    return key;
  }

  /**
   * For local storage the "signed URL" is just a static-serve URL.
   * expiresIn is intentionally ignored — it only makes sense for S3.
   */
  async getSignedUrl(key: string, _expiresIn: number): Promise<string> {
    const normalised = key.split(path.sep).join('/');   // ensure forward slashes
    return `${this.baseUrl}/${normalised}`;
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
      this.logger.debug(`Deleted local file: ${key}`);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}