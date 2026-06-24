import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class CommentResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  content: string;

  @Expose()
  @ApiProperty()
  userId: string;

  @Expose()
  @ApiProperty()
  targetType: string;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  parentId?: string | null;

  @Expose()
  @ApiProperty()
  isEdited: boolean;

  @Expose()
  @ApiProperty()
  createdAt: Date;
}
