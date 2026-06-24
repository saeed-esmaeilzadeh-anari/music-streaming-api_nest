import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum AccountStatusDto {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: AccountStatusDto })
  @IsEnum(AccountStatusDto)
  status: AccountStatusDto;
}
