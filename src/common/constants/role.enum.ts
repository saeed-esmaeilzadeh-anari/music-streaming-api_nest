/**
 * Mirrors the Prisma `Role` enum. Kept as a standalone TS enum (rather than
 * importing the Prisma-generated enum everywhere) so common/ decorators and
 * guards don't take a hard dependency on @prisma/client.
 */
export enum Role {
  LISTENER = 'LISTENER',
  ARTIST = 'ARTIST',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}
