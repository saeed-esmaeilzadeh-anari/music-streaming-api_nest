import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionsRepository } from './repositories/subscriptions.repository';
import { StripeModule } from '../../stripe/stripe.module';

@Module({
  imports: [StripeModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, SubscriptionsRepository],
  exports: [SubscriptionService, SubscriptionsRepository],
})
export class SubscriptionModule {}
