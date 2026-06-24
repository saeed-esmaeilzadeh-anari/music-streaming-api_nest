import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../common/constants/role.enum';

class UserSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ enum: Role })
  role: Role;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserSummaryDto })
  user: UserSummaryDto;

  @ApiProperty({ description: 'Short-lived JWT used to authenticate API requests.' })
  accessToken: string;

  @ApiProperty({ description: 'Long-lived token used to obtain a new access token.' })
  refreshToken: string;
}
