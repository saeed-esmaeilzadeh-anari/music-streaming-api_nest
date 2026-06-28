import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/constants/role.enum';
import { AuthenticatedUser } from '../types/authenticated-user.type';

/**
 * Role-Based Access Control guard. Reads required roles set via @Roles(...)
 * and compares against `request.user.role` (populated by JwtAuthGuard ->
 * JwtStrategy beforehand). If a route has no @Roles() metadata, access is
 * allowed to any authenticated user - RBAC is opt-in per route.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication is required for this resource.');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `This action requires one of the following roles: ${requiredRoles.join(', ')}.`,
      );
    }

    return true;
  }
}
