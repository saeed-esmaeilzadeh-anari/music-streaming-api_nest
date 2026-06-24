import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class SubscriptionResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  plan: string;

  @Expose()
  @ApiProperty()
  status: string;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  currentPeriodEnd?: Date | null;

  @Expose()
  @ApiProperty()
  cancelAtPeriodEnd: boolean;
}
