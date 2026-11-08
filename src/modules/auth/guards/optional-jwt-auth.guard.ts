import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Allows genuinely anonymous requests, but validates any supplied Bearer token.
 * A malformed, expired, revoked, or otherwise invalid token must never silently
 * downgrade an authenticated request to the anonymous feed.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<{ headers?: { authorization?: string } }>();

    if (request.headers?.authorization === undefined) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false | null,
    info?: unknown,
  ): TUser {
    if (err) {
      throw err;
    }

    if (info || !user) {
      const message =
        info instanceof Error ? info.message : 'Invalid or expired access token.';
      throw new UnauthorizedException(message);
    }

    return user as TUser;
  }
}
