import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './repositories/payments.repository';
import { PaymentsWebhookController } from './webhooks/payments-webhook.controller';
import { PaymentsWebhookService } from './webhooks/payments-webhook.service';
import { StripeModule } from '../../stripe/stripe.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [StripeModule, SubscriptionModule],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [PaymentsService, PaymentsRepository, PaymentsWebhookService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
