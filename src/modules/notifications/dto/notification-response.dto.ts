import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class NotificationResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  type: string;

  @Expose()
  @ApiProperty()
  title: string;

  @Expose()
  @ApiProperty()
  body: string;

  @Expose()
  @ApiProperty()
  isRead: boolean;

  @Expose()
  @ApiProperty()
  createdAt: Date;
}
