import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../types/jwt-payload.type';
import { AuthenticatedUser } from '../types/authenticated-user.type';

/**
 * Validates the short-lived access token sent as `Authorization: Bearer <token>`.
 * On success, the return value of validate() becomes `request.user`,
 * consumed by the @CurrentUser() decorator and RolesGuard.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findByIdForAuth(payload.sub);

    if (!user || user.deletedAt || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('This account is no longer active.');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role as AuthenticatedUser['role'],
    };
  }
}
