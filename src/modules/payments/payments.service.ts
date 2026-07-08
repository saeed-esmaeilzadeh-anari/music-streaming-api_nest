import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PaymentsRepository } from './repositories/payments.repository';
import { PaymentResponseDto } from './dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly paymentsRepository: PaymentsRepository) {}

  async findOwn(userId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [payments, totalItems] = await Promise.all([
      this.paymentsRepository.findMany({ userId, skip: query.skip, take: limit }),
      this.paymentsRepository.count(userId),
    ]);

    return new PaginatedResultDto(
      payments.map((p) =>
        plainToInstance(PaymentResponseDto, p, { excludeExtraneousValues: true }),
      ),
      totalItems,
      page,
      limit,
    );
  }
}
