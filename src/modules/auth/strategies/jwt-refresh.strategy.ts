import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { RefreshJwtPayload } from '../types/jwt-payload.type';

/**
 * Validates the refresh token sent in the request body as `refreshToken`.
 * Unlike JwtStrategy, this does NOT check the database here - that's left
 * to AuthService.refreshTokens() so it can also verify the token hash
 * matches a non-revoked record (defense against a leaked-but-rotated token).
 * This strategy only verifies the JWT signature/expiry and shapes the payload.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret')!,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshJwtPayload) {
    const refreshToken = req.body?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }
    return { ...payload, refreshToken };
  }
}
