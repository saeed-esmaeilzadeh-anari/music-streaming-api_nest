/**
 * Strongly typed event payload classes. Listeners can type their handler
 * parameter against these instead of `any`, and emitters get autocomplete.
 */

export class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly username: string,
  ) {}
}

export class TrackUploadedEvent {
  constructor(
    public readonly trackId: string,
    public readonly uploadId: string,
    public readonly s3Key: string,
  ) {}
}

export class TrackProcessingCompletedEvent {
  constructor(
    public readonly trackId: string,
    public readonly durationSec: number,
    public readonly audioUrl: string,
  ) {}
}

export class TrackPlayedEvent {
  constructor(
    public readonly userId: string,
    public readonly trackId: string,
    public readonly progressSec: number,
  ) {}
}

export class CommentCreatedEvent {
  constructor(
    public readonly commentId: string,
    public readonly authorId: string,
    public readonly targetType: string,
    public readonly targetOwnerId: string | null,
  ) {}
}

export class LikeCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly targetType: string,
    public readonly targetId: string,
    public readonly targetOwnerId: string | null,
  ) {}
}

export class PlaylistTrackAddedEvent {
  constructor(
    public readonly playlistId: string,
    public readonly trackId: string,
    public readonly addedByUserId: string,
  ) {}
}

export class SubscriptionRenewedEvent {
  constructor(
    public readonly userId: string,
    public readonly subscriptionId: string,
    public readonly currentPeriodEnd: Date,
  ) {}
}

export class PaymentFailedEvent {
  constructor(
    public readonly userId: string,
    public readonly paymentId: string,
    public readonly reason: string,
  ) {}
}
