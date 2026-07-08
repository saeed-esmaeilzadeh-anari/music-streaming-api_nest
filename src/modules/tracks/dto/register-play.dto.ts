import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class RegisterPlayDto {
  @ApiPropertyOptional({
    default: 0,
    description: 'Playback position in seconds when this play was recorded.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  progressSec?: number;
}
