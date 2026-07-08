import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';
import { PaymentsRepository } from '../repositories/payments.repository';
import { SubscriptionsRepository } from '../../subscription/repositories/subscriptions.repository';
import { DOMAIN_EVENTS, SubscriptionRenewedEvent, PaymentFailedEvent } from '../../../events';

/**
 * Reacts to verified Stripe webhook events. Signature verification happens
 * in the controller (it needs the raw request body) - by the time an event
 * reaches this service, it's already trusted as genuinely from Stripe.
 *
 * Idempotency note: Stripe may redeliver the same event; handlers here use
 * `providerRefId`/`stripeSubscriptionId` upserts rather than blind creates
 * where it matters, so redelivery doesn't double-charge or double-renew.
 */
@Injectable()
export class PaymentsWebhookService {
  private readonly logger = new Logger(PaymentsWebhookService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        return this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      case 'invoice.payment_succeeded':
        return this.onInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
      case 'invoice.payment_failed':
        return this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      case 'customer.subscription.deleted':
        return this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan;
    if (!userId || !plan || !session.subscription || !session.customer) {
      this.logger.warn('checkout.session.completed missing required metadata; skipping.');
      return;
    }

    const existing = await this.subscriptionsRepository.findByStripeSubscriptionId(
      session.subscription as string,
    );
    if (existing) return; // already processed (idempotency)

    await this.subscriptionsRepository.create({
      user: { connect: { id: userId } },
      plan: plan as never,
      status: 'ACTIVE',
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      currentPeriodStart: new Date(),
    });
  }

  private async onInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    const subscription = await this.subscriptionsRepository.findByStripeSubscriptionId(
      invoice.subscription as string,
    );
    if (!subscription) return;

    const periodEnd = invoice.lines.data[0]?.period?.end
      ? new Date(invoice.lines.data[0].period.end * 1000)
      : null;

    const updated = await this.subscriptionsRepository.update(subscription.id, {
      status: 'ACTIVE',
      currentPeriodEnd: periodEnd,
    });

    const existingPayment = invoice.payment_intent
      ? await this.paymentsRepository.findByProviderRefId(invoice.payment_intent as string)
      : null;

    if (!existingPayment) {
      await this.paymentsRepository.create({
        user: { connect: { id: subscription.userId } },
        subscription: { connect: { id: subscription.id } },
        provider: 'STRIPE',
        providerRefId: invoice.payment_intent as string,
        amountCents: invoice.amount_paid,
        currency: invoice.currency,
        status: 'SUCCEEDED',
      });
    }

    if (updated.currentPeriodEnd) {
      this.eventEmitter.emit(
        DOMAIN_EVENTS.SUBSCRIPTION_RENEWED,
        new SubscriptionRenewedEvent(
          subscription.userId,
          subscription.id,
          updated.currentPeriodEnd,
        ),
      );
    }
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    const subscription = await this.subscriptionsRepository.findByStripeSubscriptionId(
      invoice.subscription as string,
    );
    if (!subscription) return;

    await this.subscriptionsRepository.update(subscription.id, { status: 'PAST_DUE' });

    const payment = await this.paymentsRepository.create({
      user: { connect: { id: subscription.userId } },
      subscription: { connect: { id: subscription.id } },
      provider: 'STRIPE',
      providerRefId: (invoice.payment_intent as string) ?? `failed_${invoice.id}`,
      amountCents: invoice.amount_due,
      currency: invoice.currency,
      status: 'FAILED',
      failureReason: 'Stripe reported invoice.payment_failed',
    });

    this.eventEmitter.emit(
      DOMAIN_EVENTS.PAYMENT_FAILED,
      new PaymentFailedEvent(subscription.userId, payment.id, 'Invoice payment failed'),
    );
  }

  private async onSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    const subscription = await this.subscriptionsRepository.findByStripeSubscriptionId(
      stripeSubscription.id,
    );
    if (!subscription) return;

    await this.subscriptionsRepository.update(subscription.id, {
      status: 'CANCELED',
      canceledAt: new Date(),
    });
  }
}
