import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector }                   from '@nestjs/core';
import { AuthGuard }                   from '@nestjs/passport';
import { IS_PUBLIC_KEY }               from '../../../common/decorators/public.decorator';

/**
 * JwtAuthGuard
 *
 * Global guard (registered via APP_GUARD in AppModule) that protects all
 * routes by default. Routes decorated with @Public() are skipped.
 *
 * IMPORTANT — if your project already has this file, add ONLY the
 * @Public() check inside canActivate and do not replace the rest:
 *
 *   const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
 *     context.getHandler(),
 *     context.getClass(),
 *   ]);
 *   if (isPublic) return true;
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
