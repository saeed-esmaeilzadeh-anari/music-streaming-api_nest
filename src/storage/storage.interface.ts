/**
 * IStorageProvider
 *
 * The single interface that every storage backend must implement.
 * UploadService depends on this token, never on a concrete class.
 *
 * Implementations:
 *   S3StorageProvider    — production (AWS S3 / any S3-compatible endpoint)
 *   LocalStorageProvider — development (local disk + NestJS static serve)
 */
export interface IStorageProvider {
  /**
   * Store a file and return its canonical storage key.
   * For S3 this is the S3 object key.
   * For local this is the relative path under the uploads directory.
   *
   * @param key      — desired storage key / relative path (e.g. "tracks/audio/uuid.mp3")
   * @param buffer   — raw file bytes
   * @param mimeType — MIME type (used for S3 ContentType header)
   */
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>;

  /**
   * Return a URL the client can use to GET the stored file.
   *
   * For S3:    a time-limited presigned GET URL.
   * For local: a plain http://host/uploads/<key> URL — never expires.
   *
   * @param key       — storage key returned by upload()
   * @param expiresIn — desired TTL in seconds (S3 honours it; local ignores it)
   */
  getSignedUrl(key: string, expiresIn: number): Promise<string>;

  /**
   * Delete a stored file.
   * Resolves silently if the key does not exist (idempotent).
   */
  delete(key: string): Promise<void>;

  /**
   * Return true if a file with the given key exists in storage.
   */
  exists(key: string): Promise<boolean>;
}

/** NestJS injection token */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');