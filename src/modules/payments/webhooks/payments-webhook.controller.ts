import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request } from 'express';
import { StripeClient } from '../../../stripe/stripe.client';
import { PaymentsWebhookService } from './payments-webhook.service';
import { Public } from '../../../common/decorators';

/**
 * Stripe webhook endpoint. Excluded from Swagger (not a client-facing API)
 * and explicitly @Public() since Stripe can't present a JWT - trust here
 * comes entirely from verifying the `stripe-signature` header against the
 * raw request body, not from our own auth system.
 *
 * IMPORTANT: this route requires the raw (unparsed) body. main.ts registers
 * `express.raw()` specifically for this path before the global JSON body
 * parser runs, and RawBodyRequest/req.rawBody depends on that wiring.
 */
@ApiExcludeController()
@Controller('payments/webhook')
export class PaymentsWebhookController {
  constructor(
    private readonly stripeClient: StripeClient,
    private readonly paymentsWebhookService: PaymentsWebhookService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: true }> {
    const webhookSecret = this.configService.get<string>('stripe.webhookSecret');

    if (!signature || !webhookSecret || !req.rawBody) {
      throw new BadRequestException('Missing Stripe signature or raw body.');
    }

    let event;
    try {
      event = this.stripeClient.client.webhooks.constructEvent(
        req.rawBody,
        signature,
        webhookSecret,
      );
    } catch (error) {
      throw new BadRequestException(`Invalid Stripe webhook signature: ${error}`);
    }

    await this.paymentsWebhookService.handleEvent(event);
    return { received: true };
  }
}
