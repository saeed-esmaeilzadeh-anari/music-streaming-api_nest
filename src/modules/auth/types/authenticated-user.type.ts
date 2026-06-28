import { Role } from '../../../common/constants/role.enum';

/**
 * Shape attached to `request.user` by JwtStrategy.validate().
 * Kept intentionally minimal (no password hash, no relations) - it's a
 * lightweight identity claim, not a full User entity. Controllers/services
 * that need more should query via UsersService using `id`.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: Role;
}
