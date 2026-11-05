import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

/**
 * Validates a JWT when a caller supplies one, while allowing anonymous reads.
 * This is used for public resources that also have owner-only visibility states.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.headers.authorization) {
      return true;
    }
    return super.canActivate(context);
  }
}
