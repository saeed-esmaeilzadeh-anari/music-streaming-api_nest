/**
 * Domain event names used with @nestjs/event-emitter.
 * Using a const object (not free strings) prevents typos when emitting/listening.
 */
export const DOMAIN_EVENTS = {
  // Users
  USER_REGISTERED: 'user.registered',
  USER_EMAIL_VERIFIED: 'user.email_verified',

  // Social graph
  USER_FOLLOWED: 'user.followed',

  // Tracks
  TRACK_UPLOADED: 'track.uploaded',
  TRACK_PROCESSING_COMPLETED: 'track.processing_completed',
  TRACK_PROCESSING_FAILED: 'track.processing_failed',
  TRACK_PUBLISHED: 'track.published',
  TRACK_PLAYED: 'track.played',

  // Social interactions
  COMMENT_CREATED: 'comment.created',
  LIKE_CREATED: 'like.created',

  // Playlists
  PLAYLIST_TRACK_ADDED: 'playlist.track_added',

  // Subscriptions & payments
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_CANCELED: 'subscription.canceled',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
} as const;

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];
