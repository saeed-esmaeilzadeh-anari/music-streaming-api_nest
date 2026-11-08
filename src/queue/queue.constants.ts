/**
 * Centralized BullMQ queue names. Keeping these in one place avoids typos
 * across modules that produce/consume the same queue.
 */
export const QUEUE_NAMES = {
  TRACK_PROCESSING: 'track-processing',
  EMAIL: 'email',
  NOTIFICATIONS: 'notifications',
  PAYMENTS: 'payments',
  ARTIST_STATS: 'artist-stats',
} as const;

export const TRACK_PROCESSING_JOBS = {
  EXTRACT_METADATA: 'extract-metadata',
  GENERATE_WAVEFORM: 'generate-waveform',
} as const;

export const EMAIL_JOBS = {
  SEND_WELCOME: 'send-welcome',
  SEND_PASSWORD_RESET: 'send-password-reset',
} as const;

export const NOTIFICATION_JOBS = {
  DISPATCH: 'dispatch-notification',
} as const;

export const PAYMENT_JOBS = {
  RECONCILE_SUBSCRIPTION: 'reconcile-subscription',
} as const;

export const ARTIST_STATS_JOBS = {
  /** Recomputes artists.monthlyListeners from the last 30 days of plays. */
  RECOMPUTE_MONTHLY_LISTENERS: 'recompute-monthly-listeners',
} as const;

/** Hourly cadence for the monthly-listeners recompute (ms). */
export const ARTIST_STATS_RECOMPUTE_INTERVAL_MS = 60 * 60 * 1000;
