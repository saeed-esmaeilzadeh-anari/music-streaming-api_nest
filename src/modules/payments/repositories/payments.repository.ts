import { Injectable } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return this.prisma.payment.create({ data });
  }

  findByProviderRefId(providerRefId: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({ where: { providerRefId } });
  }

  update(id: string, data: Prisma.PaymentUpdateInput): Promise<Payment> {
    return this.prisma.payment.update({ where: { id }, data });
  }

  async findMany(params: { userId: string; skip?: number; take?: number }): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { userId: params.userId },
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  count(userId: string): Promise<number> {
    return this.prisma.payment.count({ where: { userId } });
  }
}
