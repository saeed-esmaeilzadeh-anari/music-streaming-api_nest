import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Thin wrapper exposing a configured Stripe SDK instance. Kept as its own
 * injectable (rather than `new Stripe(...)` inline in each service) so it
 * can be mocked in unit tests and so the API version is pinned in one place.
 */
@Injectable()
export class StripeClient {
  readonly client: Stripe;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('stripe.secretKey');
    this.client = new Stripe(secretKey ?? '', {
      apiVersion: '2024-06-20',
    });
  }
}
