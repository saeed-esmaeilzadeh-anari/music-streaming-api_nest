import { Module } from '@nestjs/common';
import { StripeClient } from './stripe.client';

/**
 * Shared module (not @Global - imported explicitly by Subscription and
 * Payments modules) so both can depend on Stripe without either depending
 * on the other, avoiding a circular module dependency between them.
 */
@Module({
  providers: [StripeClient],
  exports: [StripeClient],
})
export class StripeModule {}
