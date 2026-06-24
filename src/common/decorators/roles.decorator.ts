import { SetMetadata } from '@nestjs/common';
import { Role } from '../constants/role.enum';

export const ROLES_KEY = 'roles';

/**
 * Annotates a controller/handler with the roles allowed to access it.
 * Used in conjunction with RolesGuard.
 *
 * @example
 * @Roles(Role.ADMIN, Role.MODERATOR)
 * @Delete(':id')
 * remove() {}
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
