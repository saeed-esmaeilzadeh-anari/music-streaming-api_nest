import { Injectable } from '@nestjs/common';
import { Prisma, Subscription } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.SubscriptionCreateInput): Promise<Subscription> {
    return this.prisma.subscription.create({ data });
  }

  findActiveByUserId(userId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { stripeSubscriptionId } });
  }

  update(id: string, data: Prisma.SubscriptionUpdateInput): Promise<Subscription> {
    return this.prisma.subscription.update({ where: { id }, data });
  }
}
