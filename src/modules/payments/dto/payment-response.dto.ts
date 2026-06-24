import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PaymentResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  amountCents: number;

  @Expose()
  @ApiProperty()
  currency: string;

  @Expose()
  @ApiProperty()
  status: string;

  @Expose()
  @ApiProperty()
  provider: string;

  @Expose()
  @ApiProperty()
  createdAt: Date;
}
