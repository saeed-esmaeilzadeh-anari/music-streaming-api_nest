import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../modules/auth/types/authenticated-user.type';

/**
 * Extracts the authenticated user (attached by JwtStrategy.validate()) from
 * the request. Optionally pass a key to pluck a single property.
 *
 * @example
 * findOwn(@CurrentUser() user: AuthenticatedUser) {}
 * findOwnId(@CurrentUser('id') userId: string) {}
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    return data ? user?.[data] : user;
  },
);
