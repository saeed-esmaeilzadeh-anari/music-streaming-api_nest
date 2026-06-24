import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Used only on POST /auth/refresh. Delegates to JwtRefreshStrategy which
 * validates the refresh token's signature/expiry from the request body.
 */
@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard('jwt-refresh') {}
