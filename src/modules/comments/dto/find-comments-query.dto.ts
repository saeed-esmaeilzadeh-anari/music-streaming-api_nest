import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CommentTargetTypeDto } from './create-comment.dto';

export class FindCommentsQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: CommentTargetTypeDto })
  @IsEnum(CommentTargetTypeDto)
  targetType: CommentTargetTypeDto;

  @ApiProperty()
  @IsUUID()
  targetId: string;
}
