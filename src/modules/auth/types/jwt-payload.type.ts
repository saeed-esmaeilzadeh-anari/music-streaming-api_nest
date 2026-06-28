import { Role } from '../../../common/constants/role.enum';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  username: string;
  role: Role;
}

export interface RefreshJwtPayload {
  sub: string; // user id
  tokenId: string; // refresh token record id, used to support revocation
}
