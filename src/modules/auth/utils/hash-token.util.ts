import { createHash } from 'crypto';

/**
 * Refresh tokens are stored hashed (SHA-256) in the database - never in
 * plaintext - so a database leak doesn't directly hand out usable tokens.
 * This is a one-way lookup hash, distinct from bcrypt (which is for
 * passwords and intentionally slow); we want fast equality lookups here.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
