import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

function makeContext(authorization?: string): ExecutionContext {
  const request = {
    headers: authorization === undefined ? {} : { authorization },
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('OptionalJwtAuthGuard', () => {
  let guard: OptionalJwtAuthGuard;

  beforeEach(() => {
    guard = new OptionalJwtAuthGuard();
  });

  it('allows a request with no Authorization header to remain anonymous', () => {
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('attaches the authenticated user returned by Passport', () => {
    const user = {
      id: 'user-1',
      email: 'listener@example.test',
      username: 'listener',
      role: 'LISTENER',
    };

    expect(guard.handleRequest(null, user, null)).toBe(user);
  });

  it('rejects an invalid or expired token instead of downgrading to anonymous', () => {
    expect(() =>
      guard.handleRequest(null, false, new Error('jwt expired')),
    ).toThrow(UnauthorizedException);
  });

  it('rethrows authentication strategy errors', () => {
    const error = new UnauthorizedException('Account is suspended.');

    expect(() => guard.handleRequest(error, false, null)).toThrow(error);
  });
});
