import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum SubscriptionPlanDto {
  PREMIUM_MONTHLY = 'PREMIUM_MONTHLY',
  PREMIUM_YEARLY = 'PREMIUM_YEARLY',
  FAMILY = 'FAMILY',
}

export class CreateSubscriptionDto {
  @ApiProperty({ enum: SubscriptionPlanDto })
  @IsEnum(SubscriptionPlanDto)
  plan: SubscriptionPlanDto;
}
