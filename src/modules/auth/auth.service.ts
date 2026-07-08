import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto';
import { JwtPayload, RefreshJwtPayload } from './types/jwt-payload.type';
import { hashToken } from './utils/hash-token.util';
import { DOMAIN_EVENTS, UserRegisteredEvent } from '../../events';
import { Role } from '../../common/constants/role.enum';

interface RequestMetadata {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(dto: RegisterDto, meta: RequestMetadata = {}): Promise<AuthResponseDto> {
    const saltRounds = this.configService.get<number>('jwt.bcryptSaltRounds')!;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
      role: Role.LISTENER,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    this.eventEmitter.emit(
      DOMAIN_EVENTS.USER_REGISTERED,
      new UserRegisteredEvent(user.id, user.email, user.username),
    );

    const tokens = await this.issueTokenPair(
      { sub: user.id, email: user.email, username: user.username, role: user.role },
      meta,
    );

    return { user, ...tokens };
  }

  async login(dto: LoginDto, meta: RequestMetadata = {}): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmailForAuth(dto.email);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('This account has been suspended.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const tokens = await this.issueTokenPair(
      { sub: user.id, email: user.email, username: user.username, role: user.role as Role },
      meta,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role as Role,
      },
      ...tokens,
    };
  }

  /**
   * Rotates refresh tokens: the presented token is verified against its
   * stored hash, revoked, and a brand new access+refresh pair is issued.
   * Rotation (rather than reusing the same refresh token indefinitely)
   * limits the blast radius if a refresh token is ever stolen.
   */
  async refreshTokens(
    payload: RefreshJwtPayload & { refreshToken: string },
    meta: RequestMetadata = {},
  ): Promise<AuthResponseDto> {
    const tokenHash = hashToken(payload.refreshToken);
    const storedToken = await this.refreshTokensRepository.findValidByTokenHash(tokenHash);

    if (!storedToken || storedToken.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token is invalid or has expired.');
    }

    const user = await this.usersService.findByIdForAuth(payload.sub);
    if (!user || user.deletedAt || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('This account is no longer active.');
    }

    // Rotate: revoke the old token before issuing a new pair.
    await this.refreshTokensRepository.revoke(storedToken.id);

    const tokens = await this.issueTokenPair(
      { sub: user.id, email: user.email, username: user.username, role: user.role as Role },
      meta,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role as Role,
      },
      ...tokens,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    const storedToken = await this.refreshTokensRepository.findValidByTokenHash(tokenHash);
    if (storedToken) {
      await this.refreshTokensRepository.revoke(storedToken.id);
    }
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.refreshTokensRepository.revokeAllForUser(userId);
  }

  private async issueTokenPair(payload: JwtPayload, meta: RequestMetadata) {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn'),
    });

    const refreshTokenId = randomUUID();
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn')!;
    const refreshPayload: RefreshJwtPayload = { sub: payload.sub, tokenId: refreshTokenId };

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: refreshExpiresIn,
    });

    await this.refreshTokensRepository.create({
      id: refreshTokenId,
      tokenHash: hashToken(refreshToken),
      user: { connect: { id: payload.sub } },
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt: this.computeExpiryDate(refreshExpiresIn),
    });

    return { accessToken, refreshToken };
  }

  private computeExpiryDate(expiresIn: string): Date {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    const now = new Date();
    if (!match) {
      // Fallback: assume seconds if format is unexpected.
      const seconds = parseInt(expiresIn, 10) || 604800;
      now.setSeconds(now.getSeconds() + seconds);
      return now;
    }
    const [, value, unit] = match;
    const amount = parseInt(value, 10);
    switch (unit) {
      case 's':
        now.setSeconds(now.getSeconds() + amount);
        break;
      case 'm':
        now.setMinutes(now.getMinutes() + amount);
        break;
      case 'h':
        now.setHours(now.getHours() + amount);
        break;
      case 'd':
        now.setDate(now.getDate() + amount);
        break;
    }
    return now;
  }
}
