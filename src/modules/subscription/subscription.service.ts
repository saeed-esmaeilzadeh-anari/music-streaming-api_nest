import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { SubscriptionsRepository } from './repositories/subscriptions.repository';
import { StripeClient } from '../../stripe/stripe.client';
import { CreateSubscriptionDto, SubscriptionResponseDto } from './dto';

const PLAN_PRICE_CONFIG_KEY: Record<string, string> = {
  PREMIUM_MONTHLY: 'stripe.priceIds.premiumMonthly',
  PREMIUM_YEARLY: 'stripe.priceIds.premiumYearly',
};

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly stripeClient: StripeClient,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Creates a Stripe Checkout session for the requested plan. The actual
   * Subscription row transitions to ACTIVE only once Stripe confirms payment
   * via webhook (see PaymentsWebhookController) - never trust the client's
   * "success" redirect alone to grant access.
   */
  async createCheckoutSession(
    userId: string,
    email: string,
    dto: CreateSubscriptionDto,
  ): Promise<{ checkoutUrl: string }> {
    const priceConfigKey = PLAN_PRICE_CONFIG_KEY[dto.plan];
    const priceId = priceConfigKey ? this.configService.get<string>(priceConfigKey) : undefined;

    if (!priceId) {
      throw new BadRequestException(`No Stripe price configured for plan "${dto.plan}".`);
    }

    const appUrl = this.configService.get<string>('app.url');

    const session = await this.stripeClient.client.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/cancel`,
      metadata: { userId, plan: dto.plan },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL.');
    }

    return { checkoutUrl: session.url };
  }

  async findActiveForUser(userId: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.subscriptionsRepository.findActiveByUserId(userId);
    if (!subscription) {
      throw new NotFoundException('No active subscription found.');
    }
    return plainToInstance(SubscriptionResponseDto, subscription, {
      excludeExtraneousValues: true,
    });
  }

  async cancelAtPeriodEnd(userId: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.subscriptionsRepository.findActiveByUserId(userId);
    if (!subscription) {
      throw new NotFoundException('No active subscription found.');
    }

    if (subscription.stripeSubscriptionId) {
      await this.stripeClient.client.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    const updated = await this.subscriptionsRepository.update(subscription.id, {
      cancelAtPeriodEnd: true,
    });

    return plainToInstance(SubscriptionResponseDto, updated, { excludeExtraneousValues: true });
  }
}
