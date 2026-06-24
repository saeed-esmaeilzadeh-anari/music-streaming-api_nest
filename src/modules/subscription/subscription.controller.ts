import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto, SubscriptionResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('Subscription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Create a Stripe Checkout session for a subscription plan' })
  createCheckout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptionService.createCheckoutSession(user.id, user.email, dto);
  }

  @Get('me')
  @ApiOperation({ summary: "Get the current user's active subscription" })
  @ApiResponse({ status: 200, type: SubscriptionResponseDto })
  findActive(@CurrentUser('id') userId: string) {
    return this.subscriptionService.findActiveForUser(userId);
  }

  @Patch('cancel')
  @ApiOperation({ summary: 'Cancel the subscription at the end of the current billing period' })
  @ApiResponse({ status: 200, type: SubscriptionResponseDto })
  cancel(@CurrentUser('id') userId: string) {
    return this.subscriptionService.cancelAtPeriodEnd(userId);
  }
}
