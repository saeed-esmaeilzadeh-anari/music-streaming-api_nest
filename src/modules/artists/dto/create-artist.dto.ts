import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateArtistDto {
  @ApiProperty({ example: 'The Midnight' })
  @IsString()
  @MaxLength(100)
  stageName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;
}
