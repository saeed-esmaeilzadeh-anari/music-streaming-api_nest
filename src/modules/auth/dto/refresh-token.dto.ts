import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token issued at login/refresh time.' })
  @IsString()
  refreshToken: string;
}
