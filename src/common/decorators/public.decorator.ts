import { SetMetadata } from '@nestjs/common';

/**
 * IS_PUBLIC_KEY — metadata key read by JwtAuthGuard to skip token validation.
 *
 * Usage: add @Public() to any route handler or controller that should be
 * accessible without a JWT. The global JwtAuthGuard checks for this key:
 *
 *   const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
 *     context.getHandler(),
 *     context.getClass(),
 *   ]);
 *   if (isPublic) return true;
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
