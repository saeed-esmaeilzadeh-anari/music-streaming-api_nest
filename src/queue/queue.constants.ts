/**
 * Centralized BullMQ queue names. Keeping these in one place avoids typos
 * across modules that produce/consume the same queue.
 */
export const QUEUE_NAMES = {
  TRACK_PROCESSING: 'track-processing',
  EMAIL: 'email',
  NOTIFICATIONS: 'notifications',
  PAYMENTS: 'payments',
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
