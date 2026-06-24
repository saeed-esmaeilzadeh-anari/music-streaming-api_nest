import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { Role } from '../../../common/constants/role.enum';

/**
 * Public-facing user shape. `passwordHash` and other internal fields are
 * never exposed - this class acts as the serialization boundary.
 * Use with ClassSerializerInterceptor or plainToInstance(UserResponseDto, ...).
 */
@Exclude()
export class UserResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  email: string;

  @Expose()
  @ApiProperty()
  username: string;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  firstName?: string | null;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  lastName?: string | null;

  @Expose()
  @ApiProperty({ required: false, nullable: true })
  avatarUrl?: string | null;

  @Expose()
  @ApiProperty({ enum: Role })
  role: Role;

  @Expose()
  @ApiProperty()
  isEmailVerified: boolean;

  @Expose()
  @ApiProperty()
  createdAt: Date;
}
